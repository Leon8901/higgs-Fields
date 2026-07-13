import { useState } from "react";
import type { ApiKeySummary, Provider } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, AlertTriangle, HelpCircle,
  Eye, EyeOff, Trash2, Plus, Settings2, ExternalLink, Copy,
} from "lucide-react";

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
    setValue("");
    setMode("idle");
  };

  const isEditing = mode === "editing";
  const hasKey = !!savedKey;
  const meta = hasKey ? statusMeta(savedKey.status) : null;

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-4 hover:border-white/[0.14] transition-colors h-full">
      {/* Header: icon + status */}
      <div className="flex items-start justify-between gap-2">
        {provider.icon ? (
          <img
            src={provider.icon}
            alt={provider.name}
            className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-2xl shrink-0 select-none">
            {provider.name.charAt(0).toUpperCase()}
          </div>
        )}

        {hasKey && meta ? (
          <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.className} mt-0.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} shrink-0`} />
            {meta.label}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-white/35 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
            Not connected
          </span>
        )}
      </div>

      {/* Name + capabilities */}
      <div className="flex flex-col gap-2">
        <div className="font-bold text-white text-base leading-tight">{provider.name}</div>
        <div className="flex flex-wrap gap-1">
          {provider.capabilities.map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className="border-white/15 bg-white/[0.04] text-white/50 text-[10px] px-1.5 py-0 uppercase tracking-wide"
            >
              {cap}
            </Badge>
          ))}
        </div>
      </div>

      {/* Saved key display */}
      {hasKey && !isEditing && (
        <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2">
          <span className="text-xs text-white/50 font-mono tracking-widest flex-1 truncate">
            {reveal ? `…${savedKey.lastFour}` : `•••• •••• •••• ${savedKey.lastFour}`}
          </span>
          <button
            onClick={() => setReveal((r) => !r)}
            className="text-white/30 hover:text-white/70 transition-colors shrink-0"
          >
            {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(savedKey.lastFour ?? "")}
            className="text-white/30 hover:text-white/70 transition-colors shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editing form */}
      {isEditing && (
        <div className="space-y-2">
          <Input
            type="password"
            placeholder={provider.keyFormatHint ?? `Paste your ${provider.name} API key`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="bg-white/[0.05] border-white/10 text-white text-sm"
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-primary text-black font-bold hover:bg-primary/90 flex-1"
              disabled={!value.trim() || saving}
              onClick={handleSave}
            >
              {saving ? "Verifying…" : hasKey ? "Replace key" : "Save key"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white/40 hover:text-white"
              onClick={() => { setMode("idle"); setValue(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Action button — pushed to bottom */}
      {!isEditing && (
        <div className="flex gap-2 mt-auto pt-1">
          {hasKey ? (
            <>
              <Button
                className="bg-primary text-black font-bold hover:bg-primary/90 flex-1 text-sm h-9"
                onClick={() => { setValue(""); setMode("editing"); }}
              >
                <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Manage Key
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                disabled={deleting}
                onClick={() => onDelete(provider.slug)}
                title="Remove key"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <Button
              className="bg-primary text-black font-bold hover:bg-primary/90 w-full text-sm h-9"
              onClick={() => setMode("editing")}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Key
            </Button>
          )}
        </div>
      )}

      {/* Docs link */}
      <a
        href="#"
        className="flex items-center gap-1 text-xs text-white/30 hover:text-white/55 transition-colors w-fit -mt-1"
      >
        Get API key <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
