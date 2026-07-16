import { pgTable, serial, text, boolean, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
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
  description: text("description"), // short tagline shown under the provider name, e.g. "GPT-4o, DALL-E 3, Whisper"
  docsUrl: text("docs_url"), // link to the provider's API key page, e.g. "https://platform.openai.com/api-keys"
  status: text("status").notNull().default("active"), // active | disabled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  // ── Platform key management (Section 3b) ─────────────────────────────────
  // Deliberately a separate axis from `status` (which means "BYOK-enabled").
  // `platformEnabled` answers "should the platform route paid generation through
  // this provider's key?"; `status` answers "can users add their own key?".
  // Do NOT merge these flags.
  platformEnabled: boolean("platform_enabled").notNull().default(false),
  encryptedPlatformKey: text("encrypted_platform_key"), // AES-256-GCM via lib/crypto.ts
  platformKeyLastFour: text("platform_key_last_four"),
  platformKeyStatus: text("platform_key_status"), // "valid" | "invalid" | "unknown" | null
  platformKeyValidatedAt: timestamp("platform_key_validated_at", { withTimezone: true }),
  baseUrl: text("base_url"), // optional override (e.g. Azure OpenAI endpoint)
  metadata: jsonb("metadata").notNull().default({}), // flexible bag: org ID, region, etc.
  sortOrder: integer("sort_order").notNull().default(0), // display ordering on all provider pages

  // ── BYOK user-facing (Section 4) ─────────────────────────────────────────
  // Shown on the public BYOK page when status = "disabled". Falls back to a
  // generic message when null.
  unavailableMessage: text("unavailable_message"),
});

export const insertProviderSchema = createInsertSchema(providersTable).omit({ id: true, createdAt: true });
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providersTable.$inferSelect;
