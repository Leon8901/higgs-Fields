import { useState } from "react";
import type { ApiKeySummary, Provider } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2, AlertTriangle, Eye, EyeOff,
  Trash2, Plus, Settings2, ExternalLink, Copy, Key,
} from "lucide-react";

/** Deterministic colored background per provider slug */
const PROVIDER_BG: Record<string, string> = {
  fal:        "#FF6B35",
  openai:     "#10A37F",
  openrouter: "#6366F1",
  elevenlabs: "#E44D26",
  anthropic:  "#D97706",
  kling:      "#7C3AED",
  google:     "#4285F4",
  wavespeed:  "#0EA5E9",
};

function slugColor(slug: string) {
  if (PROVIDER_BG[slug]) return PROVIDER_BG[slug];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) & 0xffffff;
  return `#${h.toString(16).padStart(6, "0")}`;
}

function statusMeta(status: ApiKeySummary["status"]) {
  switch (status) {
    case "valid":
      return { label: "Connected", className: "text-emerald-400", dot: "bg-emerald-400" };
    case "invalid":
      return { label: "Invalid", className: "text-red-400", dot: "bg-red-400" };
    default:
      return { label: "Unverified", className: "text-white/50", dot: "bg-white/30" };
  }
}

/** Dialog that opens when the user clicks "+ Add Key" or "Manage Key" */
function AddKeyDialog({
  open,
  onOpenChange,
  provider,
  savedKey,
  saving,
  deleting,
  error,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider: Provider;
  savedKey: ApiKeySummary | undefined;
  saving?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSave: (slug: string, key: string) => void;
  onDelete: (slug: string) => void;
}) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);

  const handleSave = () => {
    if (!value.trim()) return;
    onSave(provider.slug, value.trim());
    setValue("");
  };

  const bg = slugColor(provider.slug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border border-white/10 max-w-md p-0 overflow-hidden">
        <div className="p-6">
          {/* Provider header */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ background: bg }}
            >
              {provider.icon ? (
                <img src={provider.icon} alt={provider.name} className="w-7 h-7 object-contain" />
              ) : (
                <span className="text-white font-black text-lg">{provider.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="font-bold text-white text-base leading-tight">{provider.name}</div>
              {provider.description && (
                <div className="text-xs text-white/45 mt-0.5">{provider.description}</div>
              )}
            </div>
          </div>

          <DialogHeader className="mb-0">
            <DialogTitle className="sr-only">{savedKey ? "Manage" : "Add"} {provider.name} API Key</DialogTitle>
          </DialogHeader>

          {/* Show existing masked key when replacing */}
          {savedKey && (
            <div className="mb-4 flex items-center gap-2 bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2">
              <span className="text-xs text-white/50 font-mono tracking-widest flex-1">
                {reveal ? `…${savedKey.lastFour}` : `•••• •••• •••• ${savedKey.lastFour}`}
              </span>
              <button onClick={() => setReveal((r) => !r)} className="text-white/30 hover:text-white/70 transition-colors">
                {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* API key input */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              {savedKey ? "Replace API Key" : "API Key"}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <Input
                type="password"
                placeholder={provider.keyFormatHint ?? `Paste your ${provider.name} API key`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="bg-white/[0.05] border-white/10 text-white pl-9 text-sm h-10"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
          </div>

          {/* Docs link */}
          {provider.docsUrl && (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium mb-5 transition-colors"
            >
              Get your {provider.name} API key <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="bg-primary text-black font-bold hover:bg-primary/90 flex-1 h-9"
              disabled={!value.trim() || saving}
              onClick={handleSave}
            >
              {saving ? "Verifying…" : savedKey ? "Replace Key" : "Add Key"}
            </Button>
            {savedKey && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                disabled={deleting}
                onClick={() => { onDelete(provider.slug); onOpenChange(false); }}
                title="Remove key"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              className="h-9 text-white/40 hover:text-white px-3"
              onClick={() => { onOpenChange(false); setValue(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Static provider card — clicking the button opens AddKeyDialog */
export function ProviderKey({
  provider,
  savedKey,
  onSave,
  onDelete,
  saving,
  deleting,
  error,
}: {
  provider: Provider;
  savedKey: ApiKeySummary | undefined;
  onSave: (provider: string, apiKey: string) => void;
  onDelete: (provider: string) => void;
  saving?: boolean;
  deleting?: boolean;
  error?: string | null;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reveal, setReveal] = useState(false);

  const isDisabled = (provider as { status?: string }).status === "disabled";
  const hasKey = !!savedKey;
  const meta = hasKey ? statusMeta(savedKey.status) : null;
  const bg = slugColor(provider.slug);

  // Disabled providers: greyed out with unavailable message, no action button
  if (isDisabled) {
    const msg =
      (provider as { unavailableMessage?: string | null }).unavailableMessage ??
      "This provider is temporarily unavailable. Try another provider.";
    return (
      <div className="bg-[#141414] border border-white/[0.05] rounded-2xl p-5 flex flex-col gap-3.5 opacity-50 cursor-not-allowed h-full">
        {/* Icon — greyscale */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden grayscale"
            style={{ background: bg }}
          >
            {provider.icon ? (
              <img
                src={provider.icon}
                alt={provider.name}
                className="w-10 h-10 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span className="text-white font-black text-2xl">{provider.name.charAt(0)}</span>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-white/25 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/15 shrink-0" />
            Unavailable
          </span>
        </div>

        {/* Name + description */}
        <div>
          <div className="font-bold text-white/50 text-base leading-tight">{provider.name}</div>
          {provider.description && (
            <div className="text-xs text-white/25 mt-0.5 leading-relaxed">{provider.description}</div>
          )}
        </div>

        {/* Capability badges */}
        <div className="flex flex-wrap gap-1">
          {provider.capabilities.map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className="border-white/8 bg-white/[0.02] text-white/25 text-[10px] px-1.5 py-0 uppercase tracking-wide"
            >
              {cap}
            </Badge>
          ))}
        </div>

        {/* Unavailable message */}
        <div className="mt-auto">
          <p className="text-xs text-white/30 leading-relaxed border border-white/[0.06] rounded-lg p-2.5 bg-white/[0.02]">
            {msg}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-3.5 hover:border-white/[0.16] transition-colors h-full">
        {/* Icon + status badge */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: bg }}
          >
            {provider.icon ? (
              <img
                src={provider.icon}
                alt={provider.name}
                className="w-10 h-10 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span className="text-white font-black text-2xl">{provider.name.charAt(0)}</span>
            )}
          </div>

          {hasKey && meta ? (
            <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.className} mt-0.5`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {meta.label}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-white/35 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
              Not connected
            </span>
          )}
        </div>

        {/* Name + description */}
        <div>
          <div className="font-bold text-white text-base leading-tight">{provider.name}</div>
          {provider.description && (
            <div className="text-xs text-white/40 mt-0.5 leading-relaxed">{provider.description}</div>
          )}
        </div>

        {/* Capability badges */}
        <div className="flex flex-wrap gap-1">
          {provider.capabilities.map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className="border-white/15 bg-white/[0.04] text-white/45 text-[10px] px-1.5 py-0 uppercase tracking-wide"
            >
              {cap}
            </Badge>
          ))}
        </div>

        {/* Saved key display */}
        {hasKey && (
          <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2 -mt-0.5">
            <span className="text-xs text-white/45 font-mono tracking-widest flex-1 truncate">
              {reveal ? `…${savedKey.lastFour}` : `•••• •••• •••• ${savedKey.lastFour}`}
            </span>
            <button onClick={() => setReveal((r) => !r)} className="text-white/30 hover:text-white/60 transition-colors shrink-0">
              {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(savedKey.lastFour ?? "")}
              className="text-white/30 hover:text-white/60 transition-colors shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action button */}
        <div className="mt-auto pt-0.5">
          {hasKey ? (
            <Button
              className="bg-primary text-black font-bold hover:bg-primary/90 w-full text-sm h-9"
              onClick={() => setDialogOpen(true)}
            >
              <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Manage Key
            </Button>
          ) : (
            <Button
              className="bg-primary text-black font-bold hover:bg-primary/90 w-full text-sm h-9"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Key
            </Button>
          )}
        </div>

        {/* Docs link */}
        {provider.docsUrl ? (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-white/30 hover:text-white/55 transition-colors w-fit -mt-1"
          >
            Get API key <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <div className="h-4 -mt-1" />
        )}
      </div>

      <AddKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={provider}
        savedKey={savedKey}
        saving={saving}
        deleting={deleting}
        error={error}
        onSave={(slug, key) => { onSave(slug, key); setDialogOpen(false); }}
        onDelete={onDelete}
      />
    </>
  );
}
