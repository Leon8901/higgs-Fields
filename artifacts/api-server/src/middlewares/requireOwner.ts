import type { Request, Response, NextFunction } from "express";

// Reusable owner-only gate. Must run after `requireAuth` (needs `req.appUser`
// already attached). Single true/false distinction — no role enum — backing
// the admin settings panel today and any future owner-only surface.
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.appUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.appUser.isOwner) {
    res.status(403).json({ error: "Forbidden — owner access required" });
    return;
  }
  next();
}
