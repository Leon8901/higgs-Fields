import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { modelsTable } from "./schema/models";

// ── Configuration Registry ──────────────────────────────────────────────────
// The single source of truth for every site setting: key, type, category,
// default value, public/private visibility, human-readable description, and
// validation. Consumed by the seed script (insert-if-missing), the PATCH
// /admin/settings handler (allow-list + per-key validation), and the admin UI
// (labels/descriptions/categories, via GET /admin/settings). No other file
// should hand-maintain a second copy of this metadata.

export type SettingType = "string" | "boolean" | "number" | "json";

export type ValidationResult = { ok: true; value: unknown } | { ok: false; error: string };

export interface SettingDefinition {
  key: string;
  type: SettingType;
  category: string;
  label: string;
  description: string;
  isPublic: boolean;
  default: unknown;
  // Validates + normalizes a raw incoming value (already JSON-parsed from the
  // request body). Returning `ok: false` aborts the *entire* PATCH request.
  validate: (value: unknown) => Promise<ValidationResult>;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Logo/favicon must point at storage we own (our own relative path, e.g. the
// static /logo.svg asset or an /api/storage/objects/... upload) — never a
// raw third-party URL. Callers are expected to have already run pasted
// external URLs through the download-and-reupload flow before this runs.
async function validateOwnedAssetPath(value: unknown): Promise<ValidationResult> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, error: "must be a non-empty string" };
  }
  if (!value.startsWith("/")) {
    return {
      ok: false,
      error: "must be a path to owned storage (upload the file, or provide a URL to fetch and re-host it), not a raw external URL",
    };
  }
  return { ok: true, value };
}

function stringValidator(opts: { maxLength?: number; allowEmpty?: boolean } = {}) {
  return async (value: unknown): Promise<ValidationResult> => {
    if (typeof value !== "string") return { ok: false, error: "must be a string" };
    if (!opts.allowEmpty && value.trim().length === 0) return { ok: false, error: "must not be empty" };
    if (opts.maxLength && value.length > opts.maxLength) {
      return { ok: false, error: `must be ${opts.maxLength} characters or fewer` };
    }
    return { ok: true, value };
  };
}

async function booleanValidator(value: unknown): Promise<ValidationResult> {
  if (typeof value !== "boolean") return { ok: false, error: "must be true or false" };
  return { ok: true, value };
}

function nonNegativeIntValidator() {
  return async (value: unknown): Promise<ValidationResult> => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return { ok: false, error: "must be a non-negative integer" };
    }
    return { ok: true, value };
  };
}

function defaultModelSlugValidator(category: "image" | "video" | "audio") {
  return async (value: unknown): Promise<ValidationResult> => {
    if (value === "" || value === null) return { ok: true, value: "" };
    if (typeof value !== "string") return { ok: false, error: "must be a model slug string" };
    const [model] = await db
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.modelId, value), eq(modelsTable.category, category)));
    if (!model) return { ok: false, error: `no ${category} model with slug "${value}" exists` };
    if (!model.isActive) return { ok: false, error: `model "${value}" is disabled and can't be set as the default` };
    return { ok: true, value };
  };
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

async function themeColorValidator(value: unknown): Promise<ValidationResult> {
  // eslint-disable-next-line no-useless-escape
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    return { ok: false, error: "must be a hex color, e.g. #CEFF00" };
  }
  return { ok: true, value };
}

interface BannerShape {
  enabled: boolean;
  text: string;
  linkUrl?: string;
  linkLabel?: string;
}

