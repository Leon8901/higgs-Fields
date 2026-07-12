import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, avatarsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

const CreateAvatarBody = z.object({
  name: z.string().min(1).max(100),
  photoUrl: z.string().url(),
});

const UpdateAvatarBody = z.object({
  name: z.string().min(1).max(100),
});

// GET /avatars — list current user's saved avatars
router.get("/avatars", requireAuth, async (req, res): Promise<void> => {
  const avatars = await db
    .select()
    .from(avatarsTable)
    .where(eq(avatarsTable.userId, req.appUser!.id))
    .orderBy(avatarsTable.createdAt);

  res.json(avatars.map((a) => ({
    id: a.id,
    name: a.name,
    photoUrl: a.photoUrl,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  })));
});

// POST /avatars — create a new saved avatar
router.post("/avatars", requireAuth, async (req, res): Promise<void> => {
  const body = CreateAvatarBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [avatar] = await db
    .insert(avatarsTable)
    .values({
      userId: req.appUser!.id,
      name: body.data.name,
      photoUrl: body.data.photoUrl,
    })
    .returning();

  res.status(201).json({
    id: avatar.id,
    name: avatar.name,
    photoUrl: avatar.photoUrl,
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  });
});

// PATCH /avatars/:id — rename an avatar
router.patch("/avatars/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid avatar id" });
    return;
  }

  const body = UpdateAvatarBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(avatarsTable)
    .set({ name: body.data.name, updatedAt: new Date() })
    .where(and(eq(avatarsTable.id, id), eq(avatarsTable.userId, req.appUser!.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Avatar not found" });
    return;
  }

  res.json({
    id: updated.id,
    name: updated.name,
    photoUrl: updated.photoUrl,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

// DELETE /avatars/:id — delete a saved avatar
router.delete("/avatars/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid avatar id" });
    return;
  }

  const deleted = await db
    .delete(avatarsTable)
    .where(and(eq(avatarsTable.id, id), eq(avatarsTable.userId, req.appUser!.id)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Avatar not found" });
    return;
  }

  res.status(204).end();
});

export default router;
