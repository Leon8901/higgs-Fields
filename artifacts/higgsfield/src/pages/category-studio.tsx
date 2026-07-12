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
  Plus,
  Pencil,
} from "lucide-react";

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

/* ─── Per-category theming ────────────────────────────────────────────────── */
const CATEGORY_THEME = {
  image: {
    label: "IMAGE",
    headline: "Describe the image\nyou want to create",
    glow: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(139,92,246,0.35) 0%, rgba(109,40,217,0.12) 50%, transparent 100%)",
    textGradient: "from-white via-violet-200 to-violet-400",
    promptPlaceholder: "Describe the scene you imagine...",
  },
  video: {
    label: "VIDEO",
    headline: "Bring your idea\nto life in motion",
    glow: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(37,99,235,0.35) 0%, rgba(29,78,216,0.12) 50%, transparent 100%)",
    textGradient: "from-white via-blue-200 to-blue-400",
    promptPlaceholder: "Describe the scene you imagine...",
  },
  audio: {
    label: "AUDIO",
    headline: "Ready to give your\nscene a voice?",
    glow: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(219,39,119,0.35) 0%, rgba(157,23,77,0.12) 50%, transparent 100%)",
    textGradient: "from-white via-pink-200 to-fuchsia-400",
    promptPlaceholder: "Describe the sound you imagine...",
  },
} as const;

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  image: <ImageIcon className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Music className="w-4 h-4" />,
};

/* ─── Empty state canvas ──────────────────────────────────────────────────── */
function EmptyCanvas({ category }: { category: Category }) {
  const theme = CATEGORY_THEME[category];
  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden select-none">
      {/* Background glow */}
      <div className="absolute inset-0" style={{ background: theme.glow }} />

      {/* Crosshair brackets + text */}
      <div className="relative flex flex-col items-center gap-4 px-8">
        {/* Top-left + top-right corner brackets */}
        <div className="absolute -top-10 -left-10 w-8 h-8 border-t-2 border-l-2 border-white/20" />
        <div className="absolute -top-10 -right-10 w-8 h-8 border-t-2 border-r-2 border-white/20" />
        <div className="absolute -bottom-10 -left-10 w-8 h-8 border-b-2 border-l-2 border-white/20" />
        <div className="absolute -bottom-10 -right-10 w-8 h-8 border-b-2 border-r-2 border-white/20" />

        <p className="text-[11px] font-semibold tracking-[0.4em] text-white/40 uppercase">
          {theme.label}
        </p>
        <h1
          className={cn(
            "text-4xl md:text-5xl font-black text-center leading-tight whitespace-pre-line bg-gradient-to-b bg-clip-text text-transparent",
            theme.textGradient,
          )}
          style={{
            textShadow: "0 0 60px rgba(255,255,255,0.15)",
            filter: "drop-shadow(0 0 30px rgba(255,255,255,0.1))",
          }}
        >
          {theme.headline}
        </h1>
      </div>

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
}

/* ─── Result canvas ───────────────────────────────────────────────────────── */
function ResultCanvas({ generation }: { generation: Generation }) {
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
    <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
      <div className="relative group max-h-full max-w-full">
        {generation.category === "video" ? (
          <video src={output} controls autoPlay loop className="max-h-[65vh] max-w-full rounded-2xl border border-white/10 shadow-2xl" />
        ) : generation.category === "audio" ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-4">
            <Music className="w-16 h-16 text-white/20" />
            <audio src={output} controls className="w-72" />
          </div>
        ) : (
          <img src={output} alt={generation.prompt} className="max-h-[65vh] max-w-full rounded-2xl border border-white/10 shadow-2xl object-contain" />
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

/* ─── Image upload param ──────────────────────────────────────────────────── */
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
      <label className="text-xs text-white/60 mb-1.5 block">
        {field.label}{field.required && <span className="text-primary ml-1">*</span>}
      </label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      {value ? (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group cursor-pointer">
          <img src={value} alt={field.label} className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange(undefined)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-16 h-16 rounded-lg border border-dashed border-white/15 flex flex-col items-center justify-center gap-1 text-white/40 hover:text-primary hover:border-primary/50 transition-colors text-[10px]">
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "…" : "Upload"}
        </button>
      )}
    </div>
  );
}

