import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// BYOK: user-supplied provider API keys. `encryptedKey` is ciphertext produced
// by lib/crypto derived from SESSION_SECRET (AES-256-GCM). Never store plaintext.
// `status`/`validatedAt` reflect the result of validating the key against the
// provider before it was saved (see routes/api-keys.ts) — never re-derived
// client-side, so the UI always shows a real, server-verified state.
export const userApiKeysTable = pgTable(
  "user_api_keys",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // provider slug, e.g. "wavespeed" — matches providers.slug
    encryptedKey: text("encrypted_key").notNull(),
    lastFour: text("last_four").notNull(), // last 4 chars of the raw key, for display only
    status: text("status").notNull().default("unknown"), // valid | invalid | unknown
    validatedAt: timestamp("validated_at", { withTimezone: true }), // when `status` was last confirmed against the provider
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("user_api_keys_user_provider_idx").on(table.userId, table.provider)],
);

export const insertUserApiKeySchema = createInsertSchema(userApiKeysTable).omit({ id: true, createdAt: true, lastUsedAt: true });
export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
export type UserApiKey = typeof userApiKeysTable.$inferSelect;
