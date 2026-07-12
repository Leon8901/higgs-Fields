import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pricingPlansTable, creditPacksTable, usersTable } from "@workspace/db";
import {
  GetBillingStatusResponse,
  SubscribeBody,
  SubscribeResponse,
  PurchaseCreditsBody,
  PurchaseCreditsResponse,
  ListCreditPacksResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getRazorpayClient, isRazorpayConfigured, PAYMENTS_NOT_CONFIGURED_MESSAGE } from "../lib/billing/razorpay";
import { usdToInrPaise } from "../lib/billing/currency";

const router: IRouter = Router();

// Frontend calls this on Pricing page load to decide whether to show a
// "test mode" notice. Never gates rendering — buttons stay clickable either
// way, per product decision: only the actual checkout attempt should fail.
router.get("/billing/status", async (_req, res): Promise<void> => {
  res.json(GetBillingStatusResponse.parse({ configured: isRazorpayConfigured() }));
});

router.get("/credit-packs", async (_req, res): Promise<void> => {
  const packs = await db.select().from(creditPacksTable).orderBy(creditPacksTable.sortOrder);
  res.json(ListCreditPacksResponse.parse(packs));
});

// Razorpay has no concept of a Plan until one is created through its API.
// We create it lazily on first subscribe and cache the id on the plan row,
// rather than requiring a manual dashboard step per plan/interval.
async function ensureRazorpayPlanId(
  plan: typeof pricingPlansTable.$inferSelect,
  interval: "monthly" | "yearly",
): Promise<string> {
  const existing = interval === "monthly" ? plan.razorpayPlanIdMonthly : plan.razorpayPlanIdYearly;
  if (existing) return existing;

  const priceUsd = interval === "monthly" ? plan.price : plan.yearlyPrice * 12;
  const amountPaise = await usdToInrPaise(priceUsd);
  const razorpay = getRazorpayClient();

  const created = await razorpay.plans.create({
    period: interval === "monthly" ? "monthly" : "yearly",
    interval: 1,
    item: {
      name: `${plan.name} (${interval})`,
      amount: amountPaise,
      currency: "INR",
    },
    notes: { planKey: plan.planKey, interval },
  } as any);

  await db
    .update(pricingPlansTable)
    .set(interval === "monthly" ? { razorpayPlanIdMonthly: created.id } : { razorpayPlanIdYearly: created.id })
    .where(eq(pricingPlansTable.id, plan.id));

  return created.id;
}

router.post("/billing/subscribe", requireAuth, async (req, res): Promise<void> => {
  if (!isRazorpayConfigured()) {
    res.status(503).json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE });
    return;
  }

  const body = SubscribeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { planKey, interval } = body.data;
  const [plan] = await db.select().from(pricingPlansTable).where(eq(pricingPlansTable.planKey, planKey));
  if (!plan) {
    res.status(400).json({ error: "Unknown plan." });
    return;
  }

  const user = req.appUser!;
  const razorpay = getRazorpayClient();

  try {
    const razorpayPlanId = await ensureRazorpayPlanId(plan, interval);

    let customerId = user.razorpayCustomerId;
    if (!customerId) {
      const customer = await razorpay.customers.create({
        name: user.displayName ?? user.email,
        email: user.email,
        fail_existing: 0,
      } as any);
      customerId = customer.id;
      await db.update(usersTable).set({ razorpayCustomerId: customerId }).where(eq(usersTable.id, user.id));
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: interval === "monthly" ? 120 : 10, // 10yr monthly / 10yr yearly ceiling; renews indefinitely in practice
      notes: { userId: String(user.id), planKey, interval },
    } as any);

    await db
      .update(usersTable)
      .set({ razorpaySubscriptionId: subscription.id, subscriptionStatus: "pending", billingInterval: interval })
      .where(eq(usersTable.id, user.id));

    res.json(
      SubscribeResponse.parse({
        subscriptionId: subscription.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID!,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Razorpay subscribe failed");
    res.status(502).json({ error: "Could not start checkout. Please try again later." });
  }
});

router.post("/billing/purchase-credits", requireAuth, async (req, res): Promise<void> => {
  if (!isRazorpayConfigured()) {
    res.status(503).json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE });
    return;
  }

  const body = PurchaseCreditsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [pack] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.packKey, body.data.packKey));
  if (!pack) {
    res.status(400).json({ error: "Unknown credit pack." });
    return;
  }

  const user = req.appUser!;
  const razorpay = getRazorpayClient();

  try {
    const amountPaise = await usdToInrPaise(pack.priceUsd);
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      notes: { userId: String(user.id), type: "credit_pack", packKey: pack.packKey },
    } as any);

    res.json(
      PurchaseCreditsResponse.parse({
        orderId: order.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID!,
        amount: amountPaise,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Razorpay order creation failed");
    res.status(502).json({ error: "Could not start checkout. Please try again later." });
  }
});

export default router;
