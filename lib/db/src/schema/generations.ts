import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { modelsTable } from "./models";

export const generationsTable = pgTable("generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  modelId: integer("model_id").notNull().references(() => modelsTable.id),
  prompt: text("prompt").notNull(),
  params: jsonb("params").notNull(), // resolved params sent to the provider (post prompt-enhancement)
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  outputType: text("output_type").notNull(), // image | video | audio
  outputUrls: text("output_urls").array().notNull().default([]),
  creditsCharged: integer("credits_charged").notNull().default(0),
  usedOwnKey: boolean("used_own_key").notNull().default(false),
  isProviderHosted: boolean("is_provider_hosted").notNull().default(false),
  providerTaskId: text("provider_task_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ id: true, createdAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
