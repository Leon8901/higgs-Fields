import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// App-side user profile, linked 1:1 to a Clerk user via clerkId.
// Created just-in-time on first authenticated request (see requireAuth middleware).
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  planKey: text("plan_key").notNull().default("free"), // free | starter | plus | ultra
  creditsBalance: integer("credits_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Razorpay billing state. All null until the user's first real checkout —
  // never populated by the old direct-grant /me/plan flow.
  razorpayCustomerId: text("razorpay_customer_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  // active | pending | halted | cancelled | completed | null (no subscription)
  subscriptionStatus: text("subscription_status"),
  billingInterval: text("billing_interval"), // monthly | yearly | null
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
