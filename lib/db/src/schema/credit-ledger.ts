import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { generationsTable } from "./generations";

// Append-only ledger of credit movements. usersTable.creditsBalance is a
// denormalized running total kept in sync whenever a row is inserted here.
export const creditLedgerTable = pgTable("credit_ledger", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(), // positive = credit granted, negative = spent
  reason: text("reason").notNull(), // signup_bonus | plan_upgrade | plan_renewal | credit_pack_purchase | generation | refund | manual_adjustment
  balanceAfter: integer("balance_after").notNull(),
  generationId: integer("generation_id").references(() => generationsTable.id),
  // Razorpay payment/order id for billing-originated entries (plan_renewal,
  // credit_pack_purchase). Lets the webhook handler dedupe if Razorpay
  // redelivers the same event — never grant credits twice for one payment.
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreditLedgerSchema = createInsertSchema(creditLedgerTable).omit({ id: true, createdAt: true });
export type InsertCreditLedger = z.infer<typeof insertCreditLedgerSchema>;
export type CreditLedgerEntry = typeof creditLedgerTable.$inferSelect;
