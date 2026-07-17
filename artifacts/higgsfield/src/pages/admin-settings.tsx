import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Settings,
  ShieldAlert,
  Loader2,
  Upload,
  Palette,
  Shield,
  Zap,
  SlidersHorizontal,
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
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
  Circle,
} from "lucide-react";
import {
  useGetMe,
  useGetAdminSettings,
  useUpdateAdminSettings,
  useListModels,
  useRequestUploadUrl,
  useGetAdminSettingsHealth,
  useImportAdminSettings,
  useResetAdminSettingsToDefaults,
  getAdminSettingsExport,
} from "@workspace/api-client-react";
import type { AdminSetting } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORY_LABELS: Record<string, string> = {
  branding: "Branding",
  // Display label only — underlying category key stays "access" throughout
  access: "Access & Security",
  credits: "Credits",
  defaults: "Model Defaults",
  content: "Content",
};

const SIDEBAR_ITEMS = [
  { key: "branding", label: "Branding", icon: Palette },
  { key: "access", label: "Access & Security", icon: Shield },
  { key: "credits", label: "Credits", icon: Zap },
  { key: "defaults", label: "Model Defaults", icon: SlidersHorizontal },
  { key: "content", label: "Content", icon: FileText },
] as const;

const ASSET_UPLOAD_KEYS = new Set(["logo_url", "favicon_url"]);

const MODEL_SLUG_KEYS: Record<string, "image" | "video" | "audio"> = {
  default_image_model_slug: "image",
  default_video_model_slug: "video",
  default_audio_model_slug: "audio",
};

// ── Utilities ─────────────────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────────

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
      if (!put.ok) throw new Error(`GCS upload failed: ${put.status}`);
      onChange(`/api/storage${res.objectPath}`);
      toast({ title: "File uploaded", description: "Click Save changes to apply." });
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="py-3">
      <Label className="text-white text-sm font-semibold">{setting.label}</Label>
      <p className="text-xs text-white/40 mt-0.5 mb-3">{setting.description}</p>
      <div className="flex items-center gap-4 flex-wrap">
        {previewSrc && (
          <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={previewSrc}
              alt={setting.label}
              className="max-w-full max-h-full object-contain p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="border-white/20 text-white hover:bg-white/10"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload from device
            </>
          )}
        </Button>
        {currentPath && (
          <span
            className="text-xs text-white/30 font-mono truncate max-w-[240px]"
            title={currentPath}
          >
            {currentPath}
          </span>
        )}
      </div>
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

