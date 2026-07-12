import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, creditLedgerTable } from "@workspace/db";
import { ListCreditLedgerResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/credits/ledger", requireAuth, async (req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.userId, req.appUser!.id))
    .orderBy(desc(creditLedgerTable.createdAt));

  res.json(ListCreditLedgerResponse.parse(entries));
});

export default router;
