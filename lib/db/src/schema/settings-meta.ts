import { pgTable, integer } from "drizzle-orm/pg-core";

// Single-row table (id is always 1) tracking a monotonically increasing
// version bumped in the same transaction as any site_settings write. Read
// paths use this to invalidate an in-memory cache without a time-based TTL —
// a write is visible on the very next read. Never exposed via any API
// response.
export const settingsMetaTable = pgTable("settings_meta", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull().default(1),
});

export type SettingsMeta = typeof settingsMetaTable.$inferSelect;
