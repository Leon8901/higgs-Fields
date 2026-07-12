import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userApiKeysTable, usersTable, pricingPlansTable, creditLedgerTable } from "@workspace/db";
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

  let creditsGrant = 0;
  if (planKey !== "free") {
    const [plan] = await db.select().from(pricingPlansTable).where(eq(pricingPlansTable.planKey, planKey));
    if (!plan) {
      res.status(400).json({ error: "Unknown plan." });
      return;
    }
    creditsGrant = plan.creditsPerMonth;
  }

  const newBalance = user.creditsBalance + creditsGrant;
  const [updated] = await db
    .update(usersTable)
    .set({ planKey, creditsBalance: newBalance })
    .where(eq(usersTable.id, user.id))
    .returning();

  if (creditsGrant > 0) {
    await db.insert(creditLedgerTable).values({
      userId: user.id,
      delta: creditsGrant,
      reason: "plan_upgrade",
      balanceAfter: newBalance,
    });
  }

  const [ownKey] = await db.select().from(userApiKeysTable).where(eq(userApiKeysTable.userId, user.id));

  res.json(
    SwitchPlanResponse.parse({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      planKey: updated.planKey,
      creditsBalance: updated.creditsBalance,
      hasOwnKey: !!ownKey,
      createdAt: updated.createdAt,
    }),
  );
});

export default router;
