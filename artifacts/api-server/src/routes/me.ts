import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userApiKeysTable, usersTable } from "@workspace/db";
import { GetMeResponse, SwitchPlanBody, SwitchPlanResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const user = req.appUser!;
  const [ownKey] = await db.select().from(userApiKeysTable).where(eq(userApiKeysTable.userId, user.id));

  res.json(
    GetMeResponse.parse({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      planKey: user.planKey,
      creditsBalance: user.creditsBalance,
      hasOwnKey: !!ownKey,
      isOwner: user.isOwner,
      subscriptionStatus: user.subscriptionStatus,
      billingInterval: user.billingInterval,
      createdAt: user.createdAt,
    }),
  );
});

router.post("/me/plan", requireAuth, async (req, res): Promise<void> => {
  const body = SwitchPlanBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { planKey } = body.data;
  const user = req.appUser!;

  // Paid plans now require a real Razorpay subscription (see POST
  // /billing/subscribe) — this endpoint only handles voluntary downgrade to
  // the free tier (e.g. cancelling), so it can never be used to grant paid
  // credits without an actual payment.
  if (planKey !== "free") {
    res.status(400).json({ error: "Paid plans require checkout. Use the Pricing page to subscribe." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ planKey: "free", subscriptionStatus: null, billingInterval: null })
    .where(eq(usersTable.id, user.id))
    .returning();

  const [ownKey] = await db.select().from(userApiKeysTable).where(eq(userApiKeysTable.userId, user.id));

  res.json(
    SwitchPlanResponse.parse({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      planKey: updated.planKey,
      creditsBalance: updated.creditsBalance,
      hasOwnKey: !!ownKey,
      isOwner: updated.isOwner,
      subscriptionStatus: updated.subscriptionStatus,
      billingInterval: updated.billingInterval,
      createdAt: updated.createdAt,
    }),
  );
});

export default router;
