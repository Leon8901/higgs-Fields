import { Router, type IRouter } from "express";
import { db, waitlistTable } from "@workspace/db";
import { JoinWaitlistBody, JoinWaitlistResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/waitlist", async (req, res): Promise<void> => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [entry] = await db
      .insert(waitlistTable)
      .values({
        email: parsed.data.email,
        name: parsed.data.name ?? null,
      })
      .returning();

    res.status(201).json(JoinWaitlistResponse.parse(entry));
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "You're already on the waitlist!" });
      return;
    }
    throw err;
  }
});

export default router;
