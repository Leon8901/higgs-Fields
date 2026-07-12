import { pgTable, serial, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One-time credit purchases (pay-as-you-go), as opposed to the recurring
// monthly/yearly subscriptions in pricing.ts. Bought via a Razorpay Order
// (not a Subscription) — no recurring billing involved.
export const creditPacksTable = pgTable("credit_packs", {
  id: serial("id").primaryKey(),
  packKey: text("pack_key").notNull().unique(),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  priceUsd: real("price_usd").notNull(),
  isPopular: boolean("is_popular").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCreditPackSchema = createInsertSchema(creditPacksTable).omit({ id: true, createdAt: true });
export type InsertCreditPack = z.infer<typeof insertCreditPackSchema>;
export type CreditPack = typeof creditPacksTable.$inferSelect;
