import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, creditLedgerTable } from "@workspace/db";
import { getDefaultCredits, isRegistrationEnabled } from "../lib/settings";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      appUser?: typeof usersTable.$inferSelect;
    }
  }
}

// Resolves the Clerk session, then just-in-time provisions (or loads) the
// matching row in our own `users` table. Attaches it as `req.appUser`.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (existing) {
      req.appUser = existing;
      next();
      return;
    }

    // Registration-disabled only blocks brand-new users from being
    // provisioned here — it never affects an `existing` row above, so
    // already-registered users keep working normally.
    if (!(await isRegistrationEnabled())) {
      res.status(403).json({ error: "Registration is currently disabled" });
      return;
    }

    const clerkUser = await clerkClient.users.getUser(clerkId);
    const email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
      ?? clerkUser.emailAddresses[0]?.emailAddress
      ?? "";
    const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
    const signupBonusCredits = await getDefaultCredits();

    const [created] = await db
      .insert(usersTable)
      .values({ clerkId, email, displayName, planKey: "free", creditsBalance: signupBonusCredits })
      .returning();

    await db.insert(creditLedgerTable).values({
      userId: created.id,
      delta: signupBonusCredits,
      reason: "signup_bonus",
      balanceAfter: signupBonusCredits,
    });

    req.appUser = created;
    next();
  } catch (err) {
    req.log.error({ err }, "Failed to resolve/provision app user");
    res.status(500).json({ error: "Failed to resolve user" });
  }
}
