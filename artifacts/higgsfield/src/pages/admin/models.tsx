import { useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Upload,
  Link2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Search,
  Filter,
} from "lucide-react";
import {
  useListAdminModels,
  usePatchAdminModel,
  useSetAdminModelThumbnailUrl,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import type { AdminModel } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { AdminShell } from "./shell";

const PAGE_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Adapter color ──────────────────────────────────────────────────────────────
const ADAPTER_BG: Record<string, string> = {
  wavespeed: "#0EA5E9",
  openai: "#10A37F",
  openrouter: "#6366F1",
  elevenlabs: "#E44D26",
  anthropic: "#D97706",
  kling: "#7C3AED",
  google: "#4285F4",
  fal: "#FF6B35",
};

function adapterColor(slug: string) {
  if (ADAPTER_BG[slug]) return ADAPTER_BG[slug];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) & 0xffffff;
  return `#${h.toString(16).padStart(6, "0")}`;
}

const BADGE_OPTIONS = ["", "NEW", "TRENDING", "HOT", "TOP"] as const;

function categoryColor(cat: string) {
  if (cat === "image") return "bg-violet-500/15 text-violet-400";
  if (cat === "video") return "bg-blue-500/15 text-blue-400";
  if (cat === "audio") return "bg-emerald-500/15 text-emerald-400";
  return "bg-white/[0.06] text-white/40";
}

function badgeColor(b: string | null) {
  if (b === "NEW") return "bg-primary/15 text-primary";
  if (b === "TRENDING") return "bg-orange-500/15 text-orange-400";
  if (b === "HOT") return "bg-red-500/15 text-red-400";
  if (b === "TOP") return "bg-purple-500/15 text-purple-400";
  return "";
}

// ── Thumbnail Upload ───────────────────────────────────────────────────────────

function ThumbnailUpload({
  model,
  onUpdated,
}: {
  model: AdminModel;
  onUpdated: (updated: AdminModel) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasting, setPasting] = useState(false);
  const requestUploadUrl = useRequestUploadUrl();
  const patchModel = usePatchAdminModel();
  const setThumbnailUrl = useSetAdminModelThumbnailUrl();

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
      const thumbnailPath = `/api/storage${res.objectPath}`;
      const updated = await patchModel.mutateAsync({
        modelId: model.modelId,
        data: { thumbnailUrl: thumbnailPath },
      });
      toast({ title: "Thumbnail updated" });
      onUpdated(updated);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handlePasteUrl() {
    if (!pasteUrl.trim()) return;
    setPasting(true);
    try {
      const updated = await setThumbnailUrl.mutateAsync({
        modelId: model.modelId,
        data: { url: pasteUrl.trim() },
      });
      setPasteMode(false);
      setPasteUrl("");
      toast({ title: "Thumbnail updated" });
      onUpdated(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    } finally {
      setPasting(false);
    }
  }

  async function handleClear() {
    try {
      const updated = await patchModel.mutateAsync({
        modelId: model.modelId,
        data: { thumbnailUrl: null },
      });
      toast({ title: "Thumbnail removed" });
      onUpdated(updated);
    } catch {
      toast({ title: "Failed to remove thumbnail", variant: "destructive" });
    }
  }

  const thumbSrc = model.thumbnailUrl
    ? model.thumbnailUrl.startsWith("/api/storage")
      ? `${PAGE_BASE}${model.thumbnailUrl}`
      : model.thumbnailUrl
    : null;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
        Thumbnail
      </Label>

      {/* Current thumbnail or empty state */}
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center shrink-0 overflow-hidden">
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt={model.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-white/20" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || pasting}
            className="border-white/15 text-white/70 hover:bg-white/5 h-8 text-xs"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Upload className="w-3 h-3 mr-1" />
            )}
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
          {model.thumbnailUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={uploading || pasting}
              className="h-8 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
            >
              <X className="w-3 h-3 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </div>

      {pasteMode && (
        <div className="flex gap-2">
          <Input
            placeholder="https://…/thumbnail.jpg"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePasteUrl();
              if (e.key === "Escape") {
                setPasteMode(false);
                setPasteUrl("");
              }
            }}
            className="bg-white/[0.04] border-white/10 text-white text-xs h-8"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handlePasteUrl}
            disabled={!pasteUrl.trim() || pasting}
            className="bg-primary text-black font-bold hover:bg-primary/90 h-8 text-xs shrink-0"
          >
            {pasting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPasteMode(false);
              setPasteUrl("");
            }}
            className="h-8 text-white/40 hover:text-white shrink-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Model Card ─────────────────────────────────────────────────────────────────

