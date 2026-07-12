import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// BYOK: user-supplied provider API keys. `encryptedKey` is ciphertext produced
// by lib/crypto derived from SESSION_SECRET (AES-256-GCM). Never store plaintext.
export const userApiKeysTable = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // e.g. "wavespeed"
  encryptedKey: text("encrypted_key").notNull(),
  lastFour: text("last_four").notNull(), // last 4 chars of the raw key, for display only
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const insertUserApiKeySchema = createInsertSchema(userApiKeysTable).omit({ id: true, createdAt: true, lastUsedAt: true });
export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
export type UserApiKey = typeof userApiKeysTable.$inferSelect;
