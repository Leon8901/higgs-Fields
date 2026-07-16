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
  Search,
  RotateCcw,
  AlertCircle,
  Link2,
  Check,
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

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// The 5 tabs and which setting keys belong in each.
// Only covers branding + access + content categories (NOT credits/defaults).
const TABS = [
  {
    key: "brand-identity",
    label: "Brand Identity",
    settingKeys: ["site_name", "site_tagline"],
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
    settingKeys: [
      "maintenance_mode",
      "maintenance_message",
      "registration_enabled",
      "platform_generation_enabled",
    ],
  },
  {
    key: "content",
    label: "Content",
    settingKeys: ["homepage_banner", "announcement"],
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ── Utility ────────────────────────────────────────────────────────────────────

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

function parseValidationErrors(err: unknown): Array<{ key: string; error: string }> {
  if (typeof err === "object" && err !== null && "data" in err) {
    const data = (err as { data: Record<string, unknown> | null }).data;
    if (data && Array.isArray(data.fields)) {
      return data.fields as Array<{ key: string; error: string }>;
    }
  }
  return [];
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

// ── Image Upload Field (file + paste URL) ─────────────────────────────────────

function ImageUploadField({
  setting,
  value,
  onChange,
}: {
  setting: AdminSetting;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasting, setPasting] = useState(false);
  const requestUploadUrl = useRequestUploadUrl();

  const currentPath = typeof value === "string" ? value : "";
  const previewSrc = currentPath ? `${PAGE_BASE}${currentPath}` : "";

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const res = await requestUploadUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const put = await fetch(res.uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
      onChange(`/api/storage${res.objectPath}`);
      toast({ title: "File uploaded", description: "Click Save changes to apply." });
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handlePasteUrl() {
    if (!pasteUrl.trim()) return;
    setPasting(true);
    try {
      const path = await importAssetFromUrl(pasteUrl.trim());
      onChange(path);
      setPasteMode(false);
      setPasteUrl("");
      toast({ title: "Image imported", description: "Click Save changes to apply." });
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setPasting(false);
    }
  }

  const hint =
    setting.key === "logo_url"
      ? "Recommended: 512×512px"
      : setting.key === "favicon_url"
        ? "Recommended: 32×32px"
        : undefined;

  return (
    <div className="py-3">
      <Label className="text-white text-sm font-semibold">{setting.label}</Label>
      {hint && <p className="text-xs text-white/40 mt-0.5">{hint}</p>}
      <p className="text-xs text-white/40 mt-0.5 mb-3">{setting.description}</p>

      {/* Preview */}
      {previewSrc && (
        <div className="mb-3 w-20 h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
          <img
            src={previewSrc}
            alt={setting.label}
            className="max-w-full max-h-full object-contain p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || pasting}
          onClick={() => fileInputRef.current?.click()}
          className="border-white/20 text-white hover:bg-white/10"
        >
          {uploading ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Uploading…</>
          ) : (
            <><Upload className="w-3.5 h-3.5 mr-1.5" />Upload new</>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || pasting}
          onClick={() => setPasteMode((v) => !v)}
          className={cn(
            "border-white/20 text-white hover:bg-white/10",
            pasteMode && "border-primary/50 text-primary",
          )}
        >
          <Link2 className="w-3.5 h-3.5 mr-1.5" />
          Paste URL
        </Button>

        {currentPath && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
          >
            <X className="w-3.5 h-3.5 mr-1 " />
            Remove
          </Button>
        )}
      </div>

      {pasteMode && (
        <div className="flex gap-2 max-w-lg mt-1">
          <Input
            placeholder="https://example.com/logo.png"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePasteUrl();
              if (e.key === "Escape") { setPasteMode(false); setPasteUrl(""); }
            }}
            className="bg-white/[0.04] border-white/10 text-white text-sm h-9"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handlePasteUrl}
            disabled={!pasteUrl.trim() || pasting}
            className="bg-primary text-black font-bold hover:bg-primary/90 h-9 shrink-0"
          >
            {pasting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setPasteMode(false); setPasteUrl(""); }}
            className="h-9 text-white/40 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {currentPath && (
        <p className="text-xs text-white/30 font-mono mt-2 truncate max-w-sm" title={currentPath}>
          {currentPath}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.svg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Setting Field ──────────────────────────────────────────────────────────────

function SettingField({
  setting,
  value,
  onChange,
  error,
}: {
  setting: AdminSetting;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  if (setting.key === "logo_url" || setting.key === "favicon_url") {
    return <ImageUploadField setting={setting} value={value} onChange={onChange} />;
  }

  if (setting.type === "boolean") {
    return (
      <div className="flex items-start gap-3 py-3">
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
          className="shrink-0 mt-0.5"
          aria-label={setting.label}
        />
        <div>
          <Label className="text-white text-sm font-semibold">{setting.label}</Label>
          <p className="text-xs text-white/40 mt-0.5">{setting.description}</p>
        </div>
      </div>
    );
  }

  if (
    setting.type === "json" &&
    typeof value === "object" &&
    value !== null &&
    "enabled" in value &&
    "text" in value
  ) {
    const banner = value as {
      enabled: boolean;
      text: string;
      linkUrl?: string;
      linkLabel?: string;
    };
    return (
      <div className="py-3">
        <div className="flex items-start gap-3 mb-3">
          <Switch
            checked={banner.enabled}
            onCheckedChange={(checked) => onChange({ ...banner, enabled: checked })}
            className="shrink-0 mt-0.5"
            aria-label={setting.label}
          />
          <div>
            <Label className="text-white text-sm font-semibold">{setting.label}</Label>
            <p className="text-xs text-white/40 mt-0.5">{setting.description}</p>
          </div>
        </div>
        <div className="grid gap-2 max-w-lg ml-9">
          <Input
            placeholder="Banner text"
            value={banner.text}
            onChange={(e) => onChange({ ...banner, text: e.target.value })}
            className="bg-white/[0.04] border-white/10 text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Link URL (optional)"
              value={banner.linkUrl ?? ""}
              onChange={(e) => onChange({ ...banner, linkUrl: e.target.value })}
              className="bg-white/[0.04] border-white/10 text-white"
            />
            <Input
              placeholder="Link label (optional)"
              value={banner.linkLabel ?? ""}
              onChange={(e) => onChange({ ...banner, linkLabel: e.target.value })}
              className="bg-white/[0.04] border-white/10 text-white"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  if (setting.key === "theme_color") {
    const hex = typeof value === "string" ? value : "";
    const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
    return (
      <div className="py-3">
        <Label className="text-white text-sm font-semibold">{setting.label}</Label>
        <p className="text-xs text-white/40 mt-0.5 mb-2">{setting.description}</p>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-md border border-white/20 shrink-0 transition-colors"
            style={{ backgroundColor: isValidHex ? hex : "transparent" }}
          />
          <Input
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white/[0.04] border-white/10 text-white max-w-[200px]"
            placeholder="#CEFF00"
          />
          {/* Copy hex */}
          {isValidHex && (
            <button
              onClick={() => navigator.clipboard.writeText(hex)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors font-mono"
            >
              {hex}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  // String (short or long)
  const strValue = typeof value === "string" ? value : "";
  const isLong = strValue.length > 80 || setting.key.includes("message");
  return (
    <div className="py-3">
      <Label className="text-white text-sm font-semibold">{setting.label}</Label>
      <p className="text-xs text-white/40 mt-0.5 mb-2">{setting.description}</p>
      {isLong ? (
        <Textarea
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className="bg-white/[0.04] border-white/10 text-white max-w-xl"
          rows={3}
        />
      ) : (
        <Input
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className="bg-white/[0.04] border-white/10 text-white max-w-xl"
        />
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function FieldCard({
  setting,
  value,
  isDirty,
  error,
  onChange,
}: {
  setting: AdminSetting;
  value: unknown;
  isDirty: boolean;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  return (
    <div
      className={cn(
        "border rounded-xl p-4 mb-3 transition-colors",
        isDirty
          ? "border-primary/40 bg-primary/[0.03]"
          : error
            ? "border-red-500/40 bg-red-500/[0.03]"
            : "border-white/[0.08] bg-[#141414]",
      )}
    >
      {isDirty && (
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">
            Unsaved
          </span>
        </div>
      )}
      {error && !isDirty && (
        <div className="flex items-center gap-1.5 mb-1">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
            Validation error
          </span>
        </div>
      )}
      <SettingField setting={setting} value={value} onChange={onChange} error={error} />
    </div>
  );
}

// ── Live Preview ───────────────────────────────────────────────────────────────

function LivePreviewCard({ draft }: { draft: Record<string, unknown> }) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const siteName = typeof draft.site_name === "string" ? draft.site_name : "Higgsfield AI";
  const tagline = typeof draft.site_tagline === "string" ? draft.site_tagline : "";
  const themeColor =
    typeof draft.theme_color === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(draft.theme_color)
      ? draft.theme_color
      : "#CEFF00";

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">Live Preview</h3>
          <p className="text-xs text-white/40">Real-time preview of your site</p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("desktop")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "desktop" ? "bg-white/10 text-white" : "text-white/40 hover:text-white",
            )}
            aria-label="Desktop preview"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode("mobile")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "mobile" ? "bg-white/10 text-white" : "text-white/40 hover:text-white",
            )}
            aria-label="Mobile preview"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10">
        <div
          className={cn(
            "transition-all duration-300 mx-auto",
            viewMode === "mobile" ? "max-w-[320px]" : "w-full",
          )}
        >
          {/* Nav */}
          <div className="bg-[#0a0a0a] border-b border-white/5 px-3 py-2.5 flex items-center gap-2">
            <div
              className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <div className="w-1.5 h-1.5 bg-black rounded-sm" />
            </div>
            <span className="font-bold text-white text-xs truncate">{siteName}</span>
            {viewMode === "desktop" && (
              <div className="flex items-center gap-3 ml-3">
                {["Explore", "Image", "Video"].map((l) => (
                  <span key={l} className="text-[10px] text-white/30">
                    {l}
                  </span>
                ))}
              </div>
            )}
            <div className="ml-auto">
              <div
                className="px-2 py-0.5 rounded text-[10px] font-bold text-black"
                style={{ backgroundColor: themeColor }}
              >
                Get Started
              </div>
            </div>
          </div>
          {/* Hero */}
          <div className="bg-[#0a0a0a] px-4 py-6 text-center">
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">
              The Next Generation AI Platform
            </p>
            <h2 className="text-white font-black text-sm mb-1 leading-tight">
              {siteName}
            </h2>
            <p className="text-white/40 text-[10px] line-clamp-2">{tagline}</p>
            <div
              className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 rounded-lg text-[10px] font-bold text-black"
              style={{ backgroundColor: themeColor }}
            >
              Get Started →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Platform Status ─────────────────────────────────────────────────────────────

function PlatformStatusCard({
  settings,
  health,
  healthLoading,
}: {
  settings: AdminSetting[] | undefined;
  health:
    | { database: { connected: boolean }; objectStorage: { connected: boolean } }
    | undefined;
  healthLoading: boolean;
}) {
  function getVal(key: string) {
    return settings?.find((s) => s.key === key)?.value;
  }

  const statusRows = [
    { label: "Maintenance Mode", value: Boolean(getVal("maintenance_mode")), invert: true },
    { label: "Registration", value: Boolean(getVal("registration_enabled")), invert: false },
    {
      label: "Platform Generation",
      value: Boolean(getVal("platform_generation_enabled")),
      invert: false,
    },
  ];

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <h3 className="text-sm font-bold text-white mb-3">Quick Status</h3>
      <p className="text-xs text-white/40 mb-3">Overview of important settings</p>
      <div className="space-y-2.5">
        {statusRows.map((row) => {
          const isOn = row.invert ? !row.value : row.value;
          return (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-xs text-white/60">{row.label}</span>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  row.label === "Maintenance Mode"
                    ? row.value
                      ? "bg-yellow-500/15 text-yellow-400"
                      : "bg-white/[0.06] text-white/40"
                    : row.value
                      ? "bg-green-500/15 text-green-400"
                      : "bg-red-500/15 text-red-400",
                )}
              >
                {row.label === "Maintenance Mode"
                  ? row.value
                    ? "On"
                    : "Off"
                  : row.value
                    ? "On"
                    : "Off"}
              </span>
            </div>
          );
        })}

        <div className="h-px bg-white/[0.06] my-1" />

        {healthLoading ? (
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Checking…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-white/40" />
                <span className="text-xs text-white/60">Database</span>
              </div>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  health?.database.connected
                    ? "bg-green-500/15 text-green-400"
                    : "bg-red-500/15 text-red-400",
                )}
              >
                {health?.database.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3 h-3 text-white/40" />
                <span className="text-xs text-white/60">Object Storage</span>
              </div>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  health?.objectStorage.connected
                    ? "bg-green-500/15 text-green-400"
                    : "bg-red-500/15 text-red-400",
                )}
              >
                {health?.objectStorage.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </>
        )}
      </div>
      <p className="text-[10px] text-white/30 mt-3">
        Changes are saved instantly and applied across the platform.
      </p>
    </div>
  );
}

function SettingsInfoCard({ lastSavedAt }: { lastSavedAt: Date | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <h3 className="text-sm font-bold text-white mb-3">Info</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Last saved</span>
          <span className="text-xs text-white/80 font-medium">{relativeTime(lastSavedAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Last updated by</span>
          <span className="text-xs text-white/80 font-medium">Owner</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Branding Panel ────────────────────────────────────────────────────────

function BrandingPanel() {
  const { data: settings, isLoading, refetch } = useGetAdminSettings();
  const { data: health, isLoading: healthLoading } = useGetAdminSettingsHealth();
  const updateMutation = useUpdateAdminSettings();
  const importMutation = useImportAdminSettings();
  const resetMutation = useResetAdminSettingsToDefaults();

  const [savedValues, setSavedValues] = useState<Record<string, unknown>>({});
  const [dirtyFields, setDirtyFields] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("brand-identity");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSavingState, setIsSavingState] = useState(false);
  const isSavingRef = useRef(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorBanner, setErrorBanner] = useState<Array<{ key: string; label: string; error: string }>>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<Record<string, unknown> | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Only show settings from branding+access+content categories (not credits/defaults)
  const ALLOWED_CATEGORIES = new Set(["branding", "access", "content"]);
  const filteredSettings = (settings ?? []).filter((s) => ALLOWED_CATEGORIES.has(s.category));

  useEffect(() => {
    if (!filteredSettings.length) return;
    const initial: Record<string, unknown> = {};
    for (const s of filteredSettings) initial[s.key] = s.value;
    setSavedValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    if (health?.lastSavedAt && !lastSavedAt) {
      setLastSavedAt(new Date(health.lastSavedAt as string));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health]);

  useEffect(() => {
    if (undoSecondsLeft <= 0) {
      if (undoSnapshot) setUndoSnapshot(null);
      return;
    }
    const id = setTimeout(() => setUndoSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [undoSecondsLeft, undoSnapshot]);

  useEffect(() => {
    const hasDirty = Object.keys(dirtyFields).length > 0;
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyFields]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (Object.keys(dirtyFields).length > 0) handleSave();
        return;
      }
      if (
        e.key === "/" &&
        document.activeElement &&
        !["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement).tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyFields]);

  const currentValues = useCallback(
    (key: string) => (key in dirtyFields ? dirtyFields[key] : savedValues[key]),
    [dirtyFields, savedValues],
  );

  const draftForPreview: Record<string, unknown> = { ...savedValues, ...dirtyFields };

  // Build map: settingKey → AdminSetting
  const settingByKey = new Map<string, AdminSetting>();
  for (const s of filteredSettings) settingByKey.set(s.key, s);

  function getTabSettings(tab: (typeof TABS)[number]) {
    return tab.settingKeys
      .map((k) => settingByKey.get(k))
      .filter(Boolean) as AdminSetting[];
  }

  // Search: finds which tab the query matches and jumps to it
  function handleSearch(q: string) {
    setSearchQuery(q);
    if (q) {
      for (const tab of TABS) {
        const tabSettings = getTabSettings(tab);
        const hasMatch = tabSettings.some((s) =>
          s.label.toLowerCase().includes(q.toLowerCase()),
        );
        if (hasMatch) {
          setActiveTab(tab.key);
          break;
        }
      }
    }
  }

  function setField(key: string, value: unknown) {
    setDirtyFields((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  }

  function discardChanges() {
    setDirtyFields({});
    setFieldErrors({});
    setErrorBanner([]);
  }

  async function handleSave() {
    if (isSavingRef.current || Object.keys(dirtyFields).length === 0) return;
    isSavingRef.current = true;
    setIsSavingState(true);
    setFieldErrors({});
    setErrorBanner([]);
    try {
      const updated = await updateMutation.mutateAsync({ data: dirtyFields });
      const newSaved: Record<string, unknown> = {};
      for (const s of updated) newSaved[s.key] = s.value;
      setSavedValues((prev) => ({ ...prev, ...newSaved }));
      setDirtyFields({});
      setLastSavedAt(new Date());
      toast({ title: "✓ Settings saved" });
    } catch (err) {
      const fields = parseValidationErrors(err);
      if (fields.length > 0) {
        const errs: Record<string, string> = {};
        const banner: Array<{ key: string; label: string; error: string }> = [];
        for (const f of fields) {
          errs[f.key] = f.error;
          const s = settingByKey.get(f.key);
          banner.push({ key: f.key, label: s?.label ?? f.key, error: f.error });
        }
        setFieldErrors(errs);
        setErrorBanner(banner);
      }
      toast({ title: "Save failed — check errors above", variant: "destructive" });
    } finally {
      isSavingRef.current = false;
      setIsSavingState(false);
    }
  }

  async function handleRefresh() {
    if (Object.keys(dirtyFields).length > 0) { setShowRefreshConfirm(true); return; }
    await doRefresh();
  }

  async function doRefresh() {
    await refetch();
    setDirtyFields({});
    setFieldErrors({});
    setErrorBanner([]);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await getAdminSettingsExport();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `site-settings-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  async function processImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("File must be a flat JSON object");
      }
      const updated = await importMutation.mutateAsync({ data: parsed });
      const newSaved: Record<string, unknown> = {};
      for (const s of updated) newSaved[s.key] = s.value;
      setSavedValues((prev) => ({ ...prev, ...newSaved }));
      setDirtyFields({});
      setLastSavedAt(new Date());
      toast({ title: "✓ Settings imported" });
    } catch (err) {
      const fields = parseValidationErrors(err);
      if (fields.length > 0) {
        const errs: Record<string, string> = {};
        const banner: Array<{ key: string; label: string; error: string }> = [];
        for (const f of fields) {
          errs[f.key] = f.error;
          const s = settingByKey.get(f.key);
          banner.push({ key: f.key, label: s?.label ?? f.key, error: f.error });
        }
        setFieldErrors(errs);
        setErrorBanner(banner);
      }
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  async function handleResetToDefaults() {
    const snapshot = { ...savedValues };
    try {
      const updated = await resetMutation.mutateAsync();
      const newSaved: Record<string, unknown> = {};
      for (const s of updated) newSaved[s.key] = s.value;
      setSavedValues(newSaved);
      setDirtyFields({});
      setLastSavedAt(new Date());
      setUndoSnapshot(snapshot);
      setUndoSecondsLeft(10);
      toast({ title: "Settings reset to defaults" });
    } catch {
      toast({ title: "Reset failed", variant: "destructive" });
    }
  }

  async function handleUndo() {
    if (!undoSnapshot) return;
    const snap = undoSnapshot;
    setUndoSnapshot(null);
    setUndoSecondsLeft(0);
    try {
      const updated = await updateMutation.mutateAsync({ data: snap });
      const newSaved: Record<string, unknown> = {};
      for (const s of updated) newSaved[s.key] = s.value;
      setSavedValues(newSaved);
      setLastSavedAt(new Date());
      toast({ title: "✓ Settings restored" });
    } catch {
      toast({ title: "Undo failed", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  const dirtyKeys = Object.keys(dirtyFields);
  const hasDirty = dirtyKeys.length > 0;
  const dirtyLabels = dirtyKeys
    .map((k) => settingByKey.get(k)?.label ?? k)
    .join(", ");

  const activeTabDef = TABS.find((t) => t.key === activeTab)!;
  const activeTabSettings = getTabSettings(activeTabDef).filter((s) => {
    if (!searchQuery) return true;
    return s.label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Count dirty fields per tab (for the tab indicator)
  function tabDirtyCount(tab: (typeof TABS)[number]) {
    return tab.settingKeys.filter((k) => k in dirtyFields).length;
  }

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">Branding</h1>
        <p className="text-sm text-white/50 mt-1">
          Manage your site identity, logos, and visual branding.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-3 bg-[#141414] border border-white/[0.08] rounded-xl">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search settings… (/)"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            aria-label="Search settings"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
              aria-label="Clear search"
            >
              <X className="w-3 h-3 text-white/40" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isSavingState || exporting}
            className="border-white/15 text-white/80 hover:bg-white/10"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span className="ml-1.5">Export</span>
          </Button>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file?.name.endsWith(".json")) processImportFile(file);
            }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => importFileRef.current?.click()}
              disabled={importing}
              className={cn(
                "border-white/15 text-white/80 hover:bg-white/10",
                isDragOver && "border-primary text-primary",
              )}
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
              <span className="ml-1.5">Import</span>
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processImportFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isSavingState || importing}
            className="border-white/15 text-white/80 hover:bg-white/10"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span className="ml-1.5">Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasDirty || isSavingState}
            className="bg-primary text-black font-bold hover:bg-primary/90"
          >
            {isSavingState ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving…</>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {errorBanner.length > 0 && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-400">
              {errorBanner.length} field{errorBanner.length > 1 ? "s" : ""} failed validation
            </p>
            <button onClick={() => setErrorBanner([])} className="ml-auto shrink-0">
              <X className="w-4 h-4 text-red-400/60 hover:text-red-400" />
            </button>
          </div>
          <div className="space-y-1 ml-6">
            {errorBanner.map((e) => (
              <p key={e.key} className="text-xs text-red-300">
                {e.label}: {e.error}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Main layout: tabs + content + right rail */}
      <div className="lg:grid lg:grid-cols-[1fr_300px] gap-6">
        <div>
          {/* Tabs */}
          <div className="border-b border-white/[0.08] mb-5">
            <div className="flex gap-0 overflow-x-auto">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const dirty = tabDirtyCount(tab);
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative",
                      isActive
                        ? "border-primary text-white"
                        : "border-transparent text-white/40 hover:text-white/70 hover:border-white/20",
                    )}
                  >
                    {tab.label}
                    {dirty > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-black text-[9px] font-black">
                        {dirty}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="max-w-[900px]">
            {activeTabSettings.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-sm">
                {searchQuery ? "No settings match your search in this tab." : "No settings here."}
              </div>
            ) : (
              activeTabSettings.map((s) => (
                <FieldCard
                  key={s.key}
                  setting={s}
                  value={currentValues(s.key)}
                  isDirty={s.key in dirtyFields}
                  error={fieldErrors[s.key]}
                  onChange={(v) => setField(s.key, v)}
                />
              ))
            )}

            {/* Danger Zone — only on Site Settings tab */}
            {activeTab === "site-settings" && !searchQuery && (
              <div className="border border-red-500/30 rounded-xl p-5 mt-6">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider">
                    Danger Zone
                  </h2>
                </div>
                <p className="text-xs text-white/40 mb-4">
                  Destructive actions. You'll have 10 seconds to undo.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isSavingState || resetMutation.isPending}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Reset to defaults
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4 mt-2">
          <LivePreviewCard draft={draftForPreview} />
          <PlatformStatusCard
            settings={settings}
            health={health}
            healthLoading={healthLoading}
          />
          <SettingsInfoCard lastSavedAt={lastSavedAt} />
        </div>
      </div>

      {/* Floating save bar */}
      {hasDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-2xl shadow-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {dirtyKeys.length} unsaved change{dirtyKeys.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-white/40 truncate">Edited: {dirtyLabels}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={discardChanges}
                disabled={isSavingState}
                className="text-white/60 hover:text-white"
              >
                Discard changes
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSavingState}
                className="bg-primary text-black font-bold hover:bg-primary/90"
              >
                {isSavingState ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
                ) : (
                  "Save all changes"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Undo toast */}
      {undoSnapshot && undoSecondsLeft > 0 && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-xl shadow-xl px-4 py-3 flex items-center gap-4">
            <span className="text-sm text-white">Settings reset to defaults</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              Undo ({undoSecondsLeft}s)
            </Button>
          </div>
        </div>
      )}

      {/* Confirm dialogs */}
      <AlertDialog open={showRefreshConfirm} onOpenChange={setShowRefreshConfirm}>
        <AlertDialogContent className="bg-[#1a1a1a] border-white/15">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Discard unsaved changes and reload?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              You have {dirtyKeys.length} unsaved change{dirtyKeys.length > 1 ? "s" : ""} that will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 text-white/70 hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowRefreshConfirm(false); doRefresh(); }}
              className="bg-white text-black hover:bg-white/90"
            >
              Reload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent className="bg-[#1a1a1a] border-white/15">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Reset all settings to their defaults?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This overwrites every setting with its registry default. You'll have 10 seconds to undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 text-white/70 hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowResetConfirm(false); handleResetToDefaults(); }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Reset to defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminBranding() {
  return (
    <AdminShell>
      <BrandingPanel />
    </AdminShell>
  );
}
