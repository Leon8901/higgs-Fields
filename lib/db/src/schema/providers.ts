import { pgTable, serial, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Data-driven catalog of BYOK-capable providers. This is the single source of
// truth the frontend renders from (one generic <ProviderKey> component per
// row) and that /api-keys validates against — adding a provider here (plus,
// if real key validation is desired, a matching entry in the code adapter
// registry at artifacts/api-server/src/lib/media/registry.ts) is enough to
// surface it, with zero new frontend components.
export const providersTable = pgTable("providers", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // matches models.adapter / user_api_keys.provider, e.g. "wavespeed"
  name: text("name").notNull(), // display name, e.g. "WaveSpeed AI"
  icon: text("icon"), // optional icon URL; frontend falls back to the provider's initial
  capabilities: jsonb("capabilities").notNull().default([]), // e.g. ["image", "video", "audio"]
  supportsByok: boolean("supports_byok").notNull().default(true),
  keyFormatHint: text("key_format_hint"), // shown as input placeholder/help text, e.g. "Starts with sk-"
  status: text("status").notNull().default("active"), // active | disabled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProviderSchema = createInsertSchema(providersTable).omit({ id: true, createdAt: true });
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providersTable.$inferSelect;
