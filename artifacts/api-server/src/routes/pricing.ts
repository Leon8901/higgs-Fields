import { Router, type IRouter } from "express";
import { db, pricingPlansTable } from "@workspace/db";
import { ListPricingPlansResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/pricing", async (_req, res): Promise<void> => {
  const plans = await db
    .select()
    .from(pricingPlansTable)
    .orderBy(pricingPlansTable.sortOrder);

  res.json(ListPricingPlansResponse.parse(plans));
});

export default router;