function ModelCard({
  model: initialModel,
}: {
  model: AdminModel;
}) {
  const [model, setModel] = useState(initialModel);
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable field state — reset from model when collapsed
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description);
  const [badge, setBadge] = useState(model.badge ?? "");
  const [sortOrder, setSortOrder] = useState(String(model.sortOrder));
  const [creditCost, setCreditCost] = useState(String(model.creditCost));

  const patchModel = usePatchAdminModel();

  const hasDetailChanges =
    name.trim() !== model.name ||
    description !== model.description ||
    badge !== (model.badge ?? "") ||
    sortOrder !== String(model.sortOrder) ||
    creditCost !== String(model.creditCost);

  async function toggleActive() {
    setToggling(true);
    try {
      const updated = await patchModel.mutateAsync({
        modelId: model.modelId,
        data: { isActive: !model.isActive },
      });
      setModel(updated);
      toast({
        title: updated.isActive
          ? `${model.name} enabled`
          : `${model.name} disabled — hidden from public listing`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  }

  async function saveDetails() {
    const so = parseInt(sortOrder, 10);
    const cc = parseInt(creditCost, 10);
    if (isNaN(so) || so < 0) {
      toast({ title: "Sort order must be a non-negative integer", variant: "destructive" });
      return;
    }
    if (isNaN(cc) || cc < 0) {
      toast({ title: "Credit cost must be a non-negative integer", variant: "destructive" });
      return;
    }
    if (!name.trim()) {
      toast({ title: "Name cannot be empty", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updated = await patchModel.mutateAsync({
        modelId: model.modelId,
        data: {
          name: name.trim(),
          description,
          badge: badge || null,
          sortOrder: so,
          creditCost: cc,
        },
      });
      setModel(updated);
      // Sync local state to reflect what's now saved
      setName(updated.name);
      setDescription(updated.description);
      setBadge(updated.badge ?? "");
      setSortOrder(String(updated.sortOrder));
      setCreditCost(String(updated.creditCost));
      toast({ title: "Model updated" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function discardDetails() {
    setName(model.name);
    setDescription(model.description);
    setBadge(model.badge ?? "");
    setSortOrder(String(model.sortOrder));
    setCreditCost(String(model.creditCost));
  }

  const thumbSrc = model.thumbnailUrl
    ? model.thumbnailUrl.startsWith("/api/storage")
      ? `${PAGE_BASE}${model.thumbnailUrl}`
      : model.thumbnailUrl
    : null;

  const color = adapterColor(model.adapter);

  return (
    <div
      className={cn(
        "bg-[#141414] border rounded-xl transition-colors overflow-hidden",
        expanded ? "border-white/[0.12]" : "border-white/[0.08]",
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden bg-white/[0.03]">
          {thumbSrc ? (
            <img src={thumbSrc} alt={model.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-xs font-black text-black/60"
              style={{ backgroundColor: color }}
            >
              {model.adapter.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {model.name}
            </span>
            {model.badge && (
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                  badgeColor(model.badge),
                )}
              >
                {model.badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize",
                categoryColor(model.category),
              )}
            >
              {model.category}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white/50 bg-white/[0.06]"
            >
              {model.adapter}
            </span>
            <span className="text-[10px] text-white/30">
              {model.creditCost}cr
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">{model.isActive ? "Active" : "Inactive"}</span>
            <Switch
              checked={model.isActive}
              onCheckedChange={toggleActive}
              disabled={toggling}
              aria-label="Enable model"
            />
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            aria-label={expanded ? "Collapse" : "Expand settings"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div className="border-t border-white/[0.08] p-5 space-y-5">
          {/* Thumbnail */}
          <ThumbnailUpload
            model={model}
            onUpdated={(updated) => setModel(updated)}
          />

          <div className="h-px bg-white/[0.06]" />

          {/* Name */}
          <div>
            <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/[0.04] border-white/10 text-white text-sm h-9 mt-1.5 max-w-md"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Description
            </Label>
            <p className="text-xs text-white/30 mt-0.5 mb-1.5">
              Shown on model cards and tool detail pages.
            </p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/[0.04] border-white/10 text-white text-sm max-w-lg"
              rows={2}
            />
          </div>

          {/* Badge + Sort + Credits row */}
          <div className="flex flex-wrap gap-4">
            {/* Badge picker */}
            <div>
              <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Badge
              </Label>
              <Select value={badge} onValueChange={setBadge}>
                <SelectTrigger className="bg-white/[0.04] border-white/10 text-white text-sm h-9 mt-1.5 w-36">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {BADGE_OPTIONS.map((b) => (
                    <SelectItem
                      key={b || "__none__"}
                      value={b}
                      className="text-white focus:bg-white/10 focus:text-white"
                    >
                      {b || "None"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort order */}
            <div>
              <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Sort Order
              </Label>
              <Input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-white/[0.04] border-white/10 text-white text-sm h-9 mt-1.5 w-24"
              />
            </div>

            {/* Credit cost */}
            <div>
              <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Credits / Gen
              </Label>
              <Input
                type="number"
                min={0}
                value={creditCost}
                onChange={(e) => setCreditCost(e.target.value)}
                className="bg-white/[0.04] border-white/10 text-white text-sm h-9 mt-1.5 w-24"
              />
            </div>
          </div>

          {/* Read-only info */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/25">
            <span>
              <span className="text-white/40">Model ID:</span> {model.modelId}
            </span>
            <span>
              <span className="text-white/40">Provider path:</span>{" "}
              {model.providerModelPath}
            </span>
            <span>
              <span className="text-white/40">Base price:</span> ${model.basePriceUsd.toFixed(4)}
            </span>
          </div>

          {/* Save / discard */}
          {hasDetailChanges && (
            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={saveDetails}
                disabled={saving}
                size="sm"
                className="h-9 bg-primary text-black font-bold hover:bg-primary/90"
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving…</>
                ) : (
                  <>Save changes</>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={discardDetails}
                disabled={saving}
                className="text-white/40 hover:text-white h-9"
              >
                Discard
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter chip helper ─────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
        active
          ? "bg-primary text-black border-primary"
          : "text-white/50 border-white/[0.08] hover:text-white hover:border-white/20 bg-transparent",
      )}
    >
      {label}
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminModels() {
  const { data: models = [], isLoading, error, refetch } = useListAdminModels();

  const [search, setSearch] = useState("");
  const [adapterFilter, setAdapterFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Derive unique adapter and category values from real data — never hardcoded
  const adapters = useMemo(
    () => [...new Set(models.map((m) => m.adapter))].sort(),
    [models],
  );
  const categories = useMemo(
    () => [...new Set(models.map((m) => m.category))].sort(),
    [models],
  );

  // Combined filter: search × adapter × category
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return models.filter((m) => {
      if (adapterFilter !== "all" && m.adapter !== adapterFilter) return false;
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      if (q && !m.name.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [models, search, adapterFilter, categoryFilter]);

  return (
    <AdminShell>
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-white">Models</h1>
            <p className="text-sm text-white/40 mt-0.5">
              {isLoading
                ? "Loading…"
                : `${models.length} model${models.length !== 1 ? "s" : ""} · ${filtered.length} shown`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-white/40 hover:text-white h-8 text-xs"
          >
            Refresh
          </Button>
        </div>

        {/* Toolbar */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
            <Input
              placeholder="Search by name or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus-visible:border-white/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Adapter filter — derived from real data */}
          {adapters.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-white/30 shrink-0" />
              <FilterChip
                label="All providers"
                active={adapterFilter === "all"}
                onClick={() => setAdapterFilter("all")}
              />
              {adapters.map((a) => (
                <FilterChip
                  key={a}
                  label={a}
                  active={adapterFilter === a}
                  onClick={() => setAdapterFilter(adapterFilter === a ? "all" : a)}
                />
              ))}
            </div>
          )}

          {/* Category filter — derived from real data */}
          {categories.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-3.5 shrink-0" />
              <FilterChip
                label="All types"
                active={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
              />
              {categories.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  active={categoryFilter === c}
                  onClick={() =>
                    setCategoryFilter(categoryFilter === c ? "all" : c)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* States */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
            Failed to load models. Check that the API server is running, then refresh.
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-white/25">
            <Search className="w-8 h-8" />
            <p className="text-sm">No models match the current filters</p>
          </div>
        )}

        {/* Model cards */}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((model) => (
              <ModelCard key={model.modelId} model={model} />
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
