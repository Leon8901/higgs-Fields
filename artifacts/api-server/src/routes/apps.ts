import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, appsTable } from "@workspace/db";
import {
  ListAppsQueryParams,
  ListAppsResponse,
  GetAppStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/apps", async (req, res): Promise<void> => {
  const query = ListAppsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { filter, search } = query.data;

  const conditions = [];

  if (search) {
    conditions.push(ilike(appsTable.name, `%${search}%`));
  }

  if (filter === "featured") {
    conditions.push(eq(appsTable.isFeatured, true));
  } else if (filter === "trending") {
    conditions.push(eq(appsTable.isTrending, true));
  } else if (filter === "new") {
    conditions.push(eq(appsTable.isNew, true));
  }

  const apps =
    conditions.length > 0
      ? await db
          .select()
          .from(appsTable)
          .where(and(...conditions))
          .orderBy(appsTable.viewCount)
      : await db.select().from(appsTable).orderBy(appsTable.viewCount);

  res.json(ListAppsResponse.parse(apps));
});

router.get("/apps/stats", async (_req, res): Promise<void> => {
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appsTable);

  const [trendingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appsTable)
    .where(eq(appsTable.isTrending, true));

  const [newRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appsTable)
    .where(eq(appsTable.isNew, true));

  res.json(
    GetAppStatsResponse.parse({
      total: totalRow?.count ?? 0,
      trending: trendingRow?.count ?? 0,
      newThisWeek: newRow?.count ?? 0,
    }),
  );
});

export default router;
