import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, modelsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOwner } from "../middlewares/requireOwner";
import { importAssetFromUrl } from "../lib/media/assetImport";

const router: IRouter = Router();

// ── Allowed badge values ───────────────────────────────────────────────────────
const ALLOWED_BADGES = new Set(["NEW", "TRENDING", "HOT", "TOP"]);

// ── Response shape ─────────────────────────────────────────────────────────────
function toAdminModel(m: typeof modelsTable.$inferSelect) {
  return {
    id: m.id,
    modelId: m.modelId,
    name: m.name,
    category: m.category,
    description: m.description,
    badge: m.badge ?? null,
    thumbnailUrl: m.thumbnailUrl ?? null,
    isFeatured: m.isFeatured,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    adapter: m.adapter,
    providerModelPath: m.providerModelPath,
    basePriceUsd: m.basePriceUsd,
    creditCost: m.creditCost,
    createdAt: m.createdAt,
  };
}

// ── GET /admin/models ─────────────────────────────────────────────────────────
// Returns every row from models with all catalog columns including thumbnailUrl.
router.get("/admin/models", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  const models = await db
    .select()
    .from(modelsTable)
    .orderBy(asc(modelsTable.sortOrder), asc(modelsTable.id));
  res.json(models.map(toAdminModel));
});

// ── PATCH /admin/models/:modelId ──────────────────────────────────────────────
// Updates editable fields via an explicit allow-list — same pattern as the
// providers PATCH and settings update. Unknown fields are silently ignored;
// invalid values (wrong type, out-of-range) return 400.
router.patch("/admin/models/:modelId", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const { modelId } = req.params;
  const [model] = await db
    .select()
    .from(modelsTable)
    .where(eq(modelsTable.modelId, modelId));
  if (!model) {
    res.status(404).json({ error: `Model "${modelId}" not found` });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof modelsTable.$inferInsert> = {};

  if (body.thumbnailUrl === null || typeof body.thumbnailUrl === "string") {
    patch.thumbnailUrl = body.thumbnailUrl as string | null;
  }
  if (typeof body.isActive === "boolean") {
    patch.isActive = body.isActive;
  }
  if (typeof body.isFeatured === "boolean") {
    patch.isFeatured = body.isFeatured;
  }
  if (typeof body.name === "string" && body.name.trim().length > 0) {
    patch.name = body.name.trim();
  }
  if (typeof body.description === "string") {
    patch.description = body.description;
  }
  if (body.badge === null || (typeof body.badge === "string" && ALLOWED_BADGES.has(body.badge))) {
    patch.badge = body.badge as string | null;
  }
  if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) && body.sortOrder >= 0) {
    patch.sortOrder = body.sortOrder;
  }
  if (typeof body.creditCost === "number" && Number.isInteger(body.creditCost) && body.creditCost >= 0) {
    patch.creditCost = body.creditCost;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(modelsTable)
    .set(patch)
    .where(eq(modelsTable.modelId, modelId))
    .returning();

  res.json(toAdminModel(updated));
});

// ── POST /admin/models/:modelId/thumbnail ─────────────────────────────────────
// Paste-URL path: fetches a public URL, validates it's a real image (type +
// size), re-hosts it via the shared assetImport utility (third consumer after
// branding and provider icons), and saves the owned /api/storage/… path.
// File-upload path: client uses POST /storage/uploads/request-url to get a
// presigned PUT URL, uploads directly, then calls PATCH /admin/models/:modelId
// with { thumbnailUrl: "/api/storage…" } — no additional endpoint needed.
router.post(
  "/admin/models/:modelId/thumbnail",
  requireAuth,
  requireOwner,
  async (req, res): Promise<void> => {
    const { modelId } = req.params;
    const [model] = await db
      .select()
      .from(modelsTable)
      .where(eq(modelsTable.modelId, modelId));
    if (!model) {
      res.status(404).json({ error: `Model "${modelId}" not found` });
      return;
    }

    const { url } = req.body as { url?: string };
    if (typeof url !== "string" || !url.trim()) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    let thumbnailPath: string;
    try {
      thumbnailPath = await importAssetFromUrl(url.trim());
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Asset import failed",
      });
      return;
    }

    const [updated] = await db
      .update(modelsTable)
      .set({ thumbnailUrl: thumbnailPath })
      .where(eq(modelsTable.modelId, modelId))
      .returning();

    res.json(toAdminModel(updated));
  },
);

export default router;
