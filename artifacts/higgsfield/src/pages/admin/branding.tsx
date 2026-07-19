import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Upload,
  Download,
  FileUp,
  RefreshCcw,
  Monitor,
  Smartphone,
  Database,
  HardDrive,
  X,
  RotateCcw,
  AlertCircle,
  Link2,
  Check,
  Palette,
  Copy,
  Circle,
} from "lucide-react";
import {
  useGetAdminSettings,
  useUpdateAdminSettings,
  useRequestUploadUrl,
  useGetAdminSettingsHealth,
  useImportAdminSettings,
  useResetAdminSettingsToDefaults,
  getAdminSettingsExport,
} from "@workspace/api-client-react";
import type { AdminSetting } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { AdminShell } from "./shell";

const PAGE_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  {
    key: "brand-identity",
    label: "Brand Identity",
    settingKeys: ["logo_url", "favicon_url", "site_name", "theme_color", "site_tagline", "favicon_alt_text"],
  },
  {
    key: "logos-icons",
    label: "Logos & Icons",
    settingKeys: ["logo_url", "favicon_url"],
  },
  {
    key: "theme",
    label: "Theme",
    settingKeys: ["theme_color"],
  },
  {
    key: "site-settings",
    label: "Site Settings",
    settingKeys: ["maintenance_mode", "maintenance_message", "registration_enabled", "platform_generation_enabled"],
  },
  {
    key: "content",
    label: "Content",
    settingKeys: ["homepage_banner", "announcement"],
  },
  {
    key: "preview",
    label: "Preview",
    settingKeys: [],
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ALLOWED_CATEGORIES = new Set(["branding", "access", "content"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "Never";
  const diff = Date.now() - d.getTime();
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

async function importAssetFromUrl(url: string): Promise<string> {
  const res = await fetch(`${PAGE_BASE}/api/admin/settings/import-asset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Asset import failed");
  }
  const data = (await res.json()) as { path: string };
  return data.path;
}

// ── Logo / Favicon asset card ─────────────────────────────────────────────────

function AssetCard({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasting, setPasting] = useState(false);
  const requestUploadUrl = useRequestUploadUrl();

  const previewSrc = value ? `${PAGE_BASE}${value}` : "";
  const hasValue = Boolean(value);
  const isConnected = hasValue; // green dot when set

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const res = await requestUploadUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      await fetch(res.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      onChange(`/api/storage${res.objectPath}`);
      toast({ title: "Uploaded", description: "Click Save changes to apply." });
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handlePaste() {
    if (!pasteUrl.trim()) return;
    setPasting(true);
    try {
      const path = await importAssetFromUrl(pasteUrl.trim());
      onChange(path);
      setPasteMode(false);
      setPasteUrl("");
      toast({ title: "Imported", description: "Click Save changes to apply." });
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setPasting(false);
    }
  }

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            isConnected ? "bg-green-400" : "bg-white/20",
          )}
        />
      </div>
      <p className="text-xs text-white/40 px-4 pb-3">{hint}</p>

      {/* Preview area */}
      <div className="mx-4 mb-4 rounded-lg bg-[#0a0a0a] border border-white/[0.06] flex items-center justify-center" style={{ height: 120 }}>
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={label}
            className="max-h-full max-w-full object-contain p-3"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-white/20">
            <Upload className="w-6 h-6" />
            <span className="text-xs">No image set</span>
          </div>
        )}
      </div>

      {/* Paste URL mode */}
      {pasteMode && (
        <div className="px-4 pb-3 flex gap-2">
          <Input
            placeholder="https://…/logo.png"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePaste();
              if (e.key === "Escape") { setPasteMode(false); setPasteUrl(""); }
            }}
            className="h-8 text-xs bg-white/[0.04] border-white/10 text-white"
            autoFocus
          />
          <Button size="sm" onClick={handlePaste} disabled={!pasteUrl.trim() || pasting}
            className="h-8 bg-primary text-black font-bold hover:bg-primary/90 shrink-0 px-2">
            {pasting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setPasteMode(false); setPasteUrl(""); }}
            className="h-8 text-white/40 hover:text-white shrink-0 px-2">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <Button
          type="button" variant="outline" size="sm"
          disabled={uploading || pasting}
          onClick={() => fileRef.current?.click()}
          className="h-8 text-xs border-white/20 text-white hover:bg-white/10 flex-1"
        >
          {uploading
            ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Uploading…</>
            : <><Upload className="w-3 h-3 mr-1.5" />Upload new</>}
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          disabled={uploading || pasting}
          onClick={() => setPasteMode((v) => !v)}
          className={cn(
            "h-8 text-xs border-white/20 text-white hover:bg-white/10 flex-1",
            pasteMode && "border-primary/50 text-primary",
          )}
        >
          <Link2 className="w-3 h-3 mr-1.5" />Paste URL
        </Button>
        {hasValue && (
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => onChange("")}
            className="h-8 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 shrink-0"
          >
            <X className="w-3 h-3 mr-1" />Remove
          </Button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*,.svg" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ── Brand Identity tab content ────────────────────────────────────────────────

function BrandIdentityTab({
  settings,
  draft,
  onChange,
}: {
  settings: AdminSetting[];
  draft: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const get = (key: string) => draft[key];

  const siteName = typeof get("site_name") === "string" ? (get("site_name") as string) : "";
  const themeColor = typeof get("theme_color") === "string" ? (get("theme_color") as string) : "#CEFF00";
  const tagline = typeof get("site_tagline") === "string" ? (get("site_tagline") as string) : "";
  const faviconAlt = typeof get("favicon_alt_text") === "string" ? (get("favicon_alt_text") as string) : "";
  const logoUrl = typeof get("logo_url") === "string" ? (get("logo_url") as string) : "";
  const faviconUrl = typeof get("favicon_url") === "string" ? (get("favicon_url") as string) : "";

  const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(themeColor);

  return (
    <div className="space-y-6">
      {/* Brand Assets */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3">Brand Assets</h2>
        <div className="grid grid-cols-2 gap-4">
          <AssetCard
            label="Logo"
            hint="Recommended: 512×512px"
            value={logoUrl}
            onChange={(v) => onChange("logo_url", v)}
          />
          <AssetCard
            label="Favicon"
            hint="Recommended: 32×32px"
            value={faviconUrl}
            onChange={(v) => onChange("favicon_url", v)}
          />
        </div>
      </div>

      {/* Brand Information */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3">Brand Information</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* Site Name */}
          <div>
            <Label className="text-xs font-semibold text-white/70 mb-1.5 block">
              Site Name
              <span className="block font-normal text-white/30 mt-0.5">Your site's primary name</span>
            </Label>
            <Input
              value={siteName}
              onChange={(e) => onChange("site_name", e.target.value)}
              placeholder="Enter your site name"
              className="bg-[#141414] border-white/[0.08] text-white h-9"
            />
          </div>

          {/* Theme Color */}
          <div>
            <Label className="text-xs font-semibold text-white/70 mb-1.5 block">
              Theme Color
              <span className="block font-normal text-white/30 mt-0.5">Primary brand color used across the platform</span>
            </Label>
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-lg border border-white/[0.08] shrink-0"
                style={{ backgroundColor: isValidHex ? themeColor : "transparent" }}
              />
              <Input
                value={themeColor}
                onChange={(e) => onChange("theme_color", e.target.value)}
                placeholder="#rrggbb"
                className="bg-[#141414] border-white/[0.08] text-white h-9 font-mono"
              />
              {isValidHex && (
                <button
                  onClick={() => { navigator.clipboard.writeText(themeColor); toast({ title: "Copied!" }); }}
                  className="shrink-0 p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Site Tagline */}
          <div>
            <Label className="text-xs font-semibold text-white/70 mb-1.5 block">
              Site Tagline
              <span className="block font-normal text-white/30 mt-0.5">Short description shown in headers and meta tags</span>
            </Label>
            <Input
              value={tagline}
              onChange={(e) => onChange("site_tagline", e.target.value)}
              placeholder="Enter a short tagline or description"
              className="bg-[#141414] border-white/[0.08] text-white h-9"
            />
          </div>

          {/* Favicon Alt Text */}
          <div>
            <Label className="text-xs font-semibold text-white/70 mb-1.5 block">
              Favicon Alt Text
              <span className="block font-normal text-white/30 mt-0.5">Accessibility text for the favicon</span>
            </Label>
            <Input
              value={faviconAlt}
              onChange={(e) => onChange("favicon_alt_text", e.target.value)}
              placeholder="Describe the favicon image"
              className="bg-[#141414] border-white/[0.08] text-white h-9"
            />
          </div>
        </div>
      </div>

      {/* Preview Header */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3">Preview <span className="text-white/30 font-normal">(Header)</span></h2>
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="bg-[#0a0a0a] px-4 py-3 flex items-center gap-3 border-b border-white/[0.06]">
            {logoUrl ? (
              <img src={`${PAGE_BASE}${logoUrl}`} alt={siteName} className="h-5 object-contain" />
            ) : (
              <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                <div className="w-2 h-2 bg-black rounded-sm" />
              </div>
            )}
            {siteName && <span className="font-bold text-white text-sm">{siteName}</span>}
            <div className="flex items-center gap-4 ml-2">
              {["Explore", "Image", "Video", "Audio", "Pricing"].map((l) => (
                <span key={l} className="text-xs text-white/40">{l}</span>
              ))}
            </div>
            <div className="ml-auto">
              <div
                className="px-3 py-1 rounded-lg text-xs font-bold text-black"
                style={{ backgroundColor: isValidHex ? themeColor : "#CEFF00" }}
              >
                Get Started
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Logos & Icons tab ─────────────────────────────────────────────────────────

function LogosTab({
  draft,
  onChange,
}: {
  draft: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const logoUrl = typeof draft.logo_url === "string" ? draft.logo_url : "";
  const faviconUrl = typeof draft.favicon_url === "string" ? draft.favicon_url : "";
  return (
    <div className="grid grid-cols-2 gap-4">
      <AssetCard label="Logo" hint="Recommended: 512×512px" value={logoUrl} onChange={(v) => onChange("logo_url", v)} />
      <AssetCard label="Favicon" hint="Recommended: 32×32px" value={faviconUrl} onChange={(v) => onChange("favicon_url", v)} />
    </div>
  );
}

// ── Theme tab ─────────────────────────────────────────────────────────────────

function ThemeTab({
  draft,
  onChange,
}: {
  draft: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const themeColor = typeof draft.theme_color === "string" ? draft.theme_color : "#CEFF00";
  const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(themeColor);
  return (
    <div className="max-w-sm space-y-4">
      <div>
        <Label className="text-xs font-semibold text-white/70 mb-1.5 block">
          Theme Color
          <span className="block font-normal text-white/30 mt-0.5">Primary brand color used across the platform</span>
        </Label>
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg border border-white/[0.08] shrink-0 transition-colors"
            style={{ backgroundColor: isValidHex ? themeColor : "transparent" }}
          />
          <Input
            value={themeColor}
            onChange={(e) => onChange("theme_color", e.target.value)}
            placeholder="#rrggbb"
            className="bg-[#141414] border-white/[0.08] text-white h-9 font-mono"
          />
          {isValidHex && (
            <button
              onClick={() => { navigator.clipboard.writeText(themeColor); toast({ title: "Copied!" }); }}
              className="shrink-0 p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Generic boolean/string field ──────────────────────────────────────────────

function GenericField({
  setting,
  value,
  onChange,
}: {
  setting: AdminSetting;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (setting.type === "boolean") {
    return (
      <div className="flex items-start gap-3 py-2">
        <Switch checked={Boolean(value)} onCheckedChange={onChange} className="shrink-0 mt-0.5" />
        <div>
          <Label className="text-sm font-semibold text-white">{setting.label}</Label>
          <p className="text-xs text-white/40 mt-0.5">{setting.description}</p>
        </div>
      </div>
    );
  }
  const strVal = typeof value === "string" ? value : "";
  return (
    <div className="py-2">
      <Label className="text-xs font-semibold text-white/70 mb-1.5 block">
        {setting.label}
        {setting.description && <span className="block font-normal text-white/30 mt-0.5">{setting.description}</span>}
      </Label>
      {strVal.length > 80 || setting.key.includes("message") ? (
        <Textarea value={strVal} onChange={(e) => onChange(e.target.value)} className="bg-[#141414] border-white/[0.08] text-white" rows={3} />
      ) : (
        <Input value={strVal} onChange={(e) => onChange(e.target.value)} className="bg-[#141414] border-white/[0.08] text-white h-9" />
      )}
    </div>
  );
}

// ── Site Settings tab ─────────────────────────────────────────────────────────

function SiteSettingsTab({
  settings,
  draft,
  onChange,
}: {
  settings: AdminSetting[];
  draft: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const keys = ["maintenance_mode", "maintenance_message", "registration_enabled", "platform_generation_enabled"];
  const relevant = settings.filter((s) => keys.includes(s.key));
  return (
    <div className="space-y-1 max-w-xl">
      {relevant.map((s) => (
        <div key={s.key} className="bg-[#141414] border border-white/[0.08] rounded-xl px-4">
          <GenericField setting={s} value={draft[s.key]} onChange={(v) => onChange(s.key, v)} />
        </div>
      ))}
    </div>
  );
}

// ── Content tab ───────────────────────────────────────────────────────────────

function ContentTab({
  settings,
  draft,
  onChange,
}: {
  settings: AdminSetting[];
  draft: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const relevant = settings.filter((s) => ["homepage_banner", "announcement"].includes(s.key));
  return (
    <div className="space-y-3 max-w-xl">
      {relevant.map((s) => (
        <div key={s.key} className="bg-[#141414] border border-white/[0.08] rounded-xl px-4">
          <GenericField setting={s} value={draft[s.key]} onChange={(v) => onChange(s.key, v)} />
        </div>
      ))}
    </div>
  );
}

// ── Full-width Preview tab ────────────────────────────────────────────────────

function PreviewTab({ draft }: { draft: Record<string, unknown> }) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const siteName = typeof draft.site_name === "string" ? draft.site_name : "";
  const tagline = typeof draft.site_tagline === "string" ? draft.site_tagline : "";
  const themeColor =
    typeof draft.theme_color === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(draft.theme_color)
      ? draft.theme_color
      : "#CEFF00";
  const logoUrl = typeof draft.logo_url === "string" ? draft.logo_url : "";

  const navLinks = ["Explore", "Image", "Video", "Audio", "Marketing Studio", "Presets", "Shorts", "App Gallery", "Pricing"];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Live Preview</p>
          <p className="text-xs text-white/40 mt-0.5">Reflects all unsaved edits in real time — site name, tagline, logo, theme color.</p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 border border-white/[0.06]">
          <button
            onClick={() => setViewMode("desktop")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "desktop" ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
          >
            <Monitor className="w-3.5 h-3.5" /> Desktop
          </button>
          <button
            onClick={() => setViewMode("mobile")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "mobile" ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
          >
            <Smartphone className="w-3.5 h-3.5" /> Mobile
          </button>
        </div>
      </div>

      {/* Preview frame */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[#0a0a0a]">
        <div className={cn("transition-all duration-300 mx-auto", viewMode === "mobile" ? "max-w-[390px]" : "w-full")}>
          {/* Navbar */}
          <div className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl px-4 h-14 flex items-center justify-between gap-4">
            {/* Logo + name */}
            <div className="flex items-center gap-2.5 shrink-0">
              {logoUrl ? (
                <img src={`${PAGE_BASE}${logoUrl}`} alt={siteName} className="h-6 object-contain max-w-[120px]" />
              ) : (
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: themeColor }}>
                  <div className="w-2 h-2 bg-black rounded-sm" />
                </div>
              )}
              <span className="font-bold text-white text-sm">{siteName}</span>
            </div>

            {/* Nav links — desktop only */}
            {viewMode === "desktop" && (
              <nav className="flex items-center gap-5 overflow-hidden">
                {navLinks.slice(0, 7).map((l) => (
                  <span key={l} className="text-xs text-white/50 whitespace-nowrap hover:text-white/80 transition-colors cursor-default">{l}</span>
                ))}
              </nav>
            )}

            {/* CTA */}
            <div className="flex items-center gap-3 shrink-0 ml-auto">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-black"
                style={{ backgroundColor: themeColor }}
              >
                {viewMode === "mobile" ? "Sign up" : "⚡ 50"}
              </div>
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white text-xs font-bold">
                L
              </div>
            </div>
          </div>

          {/* Hero */}
          <div className={cn("px-8 text-center flex flex-col items-center", viewMode === "mobile" ? "py-12" : "py-20")}>
            {tagline && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/40 uppercase tracking-widest mb-4">
                <span className="text-primary">✦</span> {tagline}
              </span>
            )}
            <h1 className={cn("font-black text-white leading-none mb-4", viewMode === "mobile" ? "text-4xl" : "text-6xl lg:text-7xl")}>
              {siteName}
            </h1>
            <p className={cn("text-white/50 max-w-md leading-relaxed mb-8", viewMode === "mobile" ? "text-sm" : "text-base")}>
              {tagline}
            </p>
            <div
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-black"
              style={{ backgroundColor: themeColor }}
            >
              Get Started →
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-white/25 text-center">
        This preview reflects your unsaved draft values. Save changes to apply them to the live site.
      </p>
    </div>
  );
}

function QuickStatusCard({ settings }: { settings: AdminSetting[] | undefined }) {
  function getVal(key: string) { return settings?.find((s) => s.key === key)?.value; }
  const rows = [
    { label: "Maintenance Mode", value: Boolean(getVal("maintenance_mode")), danger: true },
    { label: "Registration", value: Boolean(getVal("registration_enabled")), danger: false },
    { label: "Platform Generation", value: Boolean(getVal("platform_generation_enabled")), danger: false },
  ];
  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <h3 className="text-sm font-bold text-white mb-1">Quick Status</h3>
      <p className="text-xs text-white/40 mb-3">Overview of important settings</p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-xs text-white/60">{row.label}</span>
            <span className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full",
              row.danger
                ? row.value ? "bg-yellow-500/15 text-yellow-400" : "bg-white/[0.06] text-white/40"
                : row.value ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400",
            )}>
              {row.value ? "On" : "Off"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObjectStorageCard() {
  const { data: health, isLoading, isFetching, refetch } = useGetAdminSettingsHealth();
  const storage = health?.objectStorage;

  type DisplayState = 'loading' | 'connected' | 'disconnected' | 'warning';
  let state: DisplayState = 'loading';
  let statusLabel = 'Checking…';
  let detail: string | null = null;
  let badgeClass = 'bg-white/[0.06] text-white/40';

  if (!isLoading && storage) {
    if (storage.status === 'connected' && storage.providerHostedCount === 0) {
      state = 'connected';
      statusLabel = 'Connected';
      badgeClass = 'bg-green-500/15 text-green-400';
    } else if (storage.status === 'disconnected') {
      state = 'disconnected';
      statusLabel = 'Disconnected';
      detail = storage.message ?? null;
      badgeClass = 'bg-red-500/15 text-red-400';
    } else {
      // warning: inconclusive probe OR connected but provider-hosted assets remain
      state = 'warning';
      statusLabel = 'Warning';
      badgeClass = 'bg-yellow-500/15 text-yellow-400';
      if (storage.status === 'connected' && storage.providerHostedCount > 0) {
        detail = `Connected, but ${storage.providerHostedCount} asset${storage.providerHostedCount === 1 ? '' : 's'} still on temporary provider URLs — not yet migrated.`;
      } else {
        detail = storage.message ?? 'Could not reach a conclusive answer.';
      }
    }
  }

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-white/40" />
          <h3 className="text-sm font-bold text-white">Object Storage</h3>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
          title="Re-check now"
        >
          <RefreshCcw className={cn("w-3 h-3", isFetching && "animate-spin")} />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/60">Sidecar signing</span>
        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", badgeClass)}>
          {statusLabel}
        </span>
      </div>
      {detail && (
        <p className="text-[10px] text-white/40 mt-2 leading-relaxed break-words">
          {detail}
        </p>
      )}
    </div>
  );
}

function InfoCard({ lastSavedAt }: { lastSavedAt: Date | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Circle className="w-2.5 h-2.5 text-blue-400 fill-blue-400" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-white mb-1">Info</h3>
          <p className="text-[11px] text-white/40">Changes are saved instantly and applied across the platform.</p>
          {lastSavedAt && (
            <p className="text-[10px] text-white/30 mt-1">Last saved {relativeTime(lastSavedAt)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

function BrandingPanel() {
  const { data: settings, isLoading, refetch } = useGetAdminSettings();
  const { data: health } = useGetAdminSettingsHealth();
  const updateMutation = useUpdateAdminSettings();
  const importMutation = useImportAdminSettings();
  const resetMutation = useResetAdminSettingsToDefaults();

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("brand-identity");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const filteredSettings = (settings ?? []).filter((s) => ALLOWED_CATEGORIES.has(s.category));

  // Initialise draft from server
  useEffect(() => {
    if (!filteredSettings.length) return;
    setDraft((prev) => {
      const next: Record<string, unknown> = {};
      for (const s of filteredSettings) next[s.key] = s.value;
      return Object.keys(prev).length ? prev : next; // don't overwrite local edits on re-fetch
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    if ((health as { lastSavedAt?: string } | undefined)?.lastSavedAt && !lastSavedAt) {
      setLastSavedAt(new Date((health as { lastSavedAt: string }).lastSavedAt));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health]);

  // Ctrl+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, filteredSettings]);

  // Dirty count
  const serverMap: Record<string, unknown> = {};
  for (const s of filteredSettings) serverMap[s.key] = s.value;
  const dirtyKeys = Object.keys(draft).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(serverMap[k]));
  const dirtyCount = dirtyKeys.length;

  function onChange(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!dirtyCount || saving) return;
    setSaving(true);
    try {
      // Guard: only send keys the server recognises. If a field exists in the
      // draft but was never returned by GET /admin/settings it isn't in the
      // registry, and one unknown key fails the entire PATCH. Log loudly so
      // future orphaned-field bugs are caught immediately in the console.
      const knownKeys = new Set(Object.keys(serverMap));
      const orphans = dirtyKeys.filter((k) => !knownKeys.has(k));
      for (const k of orphans) {
        console.warn(`Field '${k}' is not a recognized setting and will not be saved`);
      }
      // API expects a flat Record<settingKey, value> — NOT an array of {key,value} objects.
      const patch: Record<string, unknown> = {};
      for (const key of dirtyKeys.filter((k) => knownKeys.has(k))) {
        patch[key] = draft[key];
      }
      await updateMutation.mutateAsync({ data: patch });
      setLastSavedAt(new Date());
      await refetch();
      setDraft({});
      toast({ title: "Saved", description: "Settings applied across the platform." });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Save failed", description, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    const reset: Record<string, unknown> = {};
    for (const s of filteredSettings) reset[s.key] = s.value;
    setDraft(reset);
    setShowDiscardConfirm(false);
    toast({ title: "Changes discarded" });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await getAdminSettingsExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "admin-settings.json"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Export failed", variant: "destructive" }); }
    finally { setExporting(false); }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await importMutation.mutateAsync({ data: parsed });
      await refetch();
      setDraft({});
      toast({ title: "Imported successfully" });
    } catch { toast({ title: "Import failed", variant: "destructive" }); }
    finally { setImporting(false); }
  }

  async function handleReset() {
    try {
      await resetMutation.mutateAsync(undefined as unknown as void);
      await refetch();
      setDraft({});
      setShowResetConfirm(false);
      toast({ title: "Reset to defaults" });
    } catch { toast({ title: "Reset failed", variant: "destructive" }); }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Palette className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Branding</h1>
              <p className="text-xs text-white/40">Manage your site identity, logos, and visual branding.</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}
              className="h-8 text-xs border-white/20 text-white/70 hover:text-white hover:bg-white/10">
              {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()} disabled={importing}
              className="h-8 text-xs border-white/20 text-white/70 hover:text-white hover:bg-white/10">
              {importing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5 mr-1.5" />}
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)}
              className="h-8 text-xs border-white/20 text-white/70 hover:text-white hover:bg-white/10">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset to defaults
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirtyCount || saving}
              className="h-8 text-xs bg-primary text-black font-bold hover:bg-primary/90 disabled:opacity-40">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-4 border-b border-white/[0.06] -mb-[1px]">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.key
                  ? "text-white border-primary"
                  : "text-white/40 border-transparent hover:text-white/70",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {activeTab === "preview" ? (
          /* Preview tab — full-width, no right rail */
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <PreviewTab draft={draft} />
          </div>
        ) : (
          <>
            {/* Main content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {activeTab === "brand-identity" && (
                <BrandIdentityTab settings={filteredSettings} draft={draft} onChange={onChange} />
              )}
              {activeTab === "logos-icons" && (
                <LogosTab draft={draft} onChange={onChange} />
              )}
              {activeTab === "theme" && (
                <ThemeTab draft={draft} onChange={onChange} />
              )}
              {activeTab === "site-settings" && (
                <SiteSettingsTab settings={filteredSettings} draft={draft} onChange={onChange} />
              )}
              {activeTab === "content" && (
                <ContentTab settings={filteredSettings} draft={draft} onChange={onChange} />
              )}
            </div>

            {/* Right rail — Quick Status + Object Storage + Info */}
            <div className="w-[260px] shrink-0 border-l border-white/[0.06] overflow-y-auto px-4 py-4 space-y-3">
              <QuickStatusCard settings={filteredSettings.length ? filteredSettings : undefined} />
              <ObjectStorageCard />
              <InfoCard lastSavedAt={lastSavedAt} />
            </div>
          </>
        )}
      </div>

      {/* Unsaved changes footer bar */}
      {dirtyCount > 0 && (
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0f0f0f] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-white">{dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}</span>
            <span className="text-xs text-white/40">You have unsaved modifications.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDiscardConfirm(true)}
              className="h-8 text-xs border-white/20 text-white/70 hover:text-white hover:bg-white/10">
              Discard changes
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}
              className="h-8 text-xs bg-primary text-black font-bold hover:bg-primary/90">
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save all changes
            </Button>
          </div>
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={importFileRef} type="file" accept=".json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />

      {/* Reset confirm */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent className="bg-[#141414] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              All settings will be reset to their original default values. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white/70 hover:text-white bg-transparent">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-red-500 text-white hover:bg-red-600">Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard confirm */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent className="bg-[#141414] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              All {dirtyCount} unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white/70 hover:text-white bg-transparent">Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard} className="bg-red-500 text-white hover:bg-red-600">Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function AdminBranding() {
  return (
    <AdminShell>
      <BrandingPanel />
    </AdminShell>
  );
}
