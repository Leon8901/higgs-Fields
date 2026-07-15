import { eq } from "drizzle-orm";
import { db, siteSettingsTable, settingsMetaTable } from "@workspace/db";
import { SETTINGS_REGISTRY, SETTINGS_BY_KEY, type SettingDefinition } from "@workspace/db/settingsRegistry";

// The *only* runtime read path for `site_settings`. Nothing else in this
// codebase should query that table directly — call one of the typed
// accessors below instead. The cache is version-aware (checked against
// `settings_meta.version`, bumped atomically by every PATCH), not a
// time-based TTL, so a write is visible on the very next read anywhere in
// the process.
interface Cache {
  version: number;
  values: Map<string, unknown>;
}

let cache: Cache | null = null;

function parseValue(type: SettingDefinition["type"], raw: string): unknown {
  // Every value is stored JSON-encoded regardless of type, so this is
  // always just JSON.parse — kept as its own function for clarity/future
  // per-type handling.
  void type;
  return JSON.parse(raw);
}

async function loadValues(): Promise<Map<string, unknown>> {
  const [meta] = await db.select().from(settingsMetaTable).where(eq(settingsMetaTable.id, 1));
  const version = meta?.version ?? 1;
  if (cache && cache.version === version) return cache.values;

  const rows = await db.select().from(siteSettingsTable);
  const values = new Map<string, unknown>();
  // Seed defaults first so a registry key that hasn't been persisted yet
  // (e.g. the seed script hasn't run since it was added) still resolves.
  for (const def of SETTINGS_REGISTRY) values.set(def.key, def.default);
  for (const row of rows) {
    if (!SETTINGS_BY_KEY.has(row.key)) continue; // ignore stale/unknown rows
    values.set(row.key, parseValue(row.type as SettingDefinition["type"], row.value));
  }

  cache = { version, values };
  return values;
}

async function get<T>(key: string): Promise<T> {
  const values = await loadValues();
  return values.get(key) as T;
}

export async function getSiteName(): Promise<string> {
  return get<string>("site_name");
}

export async function getSiteTagline(): Promise<string> {
  return get<string>("site_tagline");
}

export async function getLogoUrl(): Promise<string> {
  return get<string>("logo_url");
}

export async function getFaviconUrl(): Promise<string> {
  return get<string>("favicon_url");
}

export async function getThemeColor(): Promise<string> {
  return get<string>("theme_color");
}

export async function isMaintenanceModeEnabled(): Promise<boolean> {
  return get<boolean>("maintenance_mode");
}

export async function getMaintenanceMessage(): Promise<string> {
  return get<string>("maintenance_message");
}

export async function isRegistrationEnabled(): Promise<boolean> {
  return get<boolean>("registration_enabled");
}

export async function isPlatformGenerationEnabled(): Promise<boolean> {
  return get<boolean>("platform_generation_enabled");
}

export async function getDefaultCredits(): Promise<number> {
  return get<number>("default_credits");
}

export async function getDefaultModelSlug(category: "image" | "video" | "audio"): Promise<string> {
  return get<string>(`default_${category}_model_slug`);
}

export interface BannerContent {
  enabled: boolean;
  text: string;
  linkUrl?: string;
  linkLabel?: string;
}

export async function getHomepageBanner(): Promise<BannerContent> {
  return get<BannerContent>("homepage_banner");
}

export async function getAnnouncement(): Promise<BannerContent> {
  return get<BannerContent>("announcement");
}

// Flat map of every isPublic=true setting — the exact shape returned by
// `GET /settings`. Never includes `settingsVersion`.
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const values = await loadValues();
  const out: Record<string, unknown> = {};
  for (const def of SETTINGS_REGISTRY) {
    if (def.isPublic) out[def.key] = values.get(def.key);
  }
  return out;
}

// Every setting row joined with its registry metadata — used by the
// owner-only admin UI to render dynamic, labeled, categorized sections.
export async function getAdminSettings(): Promise<
  Array<{ key: string; type: string; category: string; label: string; description: string; isPublic: boolean; value: unknown }>
> {
  const values = await loadValues();
  return SETTINGS_REGISTRY.map((def) => ({
    key: def.key,
    type: def.type,
    category: def.category,
    label: def.label,
    description: def.description,
    isPublic: def.isPublic,
    value: values.get(def.key),
  }));
}

export interface SettingsUpdateError {
  key: string;
  error: string;
}

export interface SettingsUpdateResult {
  ok: boolean;
  errors: SettingsUpdateError[];
}

// Validates every field in `patch` against the registry (unknown keys and
// invalid values both abort the whole request — nothing partial is ever
// written), then writes all values plus the version bump in one
// transaction.
export async function updateSettings(patch: Record<string, unknown>): Promise<SettingsUpdateResult> {
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    return { ok: false, errors: [{ key: "_", error: "No fields provided" }] };
  }

  const errors: SettingsUpdateError[] = [];
  const normalized: Record<string, unknown> = {};

  for (const key of keys) {
    const def = SETTINGS_BY_KEY.get(key);
    if (!def) {
      errors.push({ key, error: "Unknown setting key" });
      continue;
    }
    const result = await def.validate(patch[key]);
    if (!result.ok) {
      errors.push({ key, error: result.error });
      continue;
    }
    normalized[key] = result.value;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(normalized)) {
      const def = SETTINGS_BY_KEY.get(key)!;
      await tx
        .update(siteSettingsTable)
        .set({ value: JSON.stringify(value), updatedAt: new Date() })
        .where(eq(siteSettingsTable.key, def.key));
    }
    await tx
      .update(settingsMetaTable)
      .set({ version: (await tx.select().from(settingsMetaTable).where(eq(settingsMetaTable.id, 1)))[0].version + 1 })
      .where(eq(settingsMetaTable.id, 1));
  });

  cache = null; // force a fresh read on the very next access, don't wait for a stray version match
  return { ok: true, errors: [] };
}