function ModelSlugField({
  setting,
  category,
  value,
  onChange,
}: {
  setting: AdminSetting;
  category: "image" | "video" | "audio";
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { data: models, isLoading } = useListModels({ category });
  const activeModels = (models ?? []).filter((m) => m.isActive);

  return (
    <div className="py-3">
      <Label className="text-white text-sm font-semibold">{setting.label}</Label>
      <p className="text-xs text-white/40 mt-0.5 mb-2">{setting.description}</p>
      {isLoading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading models…
        </div>
      ) : (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
        >
          <SelectTrigger className="bg-white/[0.04] border-white/10 text-white max-w-xs">
            <SelectValue placeholder="No default (first model shown)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-white/50">No default</span>
            </SelectItem>
            {activeModels.map((m) => (
              <SelectItem key={m.modelId} value={m.modelId}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

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
  if (ASSET_UPLOAD_KEYS.has(setting.key)) {
    return <ImageUploadField setting={setting} value={value} onChange={onChange} />;
  }

  const modelCategory = MODEL_SLUG_KEYS[setting.key];
  if (modelCategory) {
    return (
      <ModelSlugField setting={setting} category={modelCategory} value={value} onChange={onChange} />
    );
  }

  if (setting.type === "boolean") {
    // Toggle immediately next to label — not floated far right
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

  if (setting.type === "number") {
    return (
      <div className="py-3">
        <Label className="text-white text-sm font-semibold">{setting.label}</Label>
        <p className="text-xs text-white/40 mt-0.5 mb-2">{setting.description}</p>
        <Input
          type="number"
          min={0}
          value={typeof value === "number" ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-white/[0.04] border-white/10 text-white max-w-xs"
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
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
    const banner = value as { enabled: boolean; text: string; linkUrl?: string; linkLabel?: string };
    return (
      <div className="py-3">
        {/* Toggle next to label */}
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
        <div className="grid gap-2 max-w-lg">
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

  // Theme color: add swatch preview
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
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  // Default: string (short or long)
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

// Wraps a SettingField in a bordered card with dirty indicator
function FieldCard({
  setting,
  value,
  isDirty,
  error,
  isHidden,
  searchQuery,
  onChange,
  cardRef,
}: {
  setting: AdminSetting;
  value: unknown;
  isDirty: boolean;
  error?: string;
  isHidden: boolean;
  searchQuery: string;
  onChange: (value: unknown) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const matchesSearch =
    !searchQuery || setting.label.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div
      ref={cardRef}
      data-setting-key={setting.key}
      className={cn(
        "transition-all duration-200 overflow-hidden",
        isHidden ? "max-h-0 opacity-0 pointer-events-none" : "max-h-[600px] opacity-100",
      )}
    >
      <div
        className={cn(
          "border rounded-xl p-4 mb-3 transition-colors",
          isDirty
            ? "border-primary/40 bg-primary/[0.03]"
            : error
              ? "border-red-500/40 bg-red-500/[0.03]"
              : "border-white/[0.08] bg-[#141414]",
          searchQuery && matchesSearch && "ring-1 ring-primary/30",
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
    </div>
  );
}

// Live Preview — lightweight approximation of the site header/hero using
// current local state. Reusing the real Navbar/Hero directly would require
// mocking the settings context (which reads from API) or awkward prop-drilling,
// so this approximation is the correct fallback per the spec.
function LivePreviewCard({ draft }: { draft: Record<string, unknown> }) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const siteName = typeof draft.site_name === "string" ? draft.site_name : "Higgsfield AI";
  const tagline = typeof draft.site_tagline === "string" ? draft.site_tagline : "";
  const themeColor =
    typeof draft.theme_color === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(draft.theme_color)
      ? draft.theme_color
      : "#CEFF00";

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Live Preview</h3>
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
            viewMode === "mobile" ? "max-w-[375px]" : "w-full",
          )}
        >
          {/* Navbar approximation */}
          <div className="bg-[#0a0a0a] border-b border-white/5 px-3 py-2.5 flex items-center gap-2">
            <div
              className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <div className="w-1.5 h-1.5 bg-black rounded-sm" />
            </div>
            <span className="font-bold text-white text-xs truncate">{siteName}</span>
            {viewMode === "desktop" && (
              <div className="flex items-center gap-2 ml-3">
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
                Sign up
              </div>
            </div>
          </div>
          {/* Hero approximation */}
          <div className="bg-[#0a0a0a] px-4 py-5 text-center">
            <h2 className="text-white font-black text-sm mb-1 truncate">{siteName}</h2>
            <p className="text-white/40 text-[10px] line-clamp-2">{tagline}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformStatusCard({
  settings,
  health,
  healthLoading,
  onRefreshHealth,
  healthFetching,
}: {
  settings: AdminSetting[] | undefined;
  health: { database: { connected: boolean }; objectStorage: { status: string; message?: string | null; providerHostedCount: number } } | undefined;
  healthLoading: boolean;
  onRefreshHealth?: () => void;
  healthFetching?: boolean;
}) {
  function getVal(key: string) {
    return settings?.find((s) => s.key === key)?.value;
  }

  const rows = [
    { label: "Maintenance Mode", value: Boolean(getVal("maintenance_mode")), isToggle: true, active: false },
    { label: "Registration", value: Boolean(getVal("registration_enabled")), isToggle: true, active: true },
    { label: "Platform Generation", value: Boolean(getVal("platform_generation_enabled")), isToggle: true, active: true },
  ];

  // Derive 3-state storage display from the new shape
  const storage = health?.objectStorage;
  const storageState: 'connected' | 'disconnected' | 'warning' | undefined = !storage ? undefined
    : storage.status === 'disconnected' ? 'disconnected'
    : storage.status === 'warning' ? 'warning'
    : storage.providerHostedCount > 0 ? 'warning'
    : 'connected';

  const storageBadgeClass = !storageState
    ? 'bg-white/[0.06] text-white/40'
    : storageState === 'connected' ? 'bg-green-500/15 text-green-400'
    : storageState === 'disconnected' ? 'bg-red-500/15 text-red-400'
    : 'bg-yellow-500/15 text-yellow-400';

  const storageLabel = !storageState ? '…'
    : storageState === 'connected' ? 'Connected'
    : storageState === 'disconnected' ? 'Disconnected'
    : 'Warning';

  const storageDetail = !storage ? null
    : storage.status === 'connected' && storage.providerHostedCount > 0
      ? `${storage.providerHostedCount} asset${storage.providerHostedCount === 1 ? '' : 's'} on temporary URLs`
      : (storage.status === 'disconnected' || storage.status === 'warning') && storage.message
        ? storage.message
        : null;

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Platform Status</h3>
        {onRefreshHealth && (
          <button
            onClick={onRefreshHealth}
            disabled={healthFetching}
            className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
            title="Re-check infrastructure"
          >
            <RefreshCcw className={cn("w-3 h-3", healthFetching && "animate-spin")} />
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-xs text-white/60">{row.label}</span>
            <span
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                row.label === "Maintenance Mode"
                  ? row.value
                    ? "bg-yellow-500/15 text-yellow-400"
                    : "bg-green-500/15 text-green-400"
                  : row.value
                    ? "bg-green-500/15 text-green-400"
                    : "bg-red-500/15 text-red-400",
              )}
            >
              {row.label === "Maintenance Mode"
                ? row.value ? "On" : "Off"
                : row.value ? "Enabled" : "Disabled"}
            </span>
          </div>
        ))}

        <div className="h-px bg-white/[0.06] my-1" />

        {/* Real health check rows */}
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
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/60">Object Storage</span>
                </div>
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", storageBadgeClass)}>
                  {storageLabel}
                </span>
              </div>
              {storageDetail && (
                <p className="text-[10px] text-white/40 mt-1 leading-relaxed break-words pl-4">
                  {storageDetail}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsInfoCard({ lastSavedAt }: { lastSavedAt: Date | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    // Re-render every 30s so the relative time stays fresh
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
      <h3 className="text-sm font-bold text-white mb-3">Settings</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Last saved</span>
          <span className="text-xs text-white/80 font-medium">{relativeTime(lastSavedAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Last updated by</span>
          {/* Hardcoded — there is no updatedBy tracking column; this is correct
              only because there is exactly one owner account. Not an audit trail. */}
          <span className="text-xs text-white/80 font-medium">Owner</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

function AdminSettingsPanel() {
  const { data: settings, isLoading, refetch } = useGetAdminSettings();
  const { data: health, isLoading: healthLoading, isFetching: healthFetching, refetch: refetchHealth } = useGetAdminSettingsHealth();
  const updateMutation = useUpdateAdminSettings();
  const importMutation = useImportAdminSettings();
  const resetMutation = useResetAdminSettingsToDefaults();

  // ── Core state ───────────────────────────────────────────────────────────────
  const [savedValues, setSavedValues] = useState<Record<string, unknown>>({});
  const [dirtyFields, setDirtyFields] = useState<Record<string, unknown>>({});
  const [activeCategory, setActiveCategory] = useState<string>("branding");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [preSearchScrollY, setPreSearchScrollY] = useState(0);
  const [isSavingState, setIsSavingState] = useState(false); // drives UI only
  const isSavingRef = useRef(false); // actual guard — prevents double-submits
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorBanner, setErrorBanner] = useState<Array<{ key: string; label: string; error: string }>>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<Record<string, unknown> | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fieldCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Initialise savedValues from API ─────────────────────────────────────────
  useEffect(() => {
    if (!settings) return;
    const initial: Record<string, unknown> = {};
    for (const s of settings) initial[s.key] = s.value;
    setSavedValues(initial);
  }, [settings]);

  // Seed lastSavedAt from health response
  useEffect(() => {
    if (health?.lastSavedAt && !lastSavedAt) {
      setLastSavedAt(new Date(health.lastSavedAt));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health]);

  // ── Undo countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (undoSecondsLeft <= 0) {
      if (undoSnapshot) setUndoSnapshot(null);
      return;
    }
    const id = setTimeout(() => setUndoSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [undoSecondsLeft, undoSnapshot]);

  // ── Beforeunload guard ───────────────────────────────────────────────────────
  useEffect(() => {
    const hasDirty = Object.keys(dirtyFields).length > 0;
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyFields]);

  // ── Scroll-based active category ─────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY + 120; // offset for sticky header
      let active: string = SIDEBAR_ITEMS[0].key;
      for (const item of SIDEBAR_ITEMS) {
        const el = sectionRefs.current[item.key];
        if (el && el.offsetTop <= scrollY) {
          active = item.key;
        }
      }
      setActiveCategory(active);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S — save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (Object.keys(dirtyFields).length > 0) handleSave();
        return;
      }
      // "/" — focus search (not when already in a text input)
      if (
        e.key === "/" &&
        document.activeElement &&
        !["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement).tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // Esc — clear search when focused (not discard)
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          clearSearch();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyFields, searchQuery]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const currentValues = (key: string) =>
    key in dirtyFields ? dirtyFields[key] : savedValues[key];

  // Full draft used by Live Preview (savedValues merged with dirtyFields)
  const draftForPreview: Record<string, unknown> = { ...savedValues, ...dirtyFields };

  function grouped(): Map<string, AdminSetting[]> {
    if (!settings) return new Map();
    const map = new Map<string, AdminSetting[]>();
    for (const s of settings) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return map;
  }

  function isFieldHidden(setting: AdminSetting): boolean {
    if (!searchQuery) return false;
    return !setting.label.toLowerCase().includes(searchQuery.toLowerCase());
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  function setField(key: string, value: unknown) {
    setDirtyFields((prev) => ({ ...prev, [key]: value }));
    // Clear any existing error for this field on change
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
    }
  }

  function discardChanges() {
    setDirtyFields({});
    setFieldErrors({});
    setErrorBanner([]);
  }

  function scrollToCategory(cat: string) {
    const el = sectionRefs.current[cat];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveCategory(cat);
    }
  }

  function scrollToField(key: string) {
    const el = fieldCardRefs.current[key];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight
      el.classList.add("ring-2", "ring-red-400");
      setTimeout(() => el.classList.remove("ring-2", "ring-red-400"), 2000);
    }
  }

  function setSearch(q: string) {
    if (!searchQuery && q) {
      setPreSearchScrollY(window.scrollY);
    }
    setSearchQuery(q);
    // Jump to the section containing a match
    if (q && settings) {
      for (const item of SIDEBAR_ITEMS) {
        const sectionSettings = settings.filter((s) => s.category === item.key);
        const hasMatch = sectionSettings.some((s) =>
          s.label.toLowerCase().includes(q.toLowerCase()),
        );
        if (hasMatch) {
          scrollToCategory(item.key);
          break;
        }
      }
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setTimeout(() => {
      window.scrollTo({ top: preSearchScrollY, behavior: "smooth" });
    }, 50);
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
      setSavedValues(newSaved);
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
          const setting = settings?.find((s) => s.key === f.key);
          banner.push({ key: f.key, label: setting?.label ?? f.key, error: f.error });
        }
        setFieldErrors(errs);
        setErrorBanner(banner);
        // dirtyFields is intentionally NOT cleared on failure
      }
      toast({ title: "Save failed — check errors above", variant: "destructive" });
    } finally {
      isSavingRef.current = false;
      setIsSavingState(false);
    }
  }

  async function handleRefresh() {
    if (Object.keys(dirtyFields).length > 0) {
      setShowRefreshConfirm(true);
      return;
    }
    await doRefresh();
  }

  async function doRefresh() {
    await refetch();
    setDirtyFields({});
    setFieldErrors({});
    setErrorBanner({} as never);
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
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("File must be a flat JSON object");
      }
      const updated = await importMutation.mutateAsync({ data: parsed });
      const newSaved: Record<string, unknown> = {};
      for (const s of updated) newSaved[s.key] = s.value;
      setSavedValues(newSaved);
      setDirtyFields({});
      setLastSavedAt(new Date());
      toast({ title: "✓ Settings imported" });
    } catch (err) {
      const fields = parseValidationErrors(err);
      if (fields.length > 0) {
        const banner: Array<{ key: string; label: string; error: string }> = [];
        const errs: Record<string, string> = {};
        for (const f of fields) {
          errs[f.key] = f.error;
          const setting = settings?.find((s) => s.key === f.key);
          banner.push({ key: f.key, label: setting?.label ?? f.key, error: f.error });
        }
        setFieldErrors(errs);
        setErrorBanner(banner);
        setImportError("Import failed — see field errors above.");
      } else {
        setImportError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  async function handleResetToDefaults() {
    // Snapshot current values before reset for undo
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

  // Drag and drop for import
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".json")) {
      processImportFile(file);
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  const groupedSettings = grouped();
  const dirtyKeys = Object.keys(dirtyFields);
  const hasDirty = dirtyKeys.length > 0;
  const dirtyLabels = dirtyKeys
    .map((k) => settings.find((s) => s.key === k)?.label ?? k)
    .join(", ");

  return (
    <>
      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-[#141414] border border-white/[0.08] rounded-xl">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings… (/)"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            aria-label="Search settings"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3 h-3 text-white/40" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isSavingState || exporting || importing}
            className="border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span className="ml-1.5">Export</span>
          </Button>

          {/* Import — file picker + drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => importFileRef.current?.click()}
              disabled={isSavingState || importing || exporting}
              className={cn(
                "border-white/15 text-white/80 hover:bg-white/10 hover:text-white",
                isDragOver && "border-primary text-primary",
              )}
              aria-label="Import settings"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileUp className="w-3.5 h-3.5" />
              )}
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
            disabled={isSavingState || importing || exporting}
            className="border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span className="ml-1.5">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Import error inline */}
      {importError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{importError}</p>
          <button onClick={() => setImportError(null)} className="ml-auto shrink-0" aria-label="Dismiss">
            <X className="w-4 h-4 text-red-400/60 hover:text-red-400" />
          </button>
        </div>
      )}

      {/* Sticky error banner */}
      {errorBanner.length > 0 && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl sticky top-16 z-20">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-400">
              {errorBanner.length} field{errorBanner.length > 1 ? "s" : ""} failed validation — nothing was saved
            </p>
            <button onClick={() => setErrorBanner([])} className="ml-auto shrink-0" aria-label="Dismiss errors">
              <X className="w-4 h-4 text-red-400/60 hover:text-red-400" />
            </button>
          </div>
          <div className="space-y-1 ml-6">
            {errorBanner.map((e) => (
              <button
                key={e.key}
                onClick={() => scrollToField(e.key)}
                className="block text-xs text-red-300 hover:text-red-200 underline text-left"
              >
                {e.label}: {e.error}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Main layout: sidebar + content + right rail ─────────────────── */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside
          className={cn(
            "sticky top-20 h-fit shrink-0 transition-all duration-200",
            isSidebarCollapsed ? "w-14" : "w-[220px]",
          )}
        >
          <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-2">
            {/* Collapse toggle */}
            <button
              onClick={() => setIsSidebarCollapsed((v) => !v)}
              className="w-full flex items-center justify-end mb-2 p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

            <nav className="space-y-0.5">
              {SIDEBAR_ITEMS.map(({ key, label, icon: Icon }) => {
                const hasDirtyInCategory = dirtyKeys.some((k) =>
                  settings.find((s) => s.key === k && s.category === key),
                );
                const isActive = activeCategory === key;

                return (
                  <button
                    key={key}
                    onClick={() => scrollToCategory(key)}
                    aria-label={isSidebarCollapsed ? label : undefined}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white hover:bg-white/5",
                      isSidebarCollapsed && "justify-center",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isSidebarCollapsed && (
                      <>
                        <span className="truncate">{label}</span>
                        <span className="ml-auto shrink-0">
                          {hasDirtyInCategory ? (
                            <Circle className="w-1.5 h-1.5 fill-primary text-primary" />
                          ) : (
                            <Check className="w-3 h-3 text-white/20" />
                          )}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content + right rail */}
        <div className="flex-1 min-w-0">
          <div className="lg:grid lg:grid-cols-[1fr_280px] gap-5">
            {/* Main content — capped at ~1000px */}
            <div className="max-w-[900px]">
              {SIDEBAR_ITEMS.map(({ key }) => {
                const defs = groupedSettings.get(key) ?? [];
                if (defs.length === 0) return null;

                return (
                  <div
                    key={key}
                    ref={(el) => {
                      sectionRefs.current[key] = el;
                    }}
                    data-category={key}
                    className="mb-10 scroll-mt-24"
                  >
                    {/* Sticky section header */}
                    <div className="sticky top-16 z-10 -mx-1 px-1 py-2 mb-3 bg-background/80 backdrop-blur-md">
                      <h2 className="text-lg font-bold text-white">
                        {CATEGORY_LABELS[key] ?? key}
                      </h2>
                    </div>

                    {defs.map((s) => (
                      <FieldCard
                        key={s.key}
                        setting={s}
                        value={currentValues(s.key)}
                        isDirty={s.key in dirtyFields}
                        error={fieldErrors[s.key]}
                        isHidden={isFieldHidden(s)}
                        searchQuery={searchQuery}
                        onChange={(value) => setField(s.key, value)}
                        cardRef={(el) => {
                          fieldCardRefs.current[s.key] = el;
                        }}
                      />
                    ))}
                  </div>
                );
              })}

              {/* ── Danger Zone ─────────────────────────────────────── */}
              <div className="border border-red-500/30 rounded-xl p-5 mt-4 mb-8">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider">
                    Danger Zone
                  </h2>
                </div>
                <p className="text-xs text-white/40 mb-4">
                  Destructive actions. These cannot be undone without the 10-second undo window.
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
            </div>

            {/* Right rail — stacks below main at <1024px */}
            <div className="space-y-4 mt-2">
              <LivePreviewCard draft={draftForPreview} />
              <PlatformStatusCard
                settings={settings}
                health={health}
                healthLoading={healthLoading}
                onRefreshHealth={() => void refetchHealth()}
                healthFetching={healthFetching}
              />
              <SettingsInfoCard lastSavedAt={lastSavedAt} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating save bar ─────────────────────────────────────────────── */}
      {hasDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 lg:px-0">
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
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Undo toast after reset ─────────────────────────────────────────── */}
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

      {/* ── Confirm dialogs ───────────────────────────────────────────────── */}
      <AlertDialog open={showRefreshConfirm} onOpenChange={setShowRefreshConfirm}>
        <AlertDialogContent className="bg-[#1a1a1a] border-white/15">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Discard unsaved changes and reload?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              You have {dirtyKeys.length} unsaved change{dirtyKeys.length > 1 ? "s" : ""} that will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 text-white/70 hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowRefreshConfirm(false);
                doRefresh();
              }}
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
            <AlertDialogCancel className="border-white/15 text-white/70 hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowResetConfirm(false);
                handleResetToDefaults();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Reset to defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Page wrapper ─────────────────────────────────────────────────────────────

function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-24">
      <ShieldAlert className="w-10 h-10 text-white/30" />
      <h1 className="text-2xl font-black text-white">Owner access required</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        This page is only available to the site owner.
      </p>
      <Link href="/">
        <Button variant="ghost" className="text-white/70 hover:text-white">
          Back home
        </Button>
      </Link>
    </div>
  );
}

export default function AdminSettings() {
  const { data: me, isLoading } = useGetMe();

  return (
    <div className="container mx-auto px-4 py-10 min-h-screen">
      <Show when="signed-out">
        <div className="flex flex-col items-center justify-center text-center gap-6 py-24">
          <h1 className="text-3xl md:text-4xl font-black text-white">Sign in to continue</h1>
          <Link href="/sign-in">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90">Log in</Button>
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-7 h-7 text-primary shrink-0" />
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-none">
              Site Settings
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure how your platform behaves.
            </p>
          </div>
        </div>

        <div className="mb-6" />

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : me?.isOwner ? (
          <AdminSettingsPanel />
        ) : (
          <Forbidden />
        )}
      </Show>
    </div>
  );
}
