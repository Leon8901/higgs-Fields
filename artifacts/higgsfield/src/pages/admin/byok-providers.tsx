import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Key,
  RefreshCcw,
  Upload,
  Link2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Save,
} from "lucide-react";
import {
  useListAdminProviders,
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

async function importIconFromUrl(slug: string, url: string): Promise<string> {
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
  const data = await res.json() as { icon?: string };
  return data.icon ?? "";
}

// ── Icon Upload ────────────────────────────────────────────────────────────────

function ByokIconUpload({ provider, onUpdated }: { provider: AdminProvider; onUpdated: () => void }) {
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
      const put = await fetch(res.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
      await patchProvider.mutateAsync({ slug: provider.slug, data: { icon: `/api/storage${res.objectPath}` } });
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
      <div className="flex flex-wrap gap-2 mb-2">
        <Button type="button" variant="outline" size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || pasting}
          className="border-white/15 text-white/70 hover:bg-white/5 h-8 text-xs">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
          Upload new
        </Button>
        <Button type="button" variant="outline" size="sm"
          onClick={() => setPasteMode((v) => !v)}
          disabled={uploading || pasting}
          className={cn("border-white/15 text-white/70 hover:bg-white/5 h-8 text-xs", pasteMode && "border-primary/50 text-primary")}>
          <Link2 className="w-3 h-3 mr-1" />Paste URL
        </Button>
      </div>
      {pasteMode && (
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/icon.png"
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
      <input ref={fileInputRef} type="file" accept="image/*,.svg" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ── BYOK Provider Card ─────────────────────────────────────────────────────────

function ByokProviderCard({ provider, onUpdated }: { provider: AdminProvider; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields local state
  const [description, setDescription] = useState(provider.description ?? "");
  const [docsUrl, setDocsUrl] = useState(provider.docsUrl ?? "");
  const [keyFormatHint, setKeyFormatHint] = useState(provider.keyFormatHint ?? "");
  const [unavailableMessage, setUnavailableMessage] = useState(provider.unavailableMessage ?? "");

  const patchProvider = usePatchAdminProvider();
  const bg = slugColor(provider.slug);
  const isActive = provider.status === "active";

  async function toggleStatus() {
    setToggling(true);
    const newStatus = isActive ? "disabled" : "active";
    try {
      await patchProvider.mutateAsync({ slug: provider.slug, data: { status: newStatus } });
      toast({
        title: isActive
          ? `${provider.name} BYOK disabled — users will see a greyed-out card`
          : `${provider.name} BYOK enabled`,
      });
      onUpdated();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setToggling(false);
    }
  }

  async function handleSaveDetails() {
    setSaving(true);
    try {
      await patchProvider.mutateAsync({
        slug: provider.slug,
        data: {
          description: description || null,
          docsUrl: docsUrl || null,
          keyFormatHint: keyFormatHint || null,
          unavailableMessage: unavailableMessage || null,
        },
      });
      toast({ title: "Provider details updated" });
      onUpdated();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Check if details have changed from saved values
  const hasChanges =
    description !== (provider.description ?? "") ||
    docsUrl !== (provider.docsUrl ?? "") ||
    keyFormatHint !== (provider.keyFormatHint ?? "") ||
    unavailableMessage !== (provider.unavailableMessage ?? "");

  return (
    <div className={cn(
      "bg-[#141414] border rounded-xl transition-colors overflow-hidden",
      expanded ? "border-white/15" : "border-white/[0.08]",
      !isActive && "opacity-75",
    )}>
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden transition-all",
              !isActive && "grayscale opacity-50",
            )}
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
              <h3 className={cn("font-bold text-base", isActive ? "text-white" : "text-white/50")}>
                {provider.name}
              </h3>
              {isActive ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[10px]">
                  <AlertCircle className="w-2.5 h-2.5 mr-1" />
                  Disabled
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {provider.capabilities.map((cap) => (
                <Badge key={cap} variant="outline"
                  className="border-white/10 text-white/30 text-[10px] px-1.5 py-0 uppercase tracking-wide">
                  {cap}
                </Badge>
              ))}
            </div>

            {!isActive && (
              <p className="text-xs text-yellow-400/70 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Users see this provider as greyed-out and cannot add a key.
              </p>
            )}
          </div>

          {/* Toggle + expand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-white/50 whitespace-nowrap">BYOK active</Label>
              <Switch
                checked={isActive}
                onCheckedChange={toggleStatus}
                disabled={toggling}
                aria-label={`Enable BYOK for ${provider.name}`}
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
          {/* Description */}
          <div>
            <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Description
            </Label>
            <p className="text-xs text-white/30 mt-0.5 mb-2">
              Shown to users on the BYOK panel.
            </p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`A brief description of ${provider.name}…`}
              className="bg-white/[0.04] border-white/10 text-white text-sm max-w-lg"
              rows={2}
            />
          </div>

          {/* Docs URL */}
          <div>
            <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              API Key Docs URL
            </Label>
            <p className="text-xs text-white/30 mt-0.5 mb-2">
              Link to where users get their API key. Shown as "Get API key →".
            </p>
            <Input
              value={docsUrl}
              onChange={(e) => setDocsUrl(e.target.value)}
              placeholder={`https://platform.${provider.slug}.com/api-keys`}
              className="bg-white/[0.04] border-white/10 text-white text-sm max-w-lg"
            />
          </div>

          {/* Key format hint */}
          <div>
            <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Key Format Hint
            </Label>
            <p className="text-xs text-white/30 mt-0.5 mb-2">
              Placeholder text in the key input field (e.g. "sk-…").
            </p>
            <Input
              value={keyFormatHint}
              onChange={(e) => setKeyFormatHint(e.target.value)}
              placeholder={`${provider.slug}-xxxxxxxxxxxxxxxx`}
              className="bg-white/[0.04] border-white/10 text-white text-sm max-w-sm"
            />
          </div>

          {/* Unavailable message */}
          <div>
            <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Unavailable Message
            </Label>
            <p className="text-xs text-white/30 mt-0.5 mb-2">
              Shown on the greyed-out card when the provider is disabled. Leave blank for the generic fallback.
            </p>
            <Input
              value={unavailableMessage}
              onChange={(e) => setUnavailableMessage(e.target.value)}
              placeholder="This provider is temporarily unavailable. Please use another provider."
              className="bg-white/[0.04] border-white/10 text-white text-sm max-w-lg"
            />
          </div>

          {/* Save details button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveDetails}
              disabled={!hasChanges || saving}
              size="sm"
              className={cn(
                "h-9 font-bold",
                hasChanges
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "bg-white/[0.04] text-white/30 cursor-not-allowed",
              )}
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving…</>
              ) : (
                <><Save className="w-3.5 h-3.5 mr-1.5" />Save details</>
              )}
            </Button>
            {hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDescription(provider.description ?? "");
                  setDocsUrl(provider.docsUrl ?? "");
                  setKeyFormatHint(provider.keyFormatHint ?? "");
                  setUnavailableMessage(provider.unavailableMessage ?? "");
                }}
                className="text-white/40 hover:text-white h-9"
              >
                Discard
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06]" />

          {/* Icon management */}
          <ByokIconUpload provider={provider} onUpdated={onUpdated} />

          {/* Docs link */}
          {provider.docsUrl && (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View {provider.name} API docs
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function ByokProvidersPanel() {
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

  // Only show providers that support BYOK
  const byokProviders = [...(providers ?? [])]
    .filter((p) => p.supportsByok)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const active = byokProviders.filter((p) => p.status === "active").length;
  const disabled = byokProviders.filter((p) => p.status === "disabled").length;

  return (
    <div className="p-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">BYOK Providers</h1>
          <p className="text-sm text-white/50 mt-1">
            Configure which providers users can bring their own key for.
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

      {/* Summary */}
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">{active} active</span>
        </div>
        {disabled > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400">{disabled} disabled</span>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="mb-5 p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-start gap-3">
        <Key className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
        <p className="text-xs text-white/50 leading-relaxed">
          Disabled providers still appear on the public BYOK page as a greyed-out card with your unavailable message —
          they are never hidden. The API rejects key submissions for disabled providers server-side.
        </p>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {byokProviders.map((provider) => (
          <ByokProviderCard
            key={provider.slug}
            provider={provider}
            onUpdated={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminByokProviders() {
  return (
    <AdminShell>
      <ByokProvidersPanel />
    </AdminShell>
  );
}
