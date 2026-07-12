import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { Show } from "@clerk/react";
import {
  useListModels,
  getListModelsQueryKey,
  useGetMe,
  useListApiKeys,
  useCreateGeneration,
  useGetGeneration,
  getGetMeQueryKey,
  getListGenerationsQueryKey,
  getGetGenerationQueryKey,
  type Model,
  type Generation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Key,
  Sparkles,
  Upload,
  X,
  AlertCircle,
  Download,
  ImageIcon,
  Film,
  Music,
  ChevronDown,
  Settings2,
  Heart,
  LayoutGrid,
  Rows3,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Category = "image" | "video" | "audio";

const basePath = import.meta.env.BASE_URL;

/* ─── File upload ─────────────────────────────────────────────────────────── */
async function uploadFile(file: File): Promise<string> {
  const res = await fetch(`${basePath}api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
  });
  if (!res.ok) throw new Error("Failed to request upload URL");
  const { uploadURL, objectPath } = await res.json();
  const put = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!put.ok) throw new Error("Failed to upload file");
  return `${window.location.origin}${basePath}api/storage${objectPath}`;
}

/* ─── Empty state per category ────────────────────────────────────────────── */
const EMPTY_STATE: Record<Category, { label: string; headline: string; color: string }> = {
  image: {
    label: "IMAGE",
    headline: "Describe the image\nyou want to create",
    color: "from-violet-900/30 via-transparent to-transparent",
  },
  video: {
    label: "VIDEO",
    headline: "Bring your idea\nto life in motion",
    color: "from-blue-900/30 via-transparent to-transparent",
  },
  audio: {
    label: "AUDIO",
    headline: "Ready to give your\nscene a voice?",
    color: "from-pink-900/30 via-transparent to-transparent",
  },
};

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  image: <ImageIcon className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Music className="w-4 h-4" />,
};

/* ─── Canvas / result area ───────────────────────────────────────────────── */
function CanvasArea({ generation, category }: { generation: Generation | undefined; category: Category }) {
  const empty = EMPTY_STATE[category];

  if (!generation) {
    return (
      <div className={cn("flex-1 flex flex-col items-center justify-center relative overflow-hidden")}>
        <div className={cn("absolute inset-0 bg-gradient-to-b", empty.color)} />
        <div className="relative text-center select-none">
          <p className="text-xs font-semibold tracking-[0.3em] text-white/30 mb-4 uppercase">{empty.label}</p>
          <p className="text-3xl md:text-4xl font-black text-white/20 leading-tight whitespace-pre-line">
            {empty.headline}
          </p>
        </div>
      </div>
    );
  }

  if (generation.status === "pending" || generation.status === "processing") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <div className="w-14 h-14 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-white/40 font-medium tracking-wide">Generating…</p>
      </div>
    );
  }

  if (generation.status === "failed") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-sm text-red-400/80">{generation.errorMessage ?? "Generation failed. Try again."}</p>
      </div>
    );
  }

  const output = generation.outputUrls?.[0];
  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
      <div className="relative group max-h-full max-w-full">
        {generation.category === "video" ? (
          <video src={output} controls autoPlay loop className="max-h-[70vh] max-w-full rounded-xl border border-white/10 shadow-2xl" />
        ) : generation.category === "audio" ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-4">
            <Music className="w-16 h-16 text-white/20" />
            <audio src={output} controls className="w-72" />
          </div>
        ) : (
          <img src={output} alt={generation.prompt} className="max-h-[70vh] max-w-full rounded-xl border border-white/10 shadow-2xl object-contain" />
        )}
        {output && (
          <a
            href={output}
            download
            target="_blank"
            rel="noreferrer"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── Aspect ratio chip ───────────────────────────────────────────────────── */
function AspectChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = ["1:1", "16:9", "9:16", "4:3", "3:4"];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 px-3 bg-white/[0.06] border-white/10 text-white/80 text-xs font-medium w-auto gap-1.5 hover:bg-white/10 focus:ring-0 focus:ring-offset-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-[#1a1a1a] border-white/10">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-white/80 focus:text-white focus:bg-white/10 text-xs">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ─── Model selector in bottom bar ───────────────────────────────────────── */
function ModelPicker({
  models,
  selectedId,
  onSelect,
}: {
  models: Model[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = models.find((m) => m.modelId === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 px-3 h-10 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium text-white/90 shrink-0 max-w-[180px]">
          <span className="truncate">{selected?.name ?? "Select model"}</span>
          {selected?.badge && (
            <span className="text-[9px] font-black bg-primary text-black px-1 py-0.5 rounded uppercase shrink-0">
              {selected.badge}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0 ml-auto" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-1 bg-[#1a1a1a] border border-white/10 shadow-2xl"
        side="top"
        align="start"
        sideOffset={8}
      >
        <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
          {models.map((m) => (
            <button
              key={m.modelId}
              onClick={() => { onSelect(m.modelId); setOpen(false); }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                m.modelId === selectedId ? "bg-primary/15 text-white" : "hover:bg-white/[0.06] text-white/80 hover:text-white",
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white/40 shrink-0 text-xs overflow-hidden">
                {m.thumbnailUrl ? <img src={m.thumbnailUrl} alt={m.name} className="w-full h-full object-cover" /> : CATEGORY_ICON[m.category as Category]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{m.name}</span>
                  {m.badge && (
                    <span className="text-[9px] font-black bg-primary text-black px-1 py-0.5 rounded uppercase shrink-0">
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 truncate mt-0.5">{m.description}</p>
              </div>
              {m.modelId === selectedId && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Advanced params popover ────────────────────────────────────────────── */
function ParamValueDisplay(value: unknown): string {
  if (value === undefined || value === null) return "—";
  return String(value);
}

function AdvancedParams({
  model,
  params,
  onParam,
  imageValue,
  onImageChange,
}: {
  model: Model;
  params: Record<string, unknown>;
  onParam: (key: string, val: unknown) => void;
  imageValue: Record<string, string | undefined>;
  onImageChange: (key: string, val: string | undefined) => void;
}) {
  const nonSurfaced = model.paramsSchema.fields.filter(
    (f: { key: string }) => f.key !== "aspect_ratio",
  );

  if (nonSurfaced.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 transition-colors text-sm text-white/70 hover:text-white shrink-0">
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-medium">Settings</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-4 bg-[#1a1a1a] border border-white/10 shadow-2xl"
        side="top"
        align="end"
        sideOffset={8}
      >
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Advanced settings</p>
        <div className="flex flex-col gap-4">
          {nonSurfaced.map((field: { key: string; type: string; label: string; options?: string[]; default?: unknown; min?: number; max?: number; step?: number; helpText?: string; required?: boolean }) => {
            if (field.type === "image") {
              return (
                <ImageParamField
                  key={field.key}
                  field={field}
                  value={imageValue[field.key]}
                  onChange={(v) => onImageChange(field.key, v)}
                />
              );
            }
            if (field.type === "select") {
              return (
                <div key={field.key}>
                  <label className="text-xs text-white/60 mb-1.5 block">{field.label}</label>
                  <Select value={String(params[field.key] ?? field.default ?? "")} onValueChange={(v) => onParam(field.key, v)}>
                    <SelectTrigger className="h-8 bg-white/[0.04] border-white/10 text-white text-xs focus:ring-0 focus:ring-offset-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      {field.options?.map((o: string) => (
                        <SelectItem key={o} value={o} className="text-white/80 focus:text-white focus:bg-white/10 text-xs">{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            if (field.type === "number") {
              return (
                <div key={field.key}>
                  <label className="text-xs text-white/60 mb-1.5 block">{field.label}</label>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    value={params[field.key] === undefined ? "" : String(params[field.key])}
                    onChange={(e) => onParam(field.key, e.target.value === "" ? undefined : Number(e.target.value))}
                    className="w-full h-8 px-2 bg-white/[0.04] border border-white/10 rounded-md text-white text-xs focus:outline-none focus:border-primary/50"
                  />
                </div>
              );
            }
            if (field.type === "toggle") {
              return (
                <div key={field.key} className="flex items-center justify-between">
                  <label className="text-xs text-white/60">{field.label}</label>
                  <button
                    onClick={() => onParam(field.key, !Boolean(params[field.key]))}
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors",
                      Boolean(params[field.key]) ? "bg-primary" : "bg-white/15",
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow",
                      Boolean(params[field.key]) ? "translate-x-4" : "",
                    )} />
                  </button>
                </div>
              );
            }
            return null;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ImageParamField({
  field,
  value,
  onChange,
}: {
  field: { key: string; label: string; helpText?: string; required?: boolean };
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try { onChange(await uploadFile(file)); } catch { onChange(undefined); } finally { setUploading(false); }
  };

  return (
    <div>
      <label className="text-xs text-white/60 mb-1.5 block">{field.label}{field.required && <span className="text-primary ml-1">*</span>}</label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      {value ? (
        <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 group">
          <img src={value} alt={field.label} className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange(undefined)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-20 h-20 rounded-lg border border-dashed border-white/15 flex flex-col items-center justify-center gap-1.5 text-white/40 hover:text-primary hover:border-primary/50 transition-colors text-[10px]">
          <Upload className="w-4 h-4" />
          {uploading ? "…" : "Upload"}
        </button>
      )}
    </div>
  );
}

/* ─── Main studio page ───────────────────────────────────────────────────── */
export default function CategoryStudio({ category }: { category: Category }) {
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Models
  const { data: models, isLoading: modelsLoading } = useListModels(
    { category },
    { query: { queryKey: getListModelsQueryKey({ category }) } },
  );
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  useEffect(() => {
    if (!models || models.length === 0) return;
    const params = new URLSearchParams(search);
    const requested = params.get("model");
    if (requested && models.some((m) => m.modelId === requested)) {
      setSelectedModelId(requested);
      return;
    }
    setSelectedModelId((current) => {
      if (current && models.some((m) => m.modelId === current)) return current;
      return (models.find((m) => m.isFeatured) ?? models[0]).modelId;
    });
  }, [models, search]);

  const selectedModel = models?.find((m) => m.modelId === selectedModelId) ?? null;

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    const url = new URL(window.location.href);
    url.searchParams.set("model", modelId);
    window.history.replaceState({}, "", url);
  };

  // ── Generation state
  const { data: me } = useGetMe();
  const { data: apiKeys } = useListApiKeys();
  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [imageParams, setImageParams] = useState<Record<string, string | undefined>>({});
  const [enhance, setEnhance] = useState(true);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [activeGenerationId, setActiveGenerationId] = useState<number | null>(null);
  const [tab, setTab] = useState<"all" | "liked">("all");
  const [viewMode, setViewMode] = useState<"grid" | "rows">("grid");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Reset params when model changes
  useEffect(() => {
    if (!selectedModel) return;
    const prefill = sessionStorage.getItem("regeneratePrefill");
    if (prefill) {
      try {
        const p = JSON.parse(prefill) as { modelId: string; prompt: string; params: Record<string, unknown> };
        if (p.modelId === selectedModel.modelId) {
          sessionStorage.removeItem("regeneratePrefill");
          setPrompt(p.prompt);
          setParams(p.params ?? {});
          setActiveGenerationId(null);
          return;
        }
      } catch { sessionStorage.removeItem("regeneratePrefill"); }
    }
    const defaults: Record<string, unknown> = {};
    for (const field of selectedModel.paramsSchema.fields) {
      if (field.default !== undefined) defaults[field.key] = field.default;
    }
    setParams(defaults);
    setImageParams({});
    setActiveGenerationId(null);
  }, [selectedModel?.modelId]);

  const hasOwnKey = useMemo(() => apiKeys?.some((k: { provider: string }) => k.provider === selectedModel?.adapter), [apiKeys, selectedModel]);
  const effectiveCost = useOwnKey && hasOwnKey ? 0 : (selectedModel?.creditCost ?? 0);
  const insufficientCredits = !useOwnKey && (me?.creditsBalance ?? 0) < effectiveCost;
  const canSubmit = prompt.trim().length > 0 && !insufficientCredits && selectedModel !== null;

  const createGeneration = useCreateGeneration({
    mutation: {
      onSuccess: (gen) => {
        setActiveGenerationId(gen.id);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      },
      onError: (err: any) => {
        toast({
          title: "Generation failed to start",
          description: err?.data?.error ?? err?.message ?? "Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  const { data: activeGeneration } = useGetGeneration(activeGenerationId ?? 0, {
    query: {
      queryKey: getGetGenerationQueryKey(activeGenerationId ?? 0),
      enabled: !!activeGenerationId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "pending" || status === "processing" ? 2000 : false;
      },
    },
  });

  useEffect(() => {
    if (activeGeneration?.status === "completed" || activeGeneration?.status === "failed") {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
    }
  }, [activeGeneration?.status]);

  const handleSubmit = () => {
    if (!selectedModel || !canSubmit) return;
    const mergedParams = { ...params };
    for (const [k, v] of Object.entries(imageParams)) {
      if (v !== undefined) mergedParams[k] = v;
    }
    createGeneration.mutate({
      data: {
        modelId: selectedModel.modelId,
        prompt: prompt.trim(),
        params: mergedParams,
        autoSelect: false,
        useOwnKey: useOwnKey && hasOwnKey,
        skipEnhance: !enhance,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit && !createGeneration.isPending) handleSubmit();
    }
  };

  // Aspect ratio from params (surfaces inline in bottom bar for image/video)
  const aspectRatioField = selectedModel?.paramsSchema.fields.find((f: { key: string }) => f.key === "aspect_ratio");
  const aspectRatioValue = String(params["aspect_ratio"] ?? aspectRatioField?.default ?? "16:9");

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a]">

      {/* ── Left mini-sidebar ───────────────────────────────────────────── */}
      <div className="w-12 border-r border-white/5 flex flex-col items-center py-3 gap-2 shrink-0">
        <button className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors", tab === "all" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}>
          ≡
        </button>
        <button className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", tab === "liked" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}>
          <Heart className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top filter bar */}
        <div className="h-10 border-b border-white/5 flex items-center px-4 gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab("all")}
              className={cn("px-3 py-1 rounded text-xs font-medium transition-colors", tab === "all" ? "text-white" : "text-white/40 hover:text-white/70")}
            >
              All
            </button>
            <button
              onClick={() => setTab("liked")}
              className={cn("flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors", tab === "liked" ? "text-white" : "text-white/40 hover:text-white/70")}
            >
              <Heart className="w-3 h-3" /> Liked
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-colors", viewMode === "grid" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("rows")}
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-colors", viewMode === "rows" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        {modelsLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : (
          <CanvasArea generation={activeGeneration ?? undefined} category={category} />
        )}

        {/* ── Bottom prompt toolbar ─────────────────────────────────────── */}
        <div className="border-t border-white/5 bg-[#0d0d0d] px-4 py-3 shrink-0">
          <div className="flex items-end gap-2 max-w-5xl mx-auto">

            {/* Model picker */}
            {models && models.length > 0 && (
              <ModelPicker models={models} selectedId={selectedModelId} onSelect={handleSelectModel} />
            )}

            {/* Prompt */}
            <div className="flex-1 relative">
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Describe the ${category} you want to create…`}
                rows={1}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-primary/40 transition-colors leading-relaxed max-h-32 overflow-y-auto"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
            </div>

            {/* Aspect ratio chip (image/video) */}
            {aspectRatioField && (
              <AspectChip value={aspectRatioValue} onChange={(v) => setParams((p) => ({ ...p, aspect_ratio: v }))} />
            )}

            {/* Enhance toggle */}
            <button
              onClick={() => setEnhance(!enhance)}
              title={enhance ? "Prompt enhance: on" : "Prompt enhance: off"}
              className={cn(
                "w-10 h-10 rounded-xl border flex items-center justify-center transition-colors shrink-0",
                enhance ? "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25" : "bg-white/[0.06] border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10",
              )}
            >
              <Wand2 className="w-4 h-4" />
            </button>

            {/* Advanced settings */}
            {selectedModel && (
              <AdvancedParams
                model={selectedModel}
                params={params}
                onParam={(k, v) => setParams((p) => ({ ...p, [k]: v }))}
                imageValue={imageParams}
                onImageChange={(k, v) => setImageParams((p) => ({ ...p, [k]: v }))}
              />
            )}

            {/* Generate button */}
            <Show when="signed-in">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || createGeneration.isPending}
                className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 shadow-[0_0_20px_rgba(206,255,0,0.2)]"
              >
                {createGeneration.isPending ? (
                  <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Generating…</span>
                ) : (
                  <>
                    Generate
                    {effectiveCost > 0 ? (
                      <span className="flex items-center gap-0.5 font-black text-xs opacity-80"><Zap className="w-3 h-3" />{effectiveCost}</span>
                    ) : (
                      <Key className="w-3.5 h-3.5 opacity-70" />
                    )}
                  </>
                )}
              </button>
              {insufficientCredits && (
                <Link href="/pricing">
                  <Button variant="outline" size="sm" className="shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs h-10">
                    Top up
                  </Button>
                </Link>
              )}
            </Show>

            <Show when="signed-out">
              <Link href="/sign-up">
                <button className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-colors shrink-0 shadow-[0_0_20px_rgba(206,255,0,0.2)]">
                  Sign up to generate
                </button>
              </Link>
            </Show>
          </div>

          {/* BYOK toggle — below the bar when signed in and key available */}
          <Show when="signed-in">
            {hasOwnKey && (
              <div className="flex items-center gap-2 mt-2 max-w-5xl mx-auto pl-1">
                <button
                  onClick={() => setUseOwnKey(!useOwnKey)}
                  className={cn(
                    "relative w-7 h-4 rounded-full transition-colors",
                    useOwnKey ? "bg-primary" : "bg-white/15",
                  )}
                >
                  <span className={cn("absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow", useOwnKey ? "translate-x-3" : "")} />
                </button>
                <span className="text-xs text-white/40 flex items-center gap-1">
                  <Key className="w-3 h-3" /> Use my own API key
                </span>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
