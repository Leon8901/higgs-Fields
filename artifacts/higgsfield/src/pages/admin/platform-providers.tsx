import { useState } from "react";
import { AdminShell } from "./shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useListAdminProviders,
  usePatchAdminProvider,
  useSetAdminProviderPlatformKey,
  useDeleteAdminProviderPlatformKey,
  useTestAdminProviderConnection,
  getListAdminProvidersQueryKey,
} from "@workspace/api-client-react";
import type { AdminProvider } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, Eye, EyeOff, Trash2,
  CheckCircle2, AlertCircle, Loader2, Zap, Server,
  HelpCircle, RefreshCw, ToggleLeft, ToggleRight,
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

function KeyStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge className="bg-white/5 text-white/30 border-white/10 text-[11px]">No key</Badge>;
  if (status === "valid") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]">Valid</Badge>;
  if (status === "invalid") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[11px]">Invalid</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px]">Unverified</Badge>;
}

function ProviderCard({ provider }: { provider: AdminProvider }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [showAddKey, setShowAddKey] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAdminProvidersQueryKey() });

  const patch = usePatchAdminProvider({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Updated" }); },
      onError: (err: any) => toast({ variant: "destructive", title: "Update failed", description: err?.data?.error ?? err?.message }),
    },
  });

  const setKey = useSetAdminProviderPlatformKey({
    mutation: {
      onSuccess: () => { invalidate(); setKeyInput(""); setShowAddKey(false); toast({ title: "Platform key saved" }); },
      onError: (err: any) => toast({ variant: "destructive", title: "Key rejected", description: err?.data?.error ?? err?.message }),
    },
  });

  const delKey = useDeleteAdminProviderPlatformKey({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Platform key removed" }); },
      onError: (err: any) => toast({ variant: "destructive", title: "Failed", description: err?.data?.error ?? err?.message }),
    },
  });

  const testConn = useTestAdminProviderConnection({
    mutation: {
      onSuccess: (result) => {
        invalidate();
        if (!result.testable) {
          toast({ title: "Not testable", description: result.reason ?? "This adapter does not support connection testing." });
        } else if (result.ok) {
          toast({ title: "Connection OK", description: result.message ?? "Key is valid." });
        } else {
          toast({ variant: "destructive", title: "Connection failed", description: result.message ?? "Key was rejected." });
        }
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Test failed", description: err?.data?.error ?? err?.message }),
    },
  });

  const color = slugColor(provider.slug);
  const hasKey = !!provider.platformKeyLastFour;

  return (
    <div className="bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
      {/* Card header */}
      <button
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: color }}
        >
          {provider.icon ? (
            <img src={provider.icon} alt={provider.name} className="w-7 h-7 object-contain" />
          ) : (
            <span className="text-white font-black text-base">{provider.name.charAt(0)}</span>
          )}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm">{provider.name}</span>
            {provider.hasAdapter ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                <Zap className="w-2.5 h-2.5 mr-1" />Adapter
              </Badge>
            ) : (
              <Badge className="bg-white/5 text-white/30 border-white/10 text-[10px]">No adapter</Badge>
            )}
            <KeyStatusBadge status={provider.platformKeyStatus ?? null} />
          </div>
          <div className="text-xs text-white/35 mt-0.5">
            {provider.modelsEnabled} enabled / {provider.modelsCataloged} cataloged
            {provider.liveAvailableModels !== null && (
              <span className="ml-2 text-white/25">· {provider.liveAvailableModels.length} live</span>
            )}
          </div>
        </div>

        {/* Platform toggle */}
        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            disabled={!provider.hasAdapter || patch.isPending}
            onClick={() =>
              patch.mutate({ slug: provider.slug, data: { platformEnabled: !provider.platformEnabled } })
            }
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
              provider.platformEnabled
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-white/5 border-white/10 text-white/40",
              (!provider.hasAdapter || patch.isPending) && "opacity-40 cursor-not-allowed",
            )}
          >
            {provider.platformEnabled ? (
              <ToggleRight className="w-3.5 h-3.5" />
            ) : (
              <ToggleLeft className="w-3.5 h-3.5" />
            )}
            {provider.platformEnabled ? "Enabled" : "Disabled"}
          </button>

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.06] space-y-4 pt-4">
          {!provider.hasAdapter && (
            <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
              <HelpCircle className="w-4 h-4 text-amber-400/60 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/80">
                No code adapter is registered for this provider. A code adapter is required before platform routing can be enabled.
              </p>
            </div>
          )}

          {/* Platform key management */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Platform Key</span>
              <div className="flex gap-2">
                {hasKey && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-white/40 hover:text-white/70"
                      disabled={testConn.isPending}
                      onClick={() => testConn.mutate({ slug: provider.slug })}
                    >
                      {testConn.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-400/60 hover:text-red-400"
                      disabled={delKey.isPending}
                      onClick={() => delKey.mutate({ slug: provider.slug })}
                    >
                      {delKey.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {hasKey ? (
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 mb-3">
                <span className="text-xs text-white/50 font-mono flex-1">
                  {showKey ? `•••• •••• •••• ${provider.platformKeyLastFour}` : `•••• •••• •••• ${provider.platformKeyLastFour}`}
                </span>
                <KeyStatusBadge status={provider.platformKeyStatus ?? null} />
              </div>
            ) : (
              <p className="text-xs text-white/30 mb-3">No platform key stored.</p>
            )}

            {!showAddKey ? (
              <button
                onClick={() => setShowAddKey(true)}
                className="text-xs text-primary/70 hover:text-primary transition-colors"
              >
                {hasKey ? "Replace key" : "Add platform key"}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="sk-…"
                    type={showKey ? "text" : "password"}
                    className="bg-white/[0.04] border-white/10 text-white text-sm h-9 flex-1 font-mono"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-primary text-black font-semibold h-8"
                    disabled={!keyInput.trim() || setKey.isPending}
                    onClick={() => setKey.mutate({ slug: provider.slug, data: { apiKey: keyInput.trim() } })}
                  >
                    {setKey.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save key"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-white/40"
                    onClick={() => { setShowAddKey(false); setKeyInput(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Live models */}
          {provider.hasAdapter && (
            <div>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Live Available Models</span>
              {provider.liveAvailableModels === null ? (
                <p className="text-xs text-white/25 mt-1.5">
                  {provider.liveAvailableModelsReason ?? "Not available"}
                </p>
              ) : (
                <p className="text-xs text-emerald-400/80 mt-1.5">
                  {provider.liveAvailableModels.length} models discoverable via API
                </p>
              )}
            </div>
          )}

          {/* Base URL override */}
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
              Base URL Override
            </label>
            <Input
              defaultValue={provider.baseUrl ?? ""}
              placeholder="https://api.example.com/v1"
              className="bg-white/[0.04] border-white/10 text-white text-sm h-9 font-mono"
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (provider.baseUrl ?? null)) {
                  patch.mutate({ slug: provider.slug, data: { baseUrl: v } });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPlatformProviders() {
  const { data: providers, isLoading } = useListAdminProviders();

  const totalEnabled = providers?.filter((p) => p.platformEnabled).length ?? 0;
  const totalModels = providers?.reduce((a, p) => a + p.modelsEnabled, 0) ?? 0;

  return (
    <AdminShell>
      <div className="px-8 py-5 border-b border-white/[0.07]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black text-white">Platform Providers</h1>
            <p className="text-xs text-white/35 mt-0.5">Manage API keys that platform-funded generation uses</p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-xl font-black text-white">{totalEnabled}</div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">Enabled</div>
            </div>
            <div>
              <div className="text-xl font-black text-white">{totalModels}</div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">Active models</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-3 max-w-4xl">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : (providers ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-white/30 gap-2">
            <Server className="w-8 h-8" />
            <p className="text-sm">No providers found</p>
          </div>
        ) : (
          (providers ?? [])
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((p) => <ProviderCard key={p.slug} provider={p} />)
        )}
      </div>
    </AdminShell>
  );
}
