import { useState } from "react";
import type { ApiKeySummary, Provider } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, HelpCircle, Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";

// The single, generic BYOK key-management UI. Every provider — present or
// future — renders through this one component, driven entirely by the
// `Provider` row (name/icon/capabilities/keyFormatHint) and the user's own
// `ApiKeySummary` for that provider. There must never be a per-provider
// component (e.g. "WaveSpeedKeyCard") anywhere in the app — extending BYOK to
// a new provider should only require a new `providers` row (and, for real
// validation, an adapter with `validateKey`), never new frontend code.
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
  const [mode, setMode] = useState<"idle" | "editing">("idle");
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);

  const handleSave = () => {
    if (!value.trim()) return;
    onSave(provider.slug, value.trim());
  };

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
            <Button
              variant="ghost"
              size="icon"
              className="text-white/50 hover:text-white"
              title="Replace this key"
              onClick={() => {
                setValue("");
                setMode("editing");
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-400 hover:text-red-300"
              disabled={deleting}
              onClick={() => onDelete(provider.slug)}
            >
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
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-primary text-black font-bold hover:bg-primary/90"
              disabled={!value.trim() || saving}
              onClick={handleSave}
            >
              {saving ? "Verifying…" : savedKey ? "Replace key" : "Save key"}
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
