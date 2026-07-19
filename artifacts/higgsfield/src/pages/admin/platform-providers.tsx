import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Key,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Cpu,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCcw,
  Upload,
  Link2,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import {
  useListAdminProviders,
  useSetAdminProviderPlatformKey,
  useDeleteAdminProviderPlatformKey,
  useTestAdminProviderConnection,
  usePatchAdminProvider,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import type { AdminProvider } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { AdminShell } from "./shell";

const PAGE_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Utility ────────────────────────────────────────────────────────────────────

const PROVIDER_BG: Record<string, string> = {
  fal: "#FF6B35",
  openai: "#10A37F",
  openrouter: "#6366F1",
  elevenlabs: "#E44D26",
  anthropic: "#D97706",
  kling: "#7C3AED",
  google: "#4285F4",
  wavespeed: "#0EA5E9",
};

function slugColor(slug: string) {
  if (PROVIDER_BG[slug]) return PROVIDER_BG[slug];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) & 0xffffff;
  return `#${h.toString(16).padStart(6, "0")}`;
}

function keyStatusMeta(status: string | null) {
  switch (status) {
    case "valid":
      return { label: "Valid", icon: CheckCircle2, className: "text-emerald-400 bg-emerald-500/10" };
    case "invalid":
      return { label: "Invalid", icon: AlertTriangle, className: "text-red-400 bg-red-500/10" };
    case "unknown":
      return { label: "Unverified", icon: HelpCircle, className: "text-yellow-400 bg-yellow-500/10" };
    default:
      return { label: "No Key", icon: Key, className: "text-white/30 bg-white/[0.04]" };
  }
}

