import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, usersTable, pricingPlansTable, creditLedgerTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { isWebhookConfigured } from "../lib/billing/razorpay";

// Mounted in app.ts with express.raw() BEFORE express.json() — Razorpay
// signature verification is HMAC over the exact raw request bytes, so this
// route must never pass through a body-parsing middleware first.
const router: IRouter = Router();

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !isWebhookConfigured()) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  // timingSafeEqual requires equal-length buffers; mismatched lengths mean
  // "not equal" without needing the constant-time comparison.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function grantCreditsOnce(userId: number, delta: number, reason: string, providerRef: string): Promise<void> {
  const [dupe] = await db
    .select()
    .from(creditLedgerTable)
    .where(and(eq(creditLedgerTable.providerRef, providerRef), eq(creditLedgerTable.reason, reason)));
  if (dupe) return; // Already credited for this exact payment — webhook redelivery, no-op.

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return;

  const newBalance = user.creditsBalance + delta;
  await db.update(usersTable).set({ creditsBalance: newBalance }).where(eq(usersTable.id, userId));
  await db.insert(creditLedgerTable).values({ userId, delta, reason, balanceAfter: newBalance, providerRef });
}

// Mounted directly at /api/billing/webhook in app.ts, so this handles the
// bare root path rather than repeating the full path here.
router.post("/", async (req, res): Promise<void> => {
  if (!isWebhookConfigured()) {
    // Not an error — Razorpay isn't set up yet, so there's nothing to
    // process. Respond 200 so Razorpay (once configured) doesn't retry a
    // request we can never handle without a webhook secret.
    res.status(200).json({ received: false, reason: "webhook not configured" });
    return;
  }

  const rawBody = req.body as Buffer; // set by express.raw() in app.ts
  const signature = req.header("x-razorpay-signature");
  if (!verifySignature(rawBody, signature)) {
    logger.warn("Rejected Razorpay webhook with invalid signature");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const eventType: string = event?.event ?? "";
  logger.info({ eventType }, "Razorpay webhook received");

  try {
    switch (eventType) {
      case "subscription.activated": {
        const sub = event.payload.subscription.entity;
        const userId = Number(sub.notes?.userId);
        if (userId) {
          await db
            .update(usersTable)
            .set({ subscriptionStatus: "active", planKey: sub.notes?.planKey ?? undefined })
            .where(eq(usersTable.id, userId));
        }
        break;
      }

      case "subscription.charged": {
        const sub = event.payload.subscription.entity;
        const payment = event.payload.payment?.entity;
        const userId = Number(sub.notes?.userId);
        const planKey = sub.notes?.planKey;
        if (userId && planKey && payment?.id) {
          const [plan] = await db.select().from(pricingPlansTable).where(eq(pricingPlansTable.planKey, planKey));
          if (plan) {
            await grantCreditsOnce(userId, plan.creditsPerMonth, "plan_renewal", payment.id);
          }
          await db.update(usersTable).set({ subscriptionStatus: "active" }).where(eq(usersTable.id, userId));
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.halted": {
        const sub = event.payload.subscription.entity;
        const userId = Number(sub.notes?.userId);
        const status = eventType === "subscription.cancelled" ? "cancelled" : eventType === "subscription.halted" ? "halted" : "completed";
        if (userId) {
          await db
            .update(usersTable)
            .set({ subscriptionStatus: status, planKey: "free", billingInterval: null })
            .where(eq(usersTable.id, userId));
        }
        break;
      }

      case "payment.captured": {
        const payment = event.payload.payment.entity;
        if (payment.notes?.type === "credit_pack") {
          const userId = Number(payment.notes.userId);
          const packKey = payment.notes.packKey;
          if (userId && packKey) {
            const { creditPacksTable } = await import("@workspace/db");
            const [pack] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.packKey, packKey));
            if (pack) {
              await grantCreditsOnce(userId, pack.credits, "credit_pack_purchase", payment.id);
            }
          }
        }
        break;
      }

      default:
        // Ignore event types we don't act on (e.g. payment.failed logging
        // only) — Razorpay sends many events we don't need to handle.
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error({ err, eventType }, "Failed to process Razorpay webhook");
    // Still 200: a processing bug on our side shouldn't trigger Razorpay's
    // retry storm. We log it — worst case is a manual credit reconciliation.
    res.status(200).json({ received: true, processed: false });
  }
});

export default router;
