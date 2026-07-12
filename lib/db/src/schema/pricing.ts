import { pgTable, serial, text, real, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pricingPlansTable = pgTable("pricing_plans", {
  id: serial("id").primaryKey(),
  planKey: text("plan_key").notNull().unique(), // starter | plus | ultra — matches users.planKey
  name: text("name").notNull(),
  price: real("price").notNull(),
  yearlyPrice: real("yearly_price").notNull(),
  creditsPerMonth: integer("credits_per_month").notNull().default(0),
  description: text("description").notNull(),
  features: text("features").array().notNull().default([]),
  isPopular: boolean("is_popular").notNull().default(false),
  ctaLabel: text("cta_label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Razorpay Plan ids (created lazily via the API the first time someone
  // subscribes — Razorpay has no concept of a plan until it's created
  // through their API/dashboard). Null until Razorpay credentials are
  // configured AND at least one subscribe attempt has run for this plan.
  razorpayPlanIdMonthly: text("razorpay_plan_id_monthly"),
  razorpayPlanIdYearly: text("razorpay_plan_id_yearly"),
});

export const insertPricingPlanSchema = createInsertSchema(pricingPlansTable).omit({ id: true, createdAt: true });
export type InsertPricingPlan = z.infer<typeof insertPricingPlanSchema>;
export type PricingPlan = typeof pricingPlansTable.$inferSelect;