function bannerValidator(fieldName: string) {
  return async (value: unknown): Promise<ValidationResult> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, error: `${fieldName} must be a JSON object` };
    }
    const v = value as Record<string, unknown>;
    if (typeof v.enabled !== "boolean") return { ok: false, error: `${fieldName}.enabled must be a boolean` };
    if (typeof v.text !== "string") return { ok: false, error: `${fieldName}.text must be a string` };
    if (v.linkUrl !== undefined && v.linkUrl !== "" && !isValidUrl(String(v.linkUrl))) {
      return { ok: false, error: `${fieldName}.linkUrl must be a valid http(s) URL` };
    }
    if (v.linkLabel !== undefined && typeof v.linkLabel !== "string") {
      return { ok: false, error: `${fieldName}.linkLabel must be a string` };
    }
    const normalized: BannerShape = {
      enabled: v.enabled,
      text: v.text,
      linkUrl: typeof v.linkUrl === "string" ? v.linkUrl : "",
      linkLabel: typeof v.linkLabel === "string" ? v.linkLabel : "",
    };
    return { ok: true, value: normalized };
  };
}

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    key: "site_name",
    type: "string",
    category: "branding",
    label: "Site name",
    description: "Shown in the nav, page titles, and social share cards.",
    isPublic: true,
    default: "Higgsfield AI",
    validate: stringValidator({ maxLength: 100 }),
  },
  {
    key: "site_tagline",
    type: "string",
    category: "branding",
    label: "Tagline",
    description: "Short description used for the meta description and social share cards.",
    isPublic: true,
    default: "The premium AI platform for filmmakers, creators, and developers.",
    validate: stringValidator({ maxLength: 300 }),
  },
  {
    key: "logo_url",
    type: "string",
    category: "branding",
    label: "Logo",
    description: "Displayed in the nav and footer.",
    isPublic: true,
    default: "/logo.svg",
    validate: validateOwnedAssetPath,
  },
  {
    key: "favicon_url",
    type: "string",
    category: "branding",
    label: "Favicon",
    description: "Browser tab icon.",
    isPublic: true,
    default: "/favicon.svg",
    validate: validateOwnedAssetPath,
  },
  {
    key: "favicon_alt_text",
    type: "string",
    category: "branding",
    label: "Favicon alt text",
    description: "Accessibility text for the favicon image.",
    isPublic: true,
    default: "",
    validate: stringValidator({ maxLength: 200, allowEmpty: true }),
  },
  {
    key: "theme_color",
    type: "string",
    category: "branding",
    label: "Theme color",
    description: "Stored for reference only — not yet wired to live re-theming.",
    isPublic: true,
    default: "#CEFF00",
    validate: themeColorValidator,
  },
  {
    key: "maintenance_mode",
    type: "boolean",
    category: "access",
    label: "Maintenance mode",
    description: "Blocks all non-owner traffic with the maintenance message below. The owner and admin/auth routes always stay reachable.",
    isPublic: true,
    default: false,
    validate: booleanValidator,
  },
  {
    key: "maintenance_message",
    type: "string",
    category: "access",
    label: "Maintenance message",
    description: "Shown to visitors while maintenance mode is on.",
    isPublic: true,
    default: "We're performing scheduled maintenance. Please check back shortly.",
    validate: stringValidator({ maxLength: 500 }),
  },
  {
    key: "registration_enabled",
    type: "boolean",
    category: "access",
    label: "Registration enabled",
    description: "Turning this off blocks new signups only — existing users are unaffected.",
    isPublic: true,
    default: true,
    validate: booleanValidator,
  },
  {
    key: "platform_generation_enabled",
    type: "boolean",
    category: "access",
    label: "Platform generation enabled",
    description: "Kill switch for generations billed to the platform's own provider keys. BYOK generations keep working when this is off.",
    isPublic: true,
    default: true,
    validate: booleanValidator,
  },
  {
    key: "default_credits",
    type: "number",
    category: "credits",
    label: "Default signup credits",
    description: "Starter credit grant for a brand new user. Public because it's shown on the sign-up screen itself.",
    isPublic: true,
    default: 50,
    validate: nonNegativeIntValidator(),
  },
  {
    key: "default_image_model_slug",
    type: "string",
    category: "defaults",
    label: "Default image model",
    description: "Pre-selected model on a fresh visit to /image.",
    isPublic: true,
    default: "",
    validate: defaultModelSlugValidator("image"),
  },
  {
    key: "default_video_model_slug",
    type: "string",
    category: "defaults",
    label: "Default video model",
    description: "Pre-selected model on a fresh visit to /video.",
    isPublic: true,
    default: "",
    validate: defaultModelSlugValidator("video"),
  },
  {
    key: "default_audio_model_slug",
    type: "string",
    category: "defaults",
    label: "Default audio model",
    description: "Pre-selected model on a fresh visit to /audio.",
    isPublic: true,
    default: "",
    validate: defaultModelSlugValidator("audio"),
  },
  {
    key: "homepage_banner",
    type: "json",
    category: "content",
    label: "Homepage announcement banner",
    description: "The dismissible bar shown at the top of every page.",
    isPublic: true,
    default: { enabled: false, text: "", linkUrl: "", linkLabel: "" } satisfies BannerShape,
    validate: bannerValidator("homepage_banner"),
  },
  {
    key: "announcement",
    type: "json",
    category: "content",
    label: "Announcement",
    description: "A second, independent announcement (e.g. for the homepage hero or a modal).",
    isPublic: true,
    default: { enabled: false, text: "", linkUrl: "", linkLabel: "" } satisfies BannerShape,
    validate: bannerValidator("announcement"),
  },
];

export const SETTINGS_BY_KEY: Map<string, SettingDefinition> = new Map(
  SETTINGS_REGISTRY.map((def) => [def.key, def]),
);

export type SettingKey =
  | "site_name"
  | "site_tagline"
  | "logo_url"
  | "favicon_url"
  | "favicon_alt_text"
  | "theme_color"
  | "maintenance_mode"
  | "maintenance_message"
  | "registration_enabled"
  | "platform_generation_enabled"
  | "default_credits"
  | "default_image_model_slug"
  | "default_video_model_slug"
  | "default_audio_model_slug"
  | "homepage_banner"
  | "announcement";