/* ─── Advanced params popover ─────────────────────────────────────────────── */
function AdvancedParams({
  model,
  params,
  onParam,
  imageParams,
  onImageParam,
}: {
  model: Model;
  params: Record<string, unknown>;
  onParam: (key: string, val: unknown) => void;
  imageParams: Record<string, string | undefined>;
  onImageParam: (key: string, val: string | undefined) => void;
}) {
  const extra = model.paramsSchema.fields.filter(
    (f: { key: string }) => f.key !== "aspect_ratio",
  );
  if (extra.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/[0.07] border border-white/10 hover:bg-white/12 transition-colors text-xs text-white/60 hover:text-white/90 shrink-0">
          <Settings2 className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 bg-[#181818] border-white/10 shadow-2xl" side="top" align="end" sideOffset={10}>
        <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Advanced settings</p>
        <div className="flex flex-col gap-4">
          {extra.map((field: { key: string; type: string; label: string; options?: string[]; default?: unknown; min?: number; max?: number; step?: number; required?: boolean }) => {
            if (field.type === "image") {
              return (
                <ImageParamField key={field.key} field={field} value={imageParams[field.key]} onChange={(v) => onImageParam(field.key, v)} />
              );
            }
            if (field.type === "select") {
              return (
                <div key={field.key}>
                  <label className="text-xs text-white/60 mb-1.5 block">{field.label}</label>
                  <Select value={String(params[field.key] ?? field.default ?? "")} onValueChange={(v) => onParam(field.key, v)}>
                    <SelectTrigger className="h-8 bg-white/[0.04] border-white/10 text-white text-xs focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#181818] border-white/10">
                      {field.options?.map((o: string) => (
                        <SelectItem key={o} value={o} className="text-white/80 focus:bg-white/10 text-xs">{o}</SelectItem>
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
                  <input type="number" min={field.min} max={field.max} step={field.step ?? 1}
                    value={params[field.key] === undefined ? "" : String(params[field.key])}
                    onChange={(e) => onParam(field.key, e.target.value === "" ? undefined : Number(e.target.value))}
                    className="w-full h-8 px-3 bg-white/[0.04] border border-white/10 rounded-md text-white text-xs focus:outline-none focus:border-primary/50" />
                </div>
              );
            }
            if (field.type === "toggle") {
              const on = Boolean(params[field.key] ?? field.default);
              return (
                <div key={field.key} className="flex items-center justify-between">
                  <label className="text-xs text-white/60">{field.label}</label>
                  <button onClick={() => onParam(field.key, !on)}
                    className={cn("relative w-9 h-5 rounded-full transition-colors", on ? "bg-primary" : "bg-white/15")}>
                    <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow", on ? "translate-x-4" : "")} />
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

/* ─── Model picker popover ────────────────────────────────────────────────── */
function ModelPicker({ models, selectedId, onSelect }: {
  models: Model[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = models.find((m) => m.modelId === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/[0.07] border border-white/10 hover:bg-white/12 transition-colors text-xs font-medium text-white/80 shrink-0 max-w-[200px]">
          <div className="w-3.5 h-3.5 rounded-full bg-primary/70 shrink-0 flex items-center justify-center">
            {CATEGORY_ICON[(selected?.category ?? "image") as Category]}
          </div>
          <span className="truncate">{selected?.name ?? "Select model"}</span>
          {selected?.badge && (
            <span className="text-[8px] font-black bg-primary text-black px-1 py-0.5 rounded uppercase shrink-0 leading-none">
              {selected.badge}
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-white/40 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1 bg-[#181818] border-white/10 shadow-2xl" side="top" align="start" sideOffset={10}>
        <div className="flex flex-col gap-px max-h-72 overflow-y-auto">
          {models.map((m) => (
            <button key={m.modelId} onClick={() => { onSelect(m.modelId); setOpen(false); }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors w-full",
                m.modelId === selectedId ? "bg-primary/10 text-white" : "hover:bg-white/[0.05] text-white/70 hover:text-white",
              )}>
              <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white/30 shrink-0 overflow-hidden">
                {m.thumbnailUrl ? <img src={m.thumbnailUrl} alt={m.name} className="w-full h-full object-cover" /> : CATEGORY_ICON[m.category as Category]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{m.name}</span>
                  {m.badge && <span className="text-[8px] font-black bg-primary text-black px-1 py-0.5 rounded uppercase shrink-0">{m.badge}</span>}
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

/* ─── Main studio page ───────────────────────────────────────────────────── */
export default function CategoryStudio({ category }: { category: Category }) {
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = CATEGORY_THEME[category];

  const { data: models, isLoading: modelsLoading } = useListModels(
    { category },
    { query: { queryKey: getListModelsQueryKey({ category }) } },
  );
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  useEffect(() => {
    if (!models || models.length === 0) return;
    const p = new URLSearchParams(search);
    const requested = p.get("model");
    if (requested && models.some((m) => m.modelId === requested)) {
      setSelectedModelId(requested);
      return;
    }
    setSelectedModelId((cur) => {
      if (cur && models.some((m) => m.modelId === cur)) return cur;
      return (models.find((m) => m.isFeatured) ?? models[0]).modelId;
    });
  }, [models, search]);

  const selectedModel = models?.find((m) => m.modelId === selectedModelId) ?? null;

  const handleSelectModel = (id: string) => {
    setSelectedModelId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("model", id);
    window.history.replaceState({}, "", url);
  };

  /* Generation */
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

  useEffect(() => {
    if (!selectedModel) return;
    const raw = sessionStorage.getItem("regeneratePrefill");
    if (raw) {
      try {
        const pf = JSON.parse(raw) as { modelId: string; prompt: string; params: Record<string, unknown> };
        if (pf.modelId === selectedModel.modelId) {
          sessionStorage.removeItem("regeneratePrefill");
          setPrompt(pf.prompt);
          setParams(pf.params ?? {});
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
        toast({ title: "Generation failed to start", description: err?.data?.error ?? err?.message ?? "Please try again.", variant: "destructive" });
      },
    },
  });

  const { data: activeGeneration } = useGetGeneration(activeGenerationId ?? 0, {
    query: {
      queryKey: getGetGenerationQueryKey(activeGenerationId ?? 0),
      enabled: !!activeGenerationId,
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return s === "pending" || s === "processing" ? 2000 : false;
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
    if (!selectedModel || !canSubmit || createGeneration.isPending) return;
    const merged = { ...params };
    for (const [k, v] of Object.entries(imageParams)) {
      if (v !== undefined) merged[k] = v;
    }
    createGeneration.mutate({
      data: { modelId: selectedModel.modelId, prompt: prompt.trim(), params: merged, autoSelect: false, useOwnKey: useOwnKey && hasOwnKey, skipEnhance: !enhance },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const aspectField = selectedModel?.paramsSchema.fields.find((f: { key: string }) => f.key === "aspect_ratio");
  const aspectValue = String(params["aspect_ratio"] ?? aspectField?.default ?? "16:9");

  const isGenerating = createGeneration.isPending || activeGeneration?.status === "pending" || activeGeneration?.status === "processing";

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#0a0a0a] overflow-hidden">

      {/* ── Left mini-sidebar ───────────────────────────────────────────── */}
      <aside className="w-11 border-r border-white/[0.06] flex flex-col items-center pt-2 pb-3 gap-1 shrink-0">
        <button
          onClick={() => setTab("all")}
          title="All generations"
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors",
            tab === "all" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60 hover:bg-white/5",
          )}
        >
          ≡
        </button>
        <button
          onClick={() => setTab("liked")}
          title="Liked"
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            tab === "liked" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60 hover:bg-white/5",
          )}
        >
          <Heart className="w-3.5 h-3.5" />
        </button>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Filter bar */}
        <div className="h-9 border-b border-white/[0.06] flex items-center px-3 gap-1 shrink-0">
          <button
            onClick={() => setTab("all")}
            className={cn("px-3 h-6 rounded text-xs font-medium transition-colors", tab === "all" ? "text-white bg-white/8" : "text-white/40 hover:text-white/70")}
          >
            All
          </button>
          <button
            onClick={() => setTab("liked")}
            className={cn("flex items-center gap-1 px-3 h-6 rounded text-xs font-medium transition-colors", tab === "liked" ? "text-white bg-white/8" : "text-white/40 hover:text-white/70")}
          >
            <Heart className="w-3 h-3" /> Liked
          </button>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("w-6 h-6 rounded flex items-center justify-center transition-colors", viewMode === "grid" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("rows")}
              className={cn("w-6 h-6 rounded flex items-center justify-center transition-colors", viewMode === "rows" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}
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
        ) : activeGeneration ? (
          <ResultCanvas generation={activeGeneration} />
        ) : (
          <EmptyCanvas category={category} />
        )}

        {/* ── Bottom toolbar ──────────────────────────────────────────── */}
        <div className="shrink-0 px-3 pb-3 pt-2 border-t border-white/[0.06]">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">

            {/* Prompt pill + chips row */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              {/* Prompt input */}
              <div className="flex items-center gap-2 bg-[#161616] border border-white/[0.09] rounded-2xl px-4 py-3">
                {/* + icon */}
                <button className="text-white/30 hover:text-white/70 transition-colors shrink-0">
                  <Plus className="w-4 h-4" />
                </button>

                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={theme.promptPlaceholder}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 resize-none focus:outline-none leading-relaxed max-h-28 overflow-y-auto"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                />
              </div>

              {/* Chips row */}
              <div className="flex items-center gap-2 flex-wrap px-1">
                {/* Model chip */}
                {models && models.length > 0 && (
                  <ModelPicker models={models} selectedId={selectedModelId} onSelect={handleSelectModel} />
                )}

                {/* Aspect ratio */}
                {aspectField && (
                  <Select value={aspectValue} onValueChange={(v) => setParams((p) => ({ ...p, aspect_ratio: v }))}>
                    <SelectTrigger className="h-8 px-3 bg-white/[0.07] border border-white/10 text-white/80 text-xs font-medium w-auto gap-1.5 hover:bg-white/12 focus:ring-0 rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#181818] border-white/10">
                      {["1:1", "16:9", "9:16", "4:3", "3:4"].map((o) => (
                        <SelectItem key={o} value={o} className="text-white/80 focus:bg-white/10 text-xs">{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Enhance toggle */}
                <button
                  onClick={() => setEnhance(!enhance)}
                  title={enhance ? "Prompt enhance on" : "Prompt enhance off"}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors",
                    enhance
                      ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                      : "bg-white/[0.07] border-white/10 text-white/50 hover:text-white/80 hover:bg-white/12",
                  )}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Enhance</span>
                </button>

                {/* Draw (placeholder) */}
                <button className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/[0.07] border border-white/10 hover:bg-white/12 transition-colors text-xs text-white/50 hover:text-white/80">
                  <Pencil className="w-3 h-3" />
                  <span className="hidden sm:inline">Draw</span>
                </button>

                {/* Advanced settings */}
                {selectedModel && (
                  <AdvancedParams
                    model={selectedModel}
                    params={params}
                    onParam={(k, v) => setParams((p) => ({ ...p, [k]: v }))}
                    imageParams={imageParams}
                    onImageParam={(k, v) => setImageParams((p) => ({ ...p, [k]: v }))}
                  />
                )}

                {/* BYOK toggle */}
                <Show when="signed-in">
                  {hasOwnKey && (
                    <button onClick={() => setUseOwnKey(!useOwnKey)} className={cn("flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs transition-colors", useOwnKey ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-white/[0.07] border-white/10 text-white/40 hover:text-white/70 hover:bg-white/12")}>
                      <Key className="w-3 h-3" />
                      <span className="hidden sm:inline">Own key</span>
                    </button>
                  )}
                </Show>

                {/* Credit balance */}
                <Show when="signed-in">
                  {insufficientCredits && (
                    <Link href="/pricing">
                      <span className="text-xs text-red-400 px-3 h-8 flex items-center rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer">
                        Low credits — Top up
                      </span>
                    </Link>
                  )}
                </Show>
              </div>
            </div>

            {/* Generate button — large, separate, right side */}
            <Show when="signed-in">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isGenerating}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl font-bold transition-all shrink-0 shadow-lg",
                  "w-[88px] h-[88px] text-black bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed",
                  !isGenerating && canSubmit && "shadow-[0_0_30px_rgba(206,255,0,0.25)] hover:shadow-[0_0_40px_rgba(206,255,0,0.35)]",
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin mb-1" />
                    <span className="text-[10px] font-black leading-none">GEN…</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-black leading-none">Generate</span>
                    <div className="flex items-center gap-0.5 mt-1.5 opacity-70">
                      <Zap className="w-3 h-3" />
                      <span className="text-xs font-bold">{effectiveCost > 0 ? effectiveCost : "free"}</span>
                    </div>
                  </>
                )}
              </button>
            </Show>

            <Show when="signed-out">
              <Link href="/sign-up">
                <button className="flex flex-col items-center justify-center rounded-2xl font-bold bg-primary text-black hover:bg-primary/90 transition-all shrink-0 shadow-[0_0_30px_rgba(206,255,0,0.25)] w-[88px] h-[88px]">
                  <span className="text-xs font-black leading-tight text-center px-1">Sign up to<br />generate</span>
                </button>
              </Link>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
