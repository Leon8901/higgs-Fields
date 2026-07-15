import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, modelsTable } from "@workspace/db";
import { ListModelsQueryParams, ListModelsResponse, GetModelParams, GetModelResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/models", async (req, res): Promise<void> => {
  const query = ListModelsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { category } = query.data;
  // Public catalog only ever shows active models — a disabled model stays
  // in the table (e.g. for historical generations) but disappears from
  // /image, /video, /audio and can't be re-picked as a Site Settings default.
  const conditions = [eq(modelsTable.isActive, true)];
  if (category && category !== "all") {
    conditions.push(eq(modelsTable.category, category));
  }

  const models = await db.select().from(modelsTable).where(and(...conditions)).orderBy(modelsTable.sortOrder);

  res.json(ListModelsResponse.parse(models));
});

router.get("/models/:modelId", async (req, res): Promise<void> => {
  const params = GetModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [model] = await db.select().from(modelsTable).where(eq(modelsTable.modelId, params.data.modelId));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  res.json(GetModelResponse.parse(model));
});

export default router;
