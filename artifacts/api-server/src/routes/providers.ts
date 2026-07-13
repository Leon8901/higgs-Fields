import { Router, type IRouter } from "express";
import { eq, inArray, or } from "drizzle-orm";
import { db, modelsTable, providersTable } from "@workspace/db";
import { ListProvidersResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Data-driven BYOK provider catalog: the union of (a) providers actually
// referenced by a model in the catalog today, and (b) providers that support
// BYOK independent of any specific model. Adding a row to the `providers`
// table is enough to make it appear in the frontend's "Add Your Keys" panel —
// no frontend code changes needed. Disabled providers never appear.
router.get("/providers", async (req, res): Promise<void> => {
  const models = await db.select({ adapter: modelsTable.adapter }).from(modelsTable);
  const adaptersInUse = [...new Set(models.map((m) => m.adapter))];

  const rows = await db
    .select()
    .from(providersTable)
    .where(
      adaptersInUse.length > 0
        ? or(inArray(providersTable.slug, adaptersInUse), eq(providersTable.supportsByok, true))
        : eq(providersTable.supportsByok, true),
    );

  const providers = rows
    .filter((p) => p.status === "active")
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      icon: p.icon,
      capabilities: p.capabilities as string[],
      supportsByok: p.supportsByok,
      keyFormatHint: p.keyFormatHint,
      description: p.description ?? null,
      docsUrl: p.docsUrl ?? null,
    }));

  const missing = adaptersInUse.filter((slug) => !rows.some((p) => p.slug === slug));
  if (missing.length > 0) {
    req.log.warn({ missing }, "Model catalog references adapters with no matching providers row");
  }

  res.json(ListProvidersResponse.parse(providers));
});

export default router;
