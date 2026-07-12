import { pgTable, serial, text, boolean, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Catalog of generative AI models available on the platform. Each row maps a
// stable internal `modelId` (used in URLs and generation requests) to a
// specific provider adapter + provider-side model path, so a model can be
// re-pointed to a different provider later without touching call sites.
export const modelsTable = pgTable("models", {
  id: serial("id").primaryKey(),
  modelId: text("model_id").notNull().unique(), // stable slug, e.g. "nano-banana-pro"
  name: text("name").notNull(),
  category: text("category").notNull(), // image | video | audio
  description: text("description").notNull(),
  badge: text("badge"), // NEW | TRENDING | HOT | null
  thumbnailUrl: text("thumbnail_url"),
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),

  // Provider routing
  adapter: text("adapter").notNull().default("wavespeed"), // which adapter implements generateMedia for this row
  providerModelPath: text("provider_model_path").notNull(), // e.g. "google/nano-banana-pro/text-to-image-ultra"

  // Pricing
  basePriceUsd: real("base_price_usd").notNull(), // provider's raw cost per generation, for reference
  creditCost: integer("credit_cost").notNull(), // platform credits charged per generation

  // Drives the dynamic generation form on the frontend. Shape:
  // { fields: [{ key, label, type: "text"|"select"|"number"|"toggle"|"image", options?, default?, required? }] }
  paramsSchema: jsonb("params_schema").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertModelSchema = createInsertSchema(modelsTable).omit({ id: true, createdAt: true });
export type InsertModel = z.infer<typeof insertModelSchema>;
export type Model = typeof modelsTable.$inferSelect;