async function importIconFromUrl(slug: string, url: string): Promise<void> {
  const res = await fetch(`${PAGE_BASE}/api/admin/providers/${slug}/icon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Icon import failed");
  }
}

// ── Icon Upload ────────────────────────────────────────────────────────────────

function ProviderIconUpload({
  provider,
  onUpdated,
}: {
  provider: AdminProvider;
  onUpdated: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasting, setPasting] = useState(false);
  const requestUploadUrl = useRequestUploadUrl();
  const patchProvider = usePatchAdminProvider();

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
      const iconPath = `/api/storage${res.objectPath}`;
      await patchProvider.mutateAsync({ slug: provider.slug, data: { icon: iconPath } });
      toast({ title: "Icon updated" });
      onUpdated();
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
      await importIconFromUrl(provider.slug, pasteUrl.trim());
      setPasteMode(false);
      setPasteUrl("");
      toast({ title: "Icon updated" });
      onUpdated();
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setPasting(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-white/50 mb-2">Provider Icon</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || pasting}
          className="border-white/15 text-white/70 hover:bg-white/5 h-8 text-xs"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
          Upload
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPasteMode((v) => !v)}
          disabled={uploading || pasting}
          className={cn(
            "border-white/15 text-white/70 hover:bg-white/5 h-8 text-xs",
            pasteMode && "border-primary/50 text-primary",
          )}
        >
          <Link2 className="w-3 h-3 mr-1" />
          Paste URL
        </Button>
      </div>
      {pasteMode && (
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="https://…/icon.png"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePasteUrl();
              if (e.key === "Escape") { setPasteMode(false); setPasteUrl(""); }
            }}
            className="bg-white/[0.04] border-white/10 text-white text-xs h-8"
            autoFocus
          />
          <Button type="button" size="sm" onClick={handlePasteUrl}
            disabled={!pasteUrl.trim() || pasting}
            className="bg-primary text-black font-bold hover:bg-primary/90 h-8 text-xs shrink-0">
            {pasting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </Button>
          <Button type="button" variant="ghost" size="sm"
            onClick={() => { setPasteMode(false); setPasteUrl(""); }}
            className="h-8 text-white/40 hover:text-white shrink-0">
            <X className="w-3 h-3" />
          </Button>
        </div>
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

// ── Platform Key Manager ───────────────────────────────────────────────────────

function PlatformKeyManager({ provider, onUpdated }: { provider: AdminProvider; onUpdated: () => void }) {
  const [keyInput, setKeyInput] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok?: boolean;
    message?: string;
    testable?: boolean;
    reason?: string;
  } | null>(null);

  const setKey = useSetAdminProviderPlatformKey();
  const deleteKey = useDeleteAdminProviderPlatformKey();
  const testConnection = useTestAdminProviderConnection();

  const hasKey = !!provider.platformKeyLastFour;
  const statusMeta = keyStatusMeta(provider.platformKeyStatus ?? null);
  const StatusIcon = statusMeta.icon;

  async function handleSave() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setTestResult(null);
    try {
      await setKey.mutateAsync({ slug: provider.slug, data: { apiKey: keyInput.trim() } });
      setKeyInput("");
      toast({ title: `Platform key saved for ${provider.name}` });
      onUpdated();
    } catch (err: unknown) {
      const errMsg = (err as { data?: { error?: string }; message?: string })?.data?.error ?? String(err);
      toast({ title: "Key save failed", description: errMsg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setTestResult(null);
    try {
      await deleteKey.mutateAsync({ slug: provider.slug });
      toast({ title: `Platform key removed for ${provider.name}` });
      onUpdated();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({ slug: provider.slug });
      setTestResult(result as typeof testResult);
      if ((result as { ok?: boolean }).ok) {
        onUpdated();
      }
    } catch {
      setTestResult({ testable: true, ok: false, message: "Test call failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Current key status */}
      {hasKey && (
        <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2">
          <span className={cn("flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full", statusMeta.className)}>
            <StatusIcon className="w-3 h-3" />
            {statusMeta.label}
          </span>
          <span className="text-xs text-white/45 font-mono tracking-widest flex-1">
            {reveal ? `…${provider.platformKeyLastFour}` : `•••• •••• •••• ${provider.platformKeyLastFour}`}
          </span>
          <button onClick={() => setReveal((r) => !r)} className="text-white/30 hover:text-white/60 transition-colors">
            {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-400/50 hover:text-red-400 transition-colors"
            title="Remove key"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Key input */}
      <div>
        <p className="text-xs font-semibold text-white/50 mb-1.5">
          {hasKey ? "Replace Platform Key" : "Add Platform Key"}
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <Input
              type="password"
              placeholder={provider.keyFormatHint ?? `Paste ${provider.name} API key`}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="bg-white/[0.04] border-white/10 text-white pl-9 text-sm h-9"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={!keyInput.trim() || saving || !provider.hasAdapter}
            className="bg-primary text-black font-bold hover:bg-primary/90 h-9 shrink-0"
            size="sm"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
        {!provider.hasAdapter && (
          <p className="text-xs text-yellow-400/70 mt-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            No code adapter — key can be stored but won't route generation
          </p>
        )}
      </div>

      {/* Test connection */}
      {hasKey && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="border-white/15 text-white/70 hover:bg-white/5 h-8 text-xs"
          >
            {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Zap className="w-3 h-3 mr-1.5" />}
            Test Connection
          </Button>

          {testResult && (
            <div className={cn(
              "mt-2 px-3 py-2 rounded-lg text-xs",
              testResult.testable === false
                ? "bg-white/[0.04] text-white/50"
                : testResult.ok
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400",
            )}>
              {testResult.testable === false
                ? `Not testable: ${testResult.reason}`
                : testResult.ok
                  ? `✓ ${testResult.message}`
                  : `✗ ${testResult.message}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Provider Card ──────────────────────────────────────────────────────────────

function PlatformProviderCard({
  provider,
  onUpdated,
}: {
  provider: AdminProvider;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [savingBaseUrl, setSavingBaseUrl] = useState(false);

  const patchProvider = usePatchAdminProvider();
  const bg = slugColor(provider.slug);

  async function togglePlatformEnabled(enabled: boolean) {
    setTogglingEnabled(true);
    try {
      await patchProvider.mutateAsync({ slug: provider.slug, data: { platformEnabled: enabled } });
      toast({ title: enabled ? `${provider.name} platform routing enabled` : `${provider.name} platform routing disabled` });
      onUpdated();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Update failed";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    } finally {
      setTogglingEnabled(false);
    }
  }

  async function saveBaseUrl() {
    setSavingBaseUrl(true);
    try {
      await patchProvider.mutateAsync({ slug: provider.slug, data: { baseUrl: baseUrl || null } });
      toast({ title: "Base URL updated" });
      onUpdated();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setSavingBaseUrl(false);
    }
  }

  const hasKey = !!provider.platformKeyLastFour;
  const statusMeta = keyStatusMeta(provider.platformKeyStatus ?? null);
  const StatusIcon = statusMeta.icon;

  return (
    <div className={cn(
      "bg-[#141414] border rounded-xl transition-colors overflow-hidden",
      expanded ? "border-white/15" : "border-white/[0.08]",
    )}>
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: bg }}
          >
            {provider.icon ? (
              <img
                src={`${PAGE_BASE}${provider.icon.startsWith("/api") ? "" : ""}${provider.icon}`}
                alt={provider.name}
                className="w-8 h-8 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span className="text-white font-black text-xl">{provider.name.charAt(0)}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-base">{provider.name}</h3>
              {provider.hasAdapter ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                  <Cpu className="w-2.5 h-2.5 mr-1" />
                  Adapter ready
                </Badge>
              ) : (
                <Badge className="bg-white/[0.04] text-white/30 border-white/10 text-[10px]">
                  No adapter
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {/* Key status */}
              <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", statusMeta.className)}>
                <StatusIcon className="w-3 h-3" />
                {statusMeta.label}
                {hasKey && ` ····${provider.platformKeyLastFour}`}
              </span>

              {/* Model counts */}
              <span className="text-xs text-white/40">
                {provider.modelsCataloged} cataloged / {provider.modelsEnabled} enabled
              </span>
            </div>

            {/* Live available models */}
            <div className="mt-1.5">
              {provider.liveAvailableModels !== null ? (
                <span className="text-xs text-white/50">
                  <span className="font-semibold text-white/70">{provider.liveAvailableModels?.length ?? 0}</span>{" "}
                  live available models
                </span>
              ) : (
                <span className="text-xs text-white/30 italic">
                  {provider.liveAvailableModelsReason ?? "Live catalog not available"}
                </span>
              )}
            </div>
          </div>

          {/* Enable toggle + expand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-white/50 whitespace-nowrap">
                Platform routing
              </Label>
              <Switch
                checked={provider.platformEnabled}
                onCheckedChange={togglePlatformEnabled}
                disabled={togglingEnabled || !provider.hasAdapter}
                aria-label="Enable platform routing"
              />
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              aria-label={expanded ? "Collapse" : "Expand config"}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-white/[0.08] p-5 space-y-5">
          {/* Platform key management */}
          <div>
            <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">
              Platform Key
            </h4>
            <PlatformKeyManager provider={provider} onUpdated={onUpdated} />
          </div>

          {/* Base URL override */}
          <div>
            <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Base URL Override
            </h4>
            <p className="text-xs text-white/40 mb-2">
              Override the provider's default API endpoint (leave blank to use default).
            </p>
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder={`https://api.${provider.slug}.com/v1`}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="bg-white/[0.04] border-white/10 text-white text-sm h-9"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={saveBaseUrl}
                disabled={savingBaseUrl}
                className="border-white/15 text-white/70 hover:bg-white/5 h-9 shrink-0"
              >
                {savingBaseUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          {/* Icon management */}
          <div>
            <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">
              Icon
            </h4>
            <ProviderIconUpload provider={provider} onUpdated={onUpdated} />
          </div>

          {/* Live available models list */}
          {provider.liveAvailableModels && provider.liveAvailableModels.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Live Available Models ({provider.liveAvailableModels.length})
              </h4>
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="space-y-1">
                  {provider.liveAvailableModels.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-xs">
                      <span className="text-white/30 font-mono text-[10px] w-4 flex-shrink-0">•</span>
                      <span className="text-white/70">{m.name || m.id}</span>
                      {m.name && m.name !== m.id && (
                        <span className="text-white/30 font-mono text-[10px]">({m.id})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Docs */}
          {provider.docsUrl && (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {provider.name} API docs
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function PlatformProvidersPanel() {
  const { data: providers, isLoading, refetch } = useListAdminProviders();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading providers…
      </div>
    );
  }

  const sorted = [...(providers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return (
    <div className="p-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Platform Providers</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage platform-wide API keys used when users don't bring their own.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="border-white/15 text-white/70 hover:bg-white/5 shrink-0"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {/* Info banner */}
      <div className="mb-5 p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-start gap-3">
        <Cpu className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
        <p className="text-xs text-white/50 leading-relaxed">
          Platform keys fund generation for users who haven't connected their own key.{" "}
          <strong className="text-white/70">Adapter ready</strong> providers can route live generation.{" "}
          Providers without an adapter can store keys but won't route until an adapter is implemented.
        </p>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {sorted.map((provider) => (
          <PlatformProviderCard
            key={provider.slug}
            provider={provider}
            onUpdated={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminPlatformProviders() {
  return (
    <AdminShell>
      <PlatformProvidersPanel />
    </AdminShell>
  );
}
