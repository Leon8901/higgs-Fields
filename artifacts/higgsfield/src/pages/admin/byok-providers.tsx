import { useState } from "react";
import { AdminShell } from "./shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useListAdminProviders,
  usePatchAdminProvider,
  useSetAdminProviderIconUrl,
  getListAdminProvidersQueryKey,
} from "@workspace/api-client-react";
import type { AdminProvider } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, Link2, Loader2, Key,
  ToggleLeft, ToggleRight, X, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDER_COLORS: Record<string, string> = {
  wavespeed: "#0EA5E9",
  openai: "#10A37F",
  anthropic: "#D97706",
  google: "#4285F4",
  elevenlabs: "#E44D26",
  kling: "#7C3AED",
  fal: "#FF6B35",
  openrouter: "#6366F1",
};

function slugColor(slug: string): string {
  if (PROVIDER_COLORS[slug]) return PROVIDER_COLORS[slug];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) & 0xffffff;
  return `#${h.toString(16).padStart(6, "0")}`;
}

function ByokProviderCard({ provider }: { provider: AdminProvider }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [iconUrl, setIconUrl] = useState("");
  const [showIconInput, setShowIconInput] = useState(false);

  // Local edit state for each field
  const [description, setDescription] = useState(provider.description ?? "");
  const [docsUrl, setDocsUrl] = useState(provider.docsUrl ?? "");
  const [keyFormatHint, setKeyFormatHint] = useState(provider.keyFormatHint ?? "");
  const [unavailableMessage, setUnavailableMessage] = useState(provider.unavailableMessage ?? "");
  const [sortOrder, setSortOrder] = useState(String(provider.sortOrder ?? 0));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAdminProvidersQueryKey() });

  const patch = usePatchAdminProvider({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Saved" }); },
      onError: (err: any) => toast({ variant: "destructive", title: "Save failed", description: err?.data?.error ?? err?.message }),
    },
  });

  const setIcon = useSetAdminProviderIconUrl({
    mutation: {
      onSuccess: () => { invalidate(); setIconUrl(""); setShowIconInput(false); toast({ title: "Icon updated" }); },
      onError: (err: any) => toast({ variant: "destructive", title: "Icon import failed", description: err?.data?.error ?? err?.message }),
    },
  });

  const color = slugColor(provider.slug);
  const active = provider.status === "active";

  function saveField(field: Partial<{
    status: "active" | "disabled";
    description: string | null;
    docsUrl: string | null;
    keyFormatHint: string | null;
    unavailableMessage: string | null;
    sortOrder: number;
    icon: string | null;
  }>) {
    patch.mutate({ slug: provider.slug, data: field });
  }

  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden transition-opacity",
        active ? "bg-[#111] border-white/[0.07]" : "bg-[#0d0d0d] border-white/[0.04] opacity-75",
      )}
    >
      {/* Card header */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Grip */}
        <GripVertical className="w-4 h-4 text-white/15 shrink-0" />

        {/* Icon */}
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
            !active && "grayscale",
          )}
          style={{ background: color }}
        >
          {provider.icon ? (
            <img src={provider.icon} alt={provider.name} className="w-7 h-7 object-contain" />
          ) : (
            <span className="text-white font-black text-sm">{provider.name.charAt(0)}</span>
          )}
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("font-bold text-sm", active ? "text-white" : "text-white/40")}>{provider.name}</span>
            {!active && (
              <Badge className="bg-white/5 text-white/25 border-white/10 text-[10px]">Disabled</Badge>
            )}
          </div>
          {provider.description && (
            <p className="text-xs text-white/35 mt-0.5 truncate">{provider.description}</p>
          )}
        </div>

        {/* Status toggle */}
        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            disabled={patch.isPending}
            onClick={() => saveField({ status: active ? "disabled" : "active" })}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
              active
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-white/5 border-white/10 text-white/30 hover:border-white/20",
              patch.isPending && "opacity-50 cursor-not-allowed",
            )}
          >
            {active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            {active ? "Active" : "Disabled"}
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-white/25" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/25" />
          )}
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.06] space-y-4 pt-4">
          {/* Icon */}
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Icon</label>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                style={{ background: color }}
              >
                {provider.icon ? (
                  <img src={provider.icon} alt="" className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-white font-black">{provider.name.charAt(0)}</span>
                )}
              </div>
              {provider.icon && (
                <button
                  onClick={() => saveField({ icon: null })}
                  className="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" />Remove
                </button>
              )}
            </div>
            {!showIconInput ? (
              <button
                onClick={() => setShowIconInput(true)}
                className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
              >
                <Link2 className="w-3 h-3" />Paste icon URL
              </button>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="bg-white/[0.04] border-white/10 text-white text-sm h-9 flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && iconUrl.trim()) setIcon.mutate({ slug: provider.slug, data: { url: iconUrl.trim() } });
                    if (e.key === "Escape") { setShowIconInput(false); setIconUrl(""); }
                  }}
                />
                <Button
                  size="sm"
                  className="bg-primary text-black font-semibold h-9 shrink-0"
                  disabled={!iconUrl.trim() || setIcon.isPending}
                  onClick={() => setIcon.mutate({ slug: provider.slug, data: { url: iconUrl.trim() } })}
                >
                  {setIcon.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Import"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 text-white/40"
                  onClick={() => { setShowIconInput(false); setIconUrl(""); }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">Description</label>
            <div className="flex gap-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Short tagline shown under the provider name"
                className="bg-white/[0.04] border-white/10 text-white text-sm resize-none"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-white/40 hover:text-white/70 self-end"
                disabled={patch.isPending}
                onClick={() => saveField({ description: description.trim() || null })}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Docs URL */}
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">API Key Docs URL</label>
            <div className="flex gap-2">
              <Input
                value={docsUrl}
                onChange={(e) => setDocsUrl(e.target.value)}
                placeholder="https://platform.openai.com/api-keys"
                className="bg-white/[0.04] border-white/10 text-white text-sm h-9 flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-white/40 hover:text-white/70"
                disabled={patch.isPending}
                onClick={() => saveField({ docsUrl: docsUrl.trim() || null })}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Key format hint */}
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">Key Format Hint</label>
            <div className="flex gap-2">
              <Input
                value={keyFormatHint}
                onChange={(e) => setKeyFormatHint(e.target.value)}
                placeholder="Starts with sk-"
                className="bg-white/[0.04] border-white/10 text-white text-sm h-9 flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-white/40 hover:text-white/70"
                disabled={patch.isPending}
                onClick={() => saveField({ keyFormatHint: keyFormatHint.trim() || null })}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Unavailable message (only relevant when disabled) */}
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1">
              Unavailable Message
              <span className="text-white/25 normal-case font-normal ml-2">
                (shown to users when disabled)
              </span>
            </label>
            <div className="flex gap-2">
              <Input
                value={unavailableMessage}
                onChange={(e) => setUnavailableMessage(e.target.value)}
                placeholder="This provider is temporarily unavailable."
                className="bg-white/[0.04] border-white/10 text-white text-sm h-9 flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-white/40 hover:text-white/70"
                disabled={patch.isPending}
                onClick={() => saveField({ unavailableMessage: unavailableMessage.trim() || null })}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Sort order */}
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">Display Order</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-white/[0.04] border-white/10 text-white text-sm h-9 w-24"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-white/40 hover:text-white/70"
                disabled={patch.isPending}
                onClick={() => {
                  const n = parseInt(sortOrder, 10);
                  if (!isNaN(n)) saveField({ sortOrder: n });
                }}
              >
                Save
              </Button>
              <span className="text-xs text-white/25">Lower = shown first</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminByokProviders() {
  const { data: providers, isLoading } = useListAdminProviders();

  const total = providers?.length ?? 0;
  const activeCount = providers?.filter((p) => p.status === "active").length ?? 0;

  // Show all supportsByok providers — disabled ones shown greyed-out, not hidden
  const byokProviders = (providers ?? [])
    .filter((p) => p.supportsByok)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return (
    <AdminShell>
      <div className="px-8 py-5 border-b border-white/[0.07]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black text-white">BYOK Providers</h1>
            <p className="text-xs text-white/35 mt-0.5">
              Control which providers users can connect their own API keys for
            </p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-xl font-black text-white">{activeCount}</div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">Active</div>
            </div>
            <div>
              <div className="text-xl font-black text-white">{total}</div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">Total</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-3 max-w-3xl">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : byokProviders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-white/30 gap-2">
            <Key className="w-8 h-8" />
            <p className="text-sm">No BYOK-capable providers found</p>
          </div>
        ) : (
          byokProviders.map((p) => <ByokProviderCard key={p.slug} provider={p} />)
        )}
      </div>
    </AdminShell>
  );
}
