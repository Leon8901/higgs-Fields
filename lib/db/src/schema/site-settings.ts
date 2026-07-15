import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Database-driven site configuration. Every row's shape (key, type, category,
// isPublic, description, default) is defined once in `settingsRegistry.ts` —
// this table only ever holds current *values*. Seeding is insert-if-missing
// (never upsert) so admin edits survive repeated seed runs. The only
// supported read path at runtime is `SettingsService` in the api-server —
// nothing else should query this table directly.
export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  // Always stored as a JSON-encoded string (works uniformly for string,
  // boolean, number, and json-typed settings) — parsed per `type` on read.
  value: text("value").notNull(),
  type: text("type").notNull(), // string | boolean | number | json
  category: text("category").notNull(), // drives dynamic grouping in the admin UI
  isPublic: boolean("is_public").notNull().default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSiteSettingSchema = createInsertSchema(siteSettingsTable).omit({ id: true, updatedAt: true });
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type SiteSetting = typeof siteSettingsTable.$inferSelect;
