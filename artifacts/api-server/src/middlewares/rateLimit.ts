/**
 * Simple per-user in-memory rate limiter for the generations endpoint.
 *
 * Uses a fixed-window strategy: tracks (count, windowStart) per user.
 * Works correctly for a single-process deployment (Replit).  If the process
 * is scaled out, promote to Redis-backed counters.
 */

import { type Request, type Response, type NextFunction } from "express";

interface Window {
  count: number;
  windowStart: number;
}

const store = new Map<string | number, Window>();

// Scrub expired windows every 5 minutes so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store.entries()) {
    if (now - win.windowStart >= WINDOW_MS) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

/** Window length in milliseconds */
const WINDOW_MS = 60_000; // 1 minute

/** Maximum generations a single user may submit per window */
const MAX_PER_WINDOW = 20;

/**
 * Express middleware factory.  Call with a function that extracts the user ID
 * from the request (after requireAuth has populated `req.appUser`).
 */
export function generationsRateLimit() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.appUser?.id;
    if (!userId) {
      // requireAuth should have rejected unauthenticated requests first.
      next();
      return;
    }

    const now = Date.now();
    const win = store.get(userId);

    if (!win || now - win.windowStart >= WINDOW_MS) {
      store.set(userId, { count: 1, windowStart: now });
      next();
      return;
    }

    if (win.count >= MAX_PER_WINDOW) {
      const retryAfterSec = Math.ceil((WINDOW_MS - (now - win.windowStart)) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      res
        .status(429)
        .json({ error: `Too many generations. Please wait ${retryAfterSec}s before submitting again.` });
      return;
    }

    win.count += 1;
    next();
  };
}
