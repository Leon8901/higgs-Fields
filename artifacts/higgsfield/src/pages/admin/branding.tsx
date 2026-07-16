import { useState, useEffect } from "react";
import { AdminShell } from "./shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAdminSettings,
  useUpdateAdminSettings,
  useImportAdminAsset,
  useGetAdminSettingsHealth,
  getGetAdminSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Save, RotateCcw, Upload, Link2, Monitor, Smartphone,
  CheckCircle2, AlertCircle, Loader2, Info, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tab definitions ─────────────────────────────────────────────────────────
type TabId = "brand-identity" | "logos-icons" | "theme" | "site-settings" | "content";

interface TabDef {
  id: TabId;
  label: string;
  keys: string[];
}

const TABS: TabDef[] = [
  {
    id: "brand-identity",
    label: "Brand Identity",
    keys: ["site_name", "site_tagline"],
  },
  {
    id: "logos-icons",
    label: "Logos & Icons",
    keys: ["logo_url", "favicon_url"],
  },
  {
    id: "theme",
    label: "Theme",
    keys: ["theme_color"],
  },
  {
    id: "site-settings",
    label: "Site Settings",
    keys: ["maintenance_mode", "maintenance_message", "registration_enabled", "platform_generation_enabled"],
  },
  {
    id: "content",
    label: "Content",
    keys: ["homepage_banner", "announcement"],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function FieldLabel({ label, description }: { label: string; description?: string }) {
  return (
    <div className="mb-1.5">
      <label className="text-sm font-semibold text-white/80">{label}</label>
      {description && <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{description}</p>}
    </div>
  );
}

// ── Asset paste-URL input ────────────────────────────────────────────────────
function AssetPasteInput({
  label,
  description,
  settingKey,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  settingKey: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [fetchMode, setFetchMode] = useState(false);
  const importAsset = useImportAdminAsset();
  const { toast } = useToast();

  const handleFetch = async () => {
    if (!urlInput.trim()) return;
    try {
      const result = await importAsset.mutateAsync({ data: { url: urlInput.trim() } });
      onChange(result.path);
      setUrlInput("");
      setFetchMode(false);
      toast({ title: "Asset imported", description: "Image fetched and saved to our storage." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: err?.data?.error ?? err?.message ?? "Could not fetch that URL.",
      });
    }
  };

  return (
    <div className="space-y-2">
      <FieldLabel label={label} description={description} />

      {/* Current value preview */}
      {value && (
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-lg p-2">
          {settingKey === "favicon_url" ? (
            <img src={value} alt="Favicon" className="w-6 h-6 rounded object-contain bg-white/10" />
          ) : (
            <img src={value} alt="Logo" className="h-8 max-w-[80px] rounded object-contain bg-white/10" />
          )}
          <span className="text-xs text-white/40 font-mono truncate flex-1">{value}</span>
          <button
            onClick={() => onChange("")}
            className="text-white/30 hover:text-white/60 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toggle between paste-URL and clear */}
      {!fetchMode ? (
        <button
          onClick={() => setFetchMode(true)}
          className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors"
        >
          <Link2 className="w-3 h-3" />
          Paste image URL to import
        </button>
      ) : (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="bg-white/[0.04] border-white/10 text-white text-sm h-9 flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); if (e.key === "Escape") setFetchMode(false); }}
            autoFocus
          />
          <Button
            onClick={handleFetch}
            disabled={!urlInput.trim() || importAsset.isPending}
            size="sm"
            className="bg-primary text-black font-semibold shrink-0"
          >
            {importAsset.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Fetch"}
          </Button>
          <Button
            onClick={() => { setFetchMode(false); setUrlInput(""); }}
            size="sm"
            variant="ghost"
            className="text-white/40 hover:text-white/60 shrink-0"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div>
        <div className="text-sm font-semibold text-white/80">{label}</div>
        {description && <div className="text-xs text-white/35 mt-0.5 leading-relaxed">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none",
          checked ? "bg-primary" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}

// ── Tab panels ───────────────────────────────────────────────────────────────
function BrandIdentityTab({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel
          label="Site Name"
          description="Displayed in the browser tab, emails, and the site header."
        />
        <Input
          value={String(values["site_name"] ?? "")}
          onChange={(e) => onChange("site_name", e.target.value)}
          placeholder="My Platform"
          className="bg-white/[0.04] border-white/10 text-white"
        />
      </div>
      <div>
        <FieldLabel
          label="Site Tagline"
          description="Short one-liner shown below the site name on the homepage hero."
        />
        <Input
          value={String(values["site_tagline"] ?? "")}
          onChange={(e) => onChange("site_tagline", e.target.value)}
          placeholder="Generate stunning AI content"
          className="bg-white/[0.04] border-white/10 text-white"
        />
      </div>
    </div>
  );
}

function LogosTab({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-8">
      <AssetPasteInput
        label="Logo"
        description="Shown in the top navigation. Recommended: SVG or PNG, at least 200 px wide."
        settingKey="logo_url"
        value={String(values["logo_url"] ?? "")}
        onChange={(v) => onChange("logo_url", v)}
      />
      <AssetPasteInput
        label="Favicon"
        description="Browser tab icon. Best results with a square PNG or ICO, 32×32 or 64×64 px."
        settingKey="favicon_url"
        value={String(values["favicon_url"] ?? "")}
        onChange={(v) => onChange("favicon_url", v)}
      />
    </div>
  );
}

function ThemeTab({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
}) {
  const color = String(values["theme_color"] ?? "#a855f7");
  return (
    <div className="space-y-4">
      <FieldLabel
        label="Primary Color"
        description="Drives button backgrounds, active states, focus rings, and accent elements throughout the app. Use a vivid, accessible hue."
      />
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg border border-white/10 shrink-0"
          style={{ background: color }}
        />
        <Input
          value={color}
          onChange={(e) => onChange("theme_color", e.target.value)}
          placeholder="#a855f7"
          className="bg-white/[0.04] border-white/10 text-white font-mono w-40"
          maxLength={9}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => onChange("theme_color", e.target.value)}
          className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent p-0.5"
        />
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"].map((c) => (
          <button
            key={c}
            onClick={() => onChange("theme_color", c)}
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-all",
              color === c ? "border-white scale-110" : "border-transparent hover:border-white/40",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

function SiteSettingsTab({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-1">
      <Toggle
        checked={Boolean(values["maintenance_mode"])}
        onChange={(v) => onChange("maintenance_mode", v)}
        label="Maintenance Mode"
        description="Replaces the app with a maintenance page for non-owner users."
      />
      {Boolean(values["maintenance_mode"]) && (
        <div className="py-4 pl-2">
          <FieldLabel label="Maintenance Message" />
          <Textarea
            value={String(values["maintenance_message"] ?? "")}
            onChange={(e) => onChange("maintenance_message", e.target.value)}
            rows={3}
            placeholder="We're upgrading the platform. Back soon!"
            className="bg-white/[0.04] border-white/10 text-white text-sm resize-none"
          />
        </div>
      )}
      <Toggle
        checked={Boolean(values["registration_enabled"])}
        onChange={(v) => onChange("registration_enabled", v)}
        label="User Registration"
        description="Allow new users to sign up. Disable to make the platform invite-only."
      />
      <Toggle
        checked={Boolean(values["platform_generation_enabled"])}
        onChange={(v) => onChange("platform_generation_enabled", v)}
        label="Platform Generation"
        description="Allow platform-provided API keys to service generation requests. Disable to require all users to bring their own keys."
      />
    </div>
  );
}

function ContentTab({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel
          label="Homepage Banner"
          description="Optional banner HTML displayed at the top of the homepage. Supports basic HTML tags."
        />
        <Textarea
          value={String(values["homepage_banner"] ?? "")}
          onChange={(e) => onChange("homepage_banner", e.target.value)}
          rows={3}
          placeholder="<b>New!</b> Video generation is now live."
          className="bg-white/[0.04] border-white/10 text-white text-sm resize-none font-mono"
        />
      </div>
      <div>
        <FieldLabel
          label="Announcement"
          description="Short text shown in a dismissible notice bar for signed-in users."
        />
        <Textarea
          value={String(values["announcement"] ?? "")}
          onChange={(e) => onChange("announcement", e.target.value)}
          rows={2}
          placeholder="Platform maintenance scheduled for Sunday 2am UTC."
          className="bg-white/[0.04] border-white/10 text-white text-sm resize-none"
        />
      </div>
    </div>
  );
}

// ── Live preview rail ────────────────────────────────────────────────────────
function LivePreview({ values }: { values: Record<string, unknown> }) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const siteName = String(values["site_name"] ?? "My Platform");
  const tagline = String(values["site_tagline"] ?? "Generate stunning AI content");
  const logoUrl = String(values["logo_url"] ?? "");
  const color = String(values["theme_color"] ?? "#a855f7");

  return (
    <div className="bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Live Preview</span>
        <div className="flex gap-1">
          {(["desktop", "mobile"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "p-1.5 rounded transition-colors",
                view === v ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50",
              )}
            >
              {v === "desktop" ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "mx-auto transition-all duration-300",
          view === "desktop" ? "w-full" : "w-48",
        )}
      >
        <div className="bg-[#0d0d0d] p-4 space-y-3">
          {/* Fake nav */}
          <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-1.5">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-4 w-auto object-contain" />
            ) : (
              <div
                className="w-4 h-4 rounded"
                style={{ background: color }}
              />
            )}
            <span className="text-[10px] font-black text-white truncate">{siteName}</span>
            <div className="ml-auto">
              <div className="w-4 h-4 rounded-full" style={{ background: color }} />
            </div>
          </div>

          {/* Fake hero */}
          <div className="bg-[#141414] rounded-lg p-3 space-y-1.5">
            <div className="text-[11px] font-black text-white leading-tight">{siteName}</div>
            <div className="text-[9px] text-white/40 leading-relaxed">{tagline}</div>
            <div
              className="mt-1.5 px-3 py-1 rounded text-[9px] font-bold text-black w-fit"
              style={{ background: color }}
            >
              Get started
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Health widget ────────────────────────────────────────────────────────────
function HealthWidget() {
  const { data: health, isLoading } = useGetAdminSettingsHealth();

  return (
    <div className="bg-[#111] border border-white/[0.07] rounded-xl p-4">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Platform Status</h3>
      {isLoading ? (
        <div className="text-xs text-white/30">Checking…</div>
      ) : !health ? (
        <div className="text-xs text-red-400">Health check failed</div>
      ) : (
        <div className="space-y-2">
          {health.checks?.map((check) => (
            <div key={check.name} className="flex items-center gap-2">
              {check.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              )}
              <span className="text-xs text-white/60">{check.name}</span>
              {!check.ok && <span className="text-xs text-red-400/70">{check.message}</span>}
            </div>
          ))}
          {health.lastSavedAt && (
            <div className="flex items-center gap-2 pt-1 mt-1 border-t border-white/[0.05]">
              <Info className="w-3 h-3 text-white/25 shrink-0" />
              <span className="text-xs text-white/30">
                Last saved {new Date(health.lastSavedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminBranding() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetAdminSettings();
  const updateSettings = useUpdateAdminSettings();

  // All dirty values across all 5 tabs — one shared dirty-field map
  const [dirty, setDirty] = useState<Record<string, unknown>>({});
  const [tab, setTab] = useState<TabId>("brand-identity");

  // Seed dirty from server on first load (but don't override user edits)
  const savedValues: Record<string, unknown> = {};
  if (settings) {
    for (const s of settings) {
      savedValues[s.key] = s.value;
    }
  }

  function current(key: string): unknown {
    return key in dirty ? dirty[key] : savedValues[key] ?? "";
  }

  const allValues: Record<string, unknown> = {};
  const allKeys = TABS.flatMap((t) => t.keys);
  for (const k of allKeys) allValues[k] = current(k);

  function setField(key: string, value: unknown) {
    setDirty((prev) => ({ ...prev, [key]: value }));
  }

  const isDirty = Object.keys(dirty).length > 0;

  async function handleSave() {
    if (!isDirty) return;
    try {
      await updateSettings.mutateAsync({ data: dirty });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
      setDirty({});
      toast({ title: "Settings saved" });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err?.data?.error ?? err?.message ?? "Could not save settings.",
      });
    }
  }

  function handleReset() {
    setDirty({});
    toast({ title: "Changes discarded" });
  }

  if (isLoading) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  const tabKeys = TABS.find((t) => t.id === tab)?.keys ?? [];
  const tabValues: Record<string, unknown> = {};
  for (const k of tabKeys) tabValues[k] = current(k);

  return (
    <AdminShell>
      <div className="flex h-full">
        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.07]">
            <div>
              <h1 className="text-xl font-black text-white">Site Branding</h1>
              <p className="text-xs text-white/35 mt-0.5">All 5 tabs share a single save action</p>
            </div>
            {isDirty && (
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-xs">Unsaved changes</Badge>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.07] px-8 gap-1">
            {TABS.map((t) => {
              const hasDirty = t.keys.some((k) => k in dirty);
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors relative",
                    tab === t.id
                      ? "border-primary text-primary"
                      : "border-transparent text-white/40 hover:text-white/70",
                  )}
                >
                  {t.label}
                  {hasDirty && (
                    <span className="absolute top-2 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-8">
            {tab === "brand-identity" && (
              <BrandIdentityTab values={tabValues} onChange={setField} />
            )}
            {tab === "logos-icons" && (
              <LogosTab values={tabValues} onChange={setField} />
            )}
            {tab === "theme" && (
              <ThemeTab values={tabValues} onChange={setField} />
            )}
            {tab === "site-settings" && (
              <SiteSettingsTab values={tabValues} onChange={setField} />
            )}
            {tab === "content" && (
              <ContentTab values={tabValues} onChange={setField} />
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="w-72 shrink-0 border-l border-white/[0.07] p-5 space-y-4 overflow-auto">
          <LivePreview values={allValues} />
          <HealthWidget />

          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Settings Info</h3>
            <p className="text-xs text-white/35 leading-relaxed">
              Changes across all tabs are batched into one save. The floating bar below shows when you have unsaved edits.
            </p>
          </div>
        </div>
      </div>

      {/* Floating save bar */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1a1a1a] border border-white/10 rounded-2xl px-5 py-3 shadow-2xl shadow-black/60">
          <span className="text-sm text-white/60">
            {Object.keys(dirty).length} field{Object.keys(dirty).length !== 1 ? "s" : ""} changed
          </span>
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white/80 h-8"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Discard
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            size="sm"
            className="bg-primary text-black font-bold h-8"
          >
            {updateSettings.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save all
          </Button>
        </div>
      )}
    </AdminShell>
  );
}
