import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, HelpCircle, Eye, EyeOff, RefreshCw, Trash2, Key } from "lucide-react";

// Read-only visual snapshot of the real "Add Your Keys" panel for review
// purposes. Copied verbatim from the shipped components at
// artifacts/higgsfield/src/components/provider-key.tsx and add-keys-panel.tsx
// — only the data-fetching hooks are replaced with static mock data so it can
// render without a signed-in session or a live API server.

type Provider = {
  slug: string;
  name: string;
  icon: string | null;
  capabilities: string[];
  supportsByok: boolean;
  keyFormatHint: string | null;
};

type ApiKeySummary = {
  provider: string;
  lastFour: string;
  status: "valid" | "invalid" | "unknown";
  validatedAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

function statusMeta(status: ApiKeySummary["status"]) {
  switch (status) {
    case "valid":
      return { icon: CheckCircle2, label: "Connected", className: "text-emerald-400" };
    case "invalid":
      return { icon: AlertTriangle, label: "Invalid — please update", className: "text-red-400" };
    default:
      return { icon: HelpCircle, label: "Saved — status unverified", className: "text-white/50" };
  }
}

function ProviderKey({
  provider,
  savedKey,
  errorMessage,
}: {
  provider: Provider;
  savedKey?: ApiKeySummary;
  errorMessage?: string;
}) {
  const [mode, setMode] = useState<"idle" | "editing">(errorMessage ? "editing" : "idle");
  const [value, setValue] = useState(errorMessage ? "wsp_live_badkey123" : "");
  const [reveal, setReveal] = useState(false);
  const editing = mode === "editing" || !savedKey;

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-1">
        {provider.icon ? (
          <img src={provider.icon} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/10" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
            {provider.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{provider.name}</div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {provider.capabilities.map((cap) => (
              <Badge key={cap} variant="outline" className="border-white/15 text-white/50 text-[10px] px-1.5 py-0 capitalize">
                {cap}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {savedKey && !editing ? (
        <div className="flex items-center justify-between mt-3">
          <div>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${statusMeta(savedKey.status).className}`}>
              {(() => {
                const Icon = statusMeta(savedKey.status).icon;
                return <Icon className="w-3.5 h-3.5" />;
              })()}
              {statusMeta(savedKey.status).label}
              {savedKey.status === "valid" && savedKey.validatedAt && (
                <span className="text-white/30 font-normal">
                  · verified {new Date(savedKey.validatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {reveal ? `••••••••${savedKey.lastFour}` : "•••• •••• •••• " + savedKey.lastFour}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" title="Replace this key">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-2 mt-3">
          <Input
            type="password"
            placeholder={provider.keyFormatHint ?? `Paste your ${provider.name} API key`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-white/[0.04] border-white/10 text-white"
          />
          {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}
          <div className="flex gap-2">
            <Button size="sm" className="bg-primary text-black font-bold hover:bg-primary/90">
              {savedKey ? "Replace key" : "Save key"}
            </Button>
            {savedKey && (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setMode("idle")}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const providers: Provider[] = [
  {
    slug: "wavespeed",
    name: "WaveSpeed AI",
    icon: null,
    capabilities: ["image", "video", "audio"],
    supportsByok: true,
    keyFormatHint: "Find this in your WaveSpeed AI account settings.",
  },
  {
    slug: "elevenlabs",
    name: "ElevenLabs",
    icon: null,
    capabilities: ["audio"],
    supportsByok: true,
    keyFormatHint: "Find this in your ElevenLabs profile settings.",
  },
];

export default function AddYourKeys() {
  return (
    <div className="min-h-screen bg-black p-10 flex items-start justify-center">
      <div className="w-full max-w-md bg-white/[0.03] border border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-white">Add Your Keys</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Add your own provider API keys to generate without spending platform credits.
        </p>
        <div className="space-y-3">
          <ProviderKey
            provider={providers[0]}
            savedKey={{
              provider: "wavespeed",
              lastFour: "9f2a",
              status: "valid",
              validatedAt: new Date("2026-07-10").toISOString(),
              createdAt: new Date("2026-07-01").toISOString(),
              lastUsedAt: null,
            }}
          />
          <ProviderKey
            provider={providers[1]}
            errorMessage="That API key was rejected by the provider. Please check it and try again."
          />
        </div>
      </div>
    </div>
  );
}
