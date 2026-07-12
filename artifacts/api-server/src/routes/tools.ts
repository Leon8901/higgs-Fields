import { Router, type IRouter } from "express";
import { eq, and, or, ilike } from "drizzle-orm";
import { db, toolsTable } from "@workspace/db";
import {
  ListToolsQueryParams,
  ListToolsResponse,
  ListFeaturedToolsResponse,
  GetToolParams,
  GetToolResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tools", async (req, res): Promise<void> => {
  const query = ListToolsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { category, tag } = query.data;

  const conditions = [];
  if (category && category !== "all") {
    conditions.push(eq(toolsTable.category, category));
  }
  if (tag) {
    conditions.push(
      or(
        ilike(toolsTable.name, `%${tag}%`),
        ilike(toolsTable.tagline, `%${tag}%`),
      ),
    );
  }

  const tools =
    conditions.length > 0
      ? await db
          .select()
          .from(toolsTable)
          .where(and(...conditions))
          .orderBy(toolsTable.sortOrder)
      : await db.select().from(toolsTable).orderBy(toolsTable.sortOrder);

  res.json(ListToolsResponse.parse(tools));
});

router.get("/tools/featured", async (_req, res): Promise<void> => {
  const tools = await db
    .select()
    .from(toolsTable)
    .where(eq(toolsTable.isFeatured, true))
    .orderBy(toolsTable.sortOrder);

  res.json(ListFeaturedToolsResponse.parse(tools));
});

router.get("/tools/:id", async (req, res): Promise<void> => {
  const params = GetToolParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [tool] = await db
    .select()
    .from(toolsTable)
    .where(eq(toolsTable.id, params.data.id));

  if (!tool) {
    res.status(404).json({ error: "Tool not found" });
    return;
  }

  res.json(GetToolResponse.parse(tool));
});

export default router;
