import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { Show } from "@clerk/react";
import {
  useListModels,
  getListModelsQueryKey,
  useGetMe,
  useListApiKeys,
  useCreateGeneration,
  useListGenerations,
  getGetMeQueryKey,
  getListGenerationsQueryKey,
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
import {
  Zap,
  Key,
  Upload,
  X,
  Download,
  ImageIcon,
  Film,
  Music,
  ChevronDown,
  Settings2,
  Plus,
  Minus,
  AlertCircle,
  Wand2,
  Mic,
} from "lucide-react";

type Category = "image" | "video" | "audio";
type ParamField = {
  key: string; label: string; type: string;
  options?: string[]; default?: unknown;
  min?: number; max?: number; step?: number;
  required?: boolean; helpText?: string | null;
};

const basePath = import.meta.env.BASE_URL;

async function uploadFile(file: File): Promise<string> {
  const res = await fetch(`${basePath}api/storage/uploads/request-url`, {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
  });
  if (!res.ok) throw new Error("Failed to request upload URL");
  const { uploadURL, objectPath } = await res.json();
  const put = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!put.ok) throw new Error("Failed to upload file");
  return `${window.location.origin}${basePath}api/storage${objectPath}`;
}

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  image: <ImageIcon className="w-3.5 h-3.5" />,
  video: <Film className="w-3.5 h-3.5" />,
  audio: <Music className="w-3.5 h-3.5" />,
};

const PROMPT_PLACEHOLDER: Record<Category, string> = {
  image: "Describe the scene you imagine...",
  video: "Describe the scene you imagine...",
  audio: "Describe the sound you imagine...",
};

/* ─── Audio waveform background (audio empty state) ──────────────────────── */
function AudioWaveformDecor() {
  return (
    <div className="absolute inset-x-0 bottom-20 flex items-end justify-center gap-[3px] h-52 pointer-events-none overflow-hidden">
      {Array.from({ length: 64 }, (_, i) => {
        const base = 8 + (i % 6) * 7;
        const peak = Math.min(base + 18 + (i % 9) * 9, 200);
        const dur = 0.7 + (i % 7) * 0.15;
        const delay = (i % 11) * 0.09;
        return (
          <div
            key={i}
            className="w-1 rounded-full bg-primary shrink-0"
            style={{
              height: `${base}px`,
              opacity: 0.08 + (i % 4) * 0.02,
              animation: `audioWave ${dur}s ease-in-out ${delay}s infinite alternate`,
              ["--bar-min" as string]: `${base}px`,
              ["--bar-peak" as string]: `${peak}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ─── Example image card stack (empty state visual) ──────────────────────── */
function ExampleCardStack({ model }: { model: Model | null }) {
  if (!model) return null;

  const hasThumb = Boolean(model.thumbnailUrl);
  const cards = [
    { rotate: "-rotate-6", z: "z-10", scale: "scale-90", opacity: "opacity-40", translate: "-translate-x-6 translate-y-3" },
    { rotate: "-rotate-2", z: "z-20", scale: "scale-95", opacity: "opacity-60", translate: "-translate-x-2 translate-y-1" },
    { rotate: "rotate-0", z: "z-30", scale: "scale-100", opacity: "opacity-100", translate: "" },
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {cards.map((c, i) => (
        <div
          key={i}
          className={cn(
            "absolute w-36 h-44 rounded-2xl border border-white/10 overflow-hidden shadow-2xl transition-all",
            c.rotate, c.z, c.scale, c.opacity, c.translate,
          )}
          style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #111 100%)" }}
        >
          {hasThumb && i === cards.length - 1 ? (
            <img src={model.thumbnailUrl!} alt={model.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/10">
              {CATEGORY_ICON[model.category as Category]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Canvas area ─────────────────────────────────────────────────────────── */
function CanvasArea({
  model,
  category,
  batchGenerations,
  isSubmitting,
}: {
  model: Model | null;
  category: Category;
  batchGenerations: Generation[];
  isSubmitting: boolean;
}) {
  const allDone = batchGenerations.length > 0 && batchGenerations.every(
    (g) => g.status === "completed" || g.status === "failed",
  );
  const anyProcessing = batchGenerations.some(
    (g) => g.status === "pending" || g.status === "processing",
  );
  const hasResults = batchGenerations.some((g) => g.status === "completed" && (g.outputUrls?.length ?? 0) > 0);

  /* Loading state */
  if (isSubmitting || anyProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-white/40 font-medium">
          Generating{batchGenerations.length > 1
            ? ` ${batchGenerations.length} ${category === "video" ? "videos" : category === "audio" ? "tracks" : "images"}`
            : ""}…
        </p>
      </div>
    );
  }

  /* Results grid */
  if (allDone && hasResults) {
    const completed = batchGenerations.filter((g) => g.status === "completed" && (g.outputUrls?.length ?? 0) > 0);
    const failed = batchGenerations.filter((g) => g.status === "failed");
    return (
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        <div className={cn("grid gap-4 max-h-full", completed.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {completed.map((g) => {
            const url = g.outputUrls?.[0];
            return (
              <div key={g.id} className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                {g.category === "video" ? (
                  <video src={url} controls autoPlay loop className="max-h-[55vh] max-w-full object-contain" />
                ) : g.category === "audio" ? (
                  <div className="w-80 flex flex-col gap-4 p-6 bg-white/[0.03] items-center justify-center min-h-[180px]">
                    {/* Animated waveform visualizer */}
                    <div className="flex items-end justify-center gap-[2px] h-14 w-full overflow-hidden">
                      {Array.from({ length: 52 }, (_, i) => {
                        const base = 6 + (i % 8) * 5;
                        const peak = Math.min(base * 2.5, 56);
                        return (
                          <div
                            key={i}
                            className="w-0.5 bg-primary rounded-full shrink-0"
                            style={{
                              height: `${base}px`,
                              animation: `audioWave ${0.6 + (i % 7) * 0.1}s ease-in-out ${(i % 11) * 0.08}s infinite alternate`,
                              ["--bar-min" as string]: `${base}px`,
                              ["--bar-peak" as string]: `${peak}px`,
                            }}
                          />
                        );
                      })}
                    </div>
                    <audio src={url} controls className="w-full" style={{ colorScheme: "dark" }} />
                  </div>
                ) : (
                  <img src={url} alt={g.prompt} className="max-h-[55vh] max-w-full object-contain" />
                )}
                {url && (
                  <a href={url} download target="_blank" rel="noreferrer"
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            );
          })}
          {failed.map((g) => (
            <div key={g.id} className="rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center gap-2 p-6 text-red-400 text-xs text-center w-36 h-44">
              <AlertCircle className="w-6 h-6" />
              {g.errorMessage ?? "Failed"}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* Empty state */
  return (
    <div className="flex-1 relative flex flex-col items-center justify-center gap-8 select-none overflow-hidden">
      {category === "audio" ? <AudioWaveformDecor /> : <ExampleCardStack model={model} />}
      {model && (
        <div className="text-center space-y-2 relative z-10">
          {category === "audio" ? (
            <p className="text-2xl md:text-3xl font-black">
              <span className="text-white/50">Ready to give your scene </span>
              <span className="text-primary">a voice?</span>
            </p>
          ) : (
            <>
              <p className="text-white/40 text-sm font-medium">Start creating with</p>
              <p className="text-2xl md:text-3xl font-black text-primary">{model.name}</p>
            </>
          )}
          {model.description && (
            <p className="text-sm text-white/30 max-w-sm mx-auto leading-relaxed">{model.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Image upload field ──────────────────────────────────────────────────── */
function ImageUploadField({ field, value, onChange }: {
  field: ParamField; value: string | undefined; onChange: (v: string | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const handle = async (f: File | undefined) => {
    if (!f) return; setUploading(true);
    try { onChange(await uploadFile(f)); } catch { onChange(undefined); } finally { setUploading(false); }
  };
  return (
    <div>
      <label className="text-xs text-white/60 mb-1.5 block">{field.label}{field.required && <span className="text-primary ml-1">*</span>}</label>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {value ? (
        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 group cursor-pointer">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange(undefined)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className="w-14 h-14 rounded-lg border border-dashed border-white/15 flex flex-col items-center justify-center gap-1 text-white/40 hover:text-primary hover:border-primary/50 transition-colors text-[9px]">
          <Upload className="w-3 h-3" />{uploading ? "…" : "Upload"}
        </button>
      )}
    </div>
  );
}

/* ─── Reference-image "+" control (prompt row) ────────────────────────────
 * Attaches a reference image to the generation when the selected model
 * declares an `image`-type field (see IMAGE_INPUT in lib/db/seed.ts). Disabled
 * with an explanatory tooltip when the model doesn't support one, instead of
 * silently accepting an upload that would never reach the generation request. */
function ReferenceImageButton({ field, value, onChange }: {
  field: ParamField | undefined;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try { onChange(await uploadFile(f)); } catch { onChange(undefined); } finally { setUploading(false); }
  };

  if (!field) {
    return (
      <button
        type="button"
        disabled
        title="This model doesn't support reference images"
        className="shrink-0 w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/15 cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="shrink-0">
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {value ? (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          title={`Change ${field.label.toLowerCase()}`}
          className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/15 group"
        >
          <img src={value} alt="" className="w-full h-full object-cover" />
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          title={`Attach ${field.label.toLowerCase()}${field.required ? " (required)" : ""}`}
          className={cn(
            "w-8 h-8 rounded-lg border flex items-center justify-center transition-colors",
            field.required
              ? "border-primary/40 text-primary/70 hover:text-primary hover:border-primary/70"
              : "border-white/15 text-white/40 hover:text-white/70 hover:border-white/30",
          )}
        >
          {uploading ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}

/* ─── Extra settings popover (non-surfaced params) ────────────────────────── */
function ExtraSettings({ extraFields, params, onParam, imageParams, onImageParam }: {
  extraFields: ParamField[];
  params: Record<string, unknown>;
  onParam: (k: string, v: unknown) => void;
  imageParams: Record<string, string | undefined>;
  onImageParam: (k: string, v: string | undefined) => void;
}) {
  if (extraFields.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={chipClass}>
          <Settings2 className="w-3.5 h-3.5" />
          <span>More</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-68 p-4 bg-[#181818] border-white/10 shadow-2xl" side="top" align="end" sideOffset={10}>
        <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Extra settings</p>
        <div className="flex flex-col gap-4">
          {extraFields.map((field) => {
            if (field.type === "image") return (
              <ImageUploadField key={field.key} field={field} value={imageParams[field.key]} onChange={(v) => onImageParam(field.key, v)} />
            );
            if (field.type === "select") return (
              <div key={field.key}>
                <label className="text-xs text-white/60 mb-1.5 block">{field.label}</label>
                <Select value={String(params[field.key] ?? field.default ?? "")} onValueChange={(v) => onParam(field.key, v)}>
                  <SelectTrigger className="h-8 bg-white/[0.04] border-white/10 text-white text-xs focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] border-white/10">
                    {field.options?.map((o) => <SelectItem key={o} value={o} className="text-white/80 focus:bg-white/10 text-xs">{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
            if (field.type === "number") return (
              <div key={field.key}>
                <label className="text-xs text-white/60 mb-1.5 block">{field.label}</label>
                <input type="number" min={field.min} max={field.max} step={field.step ?? 1}
                  value={params[field.key] === undefined ? "" : String(params[field.key])}
                  onChange={(e) => onParam(field.key, e.target.value === "" ? undefined : Number(e.target.value))}
                  className="w-full h-8 px-3 bg-white/[0.04] border border-white/10 rounded-md text-white text-xs focus:outline-none focus:border-primary/50" />
              </div>
            );
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

/* ─── Model picker ────────────────────────────────────────────────────────── */
function ModelPicker({ models, selectedId, onSelect }: {
  models: Model[]; selectedId: string; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sel = models.find((m) => m.modelId === selectedId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={chipClass}>
          <span className="w-3.5 h-3.5 rounded-full bg-primary/80 flex items-center justify-center shrink-0">
            {CATEGORY_ICON[(sel?.category ?? "image") as Category]}
          </span>
          <span className="truncate max-w-[140px]">{sel?.name ?? "Model"}</span>
          {sel?.badge && <span className="text-[8px] font-black bg-primary text-black px-1 py-0.5 rounded uppercase shrink-0">{sel.badge}</span>}
          <ChevronDown className="w-3 h-3 text-white/40 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1 bg-[#181818] border-white/10 shadow-2xl" side="top" align="start" sideOffset={10}>
        <div className="flex flex-col gap-px max-h-72 overflow-y-auto">
          {models.map((m) => (
            <button key={m.modelId} onClick={() => { onSelect(m.modelId); setOpen(false); }}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-colors",
                m.modelId === selectedId ? "bg-primary/10 text-white" : "hover:bg-white/[0.05] text-white/70 hover:text-white")}>
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 shrink-0 overflow-hidden">
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

/* ─── Shared chip style ───────────────────────────────────────────────────── */
const chipClass =
  "flex items-center gap-1.5 px-3 h-7 rounded-full bg-white/[0.06] border border-white/[0.09] hover:bg-white/10 transition-colors text-xs font-medium text-white/70 hover:text-white shrink-0";

/* ─── Batch stepper ───────────────────────────────────────────────────────── */
function BatchStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 h-7 rounded-full bg-white/[0.06] border border-white/[0.09] px-2 shrink-0">
      <button onClick={() => onChange(Math.max(1, value - 1))}
        className="w-5 h-5 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
        <Minus className="w-2.5 h-2.5" />
      </button>
      <span className="text-xs font-medium text-white/70 w-8 text-center tabular-nums">{value}/4</span>
      <button onClick={() => onChange(Math.min(4, value + 1))}
        className="w-5 h-5 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
        <Plus className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function CategoryStudio({ category }: { category: Category }) {
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* Models */
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

  /* Generation state */
  const { data: me } = useGetMe();
  const { data: apiKeys } = useListApiKeys();
  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [imageParams, setImageParams] = useState<Record<string, string | undefined>>({});
  const [enhance, setEnhance] = useState(true);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [batchQty, setBatchQty] = useState(1);
  const [activeBatchIds, setActiveBatchIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  /* Reset on model change */
  useEffect(() => {
    if (!selectedModel) return;
    const raw = sessionStorage.getItem("regeneratePrefill");
    if (raw) {
      try {
        const pf = JSON.parse(raw) as { modelId: string; prompt: string; params: Record<string, unknown> };
        if (pf.modelId === selectedModel.modelId) {
          sessionStorage.removeItem("regeneratePrefill");
          setPrompt(pf.prompt); setParams(pf.params ?? {}); setActiveBatchIds([]); return;
        }
      } catch { sessionStorage.removeItem("regeneratePrefill"); }
    }
    const defaults: Record<string, unknown> = {};
    for (const f of selectedModel.paramsSchema.fields) {
      if (f.default !== undefined) defaults[f.key] = f.default;
    }
    setParams(defaults); setImageParams({}); setActiveBatchIds([]);
  }, [selectedModel?.modelId]);

  /* Poll batch via list query */
  const { data: allGenerations } = useListGenerations({
    query: {
      queryKey: getListGenerationsQueryKey(),
      enabled: activeBatchIds.length > 0,
      refetchInterval: activeBatchIds.length > 0 ? 2000 : false,
    },
  } as any);

  const batchGenerations: Generation[] = useMemo(() => {
    if (!allGenerations || activeBatchIds.length === 0) return [];
    return allGenerations.filter((g: Generation) => activeBatchIds.includes(g.id));
  }, [allGenerations, activeBatchIds]);

  /* Stop polling when all done */
  useEffect(() => {
    if (batchGenerations.length === activeBatchIds.length && activeBatchIds.length > 0) {
      const allDone = batchGenerations.every((g) => g.status === "completed" || g.status === "failed");
      if (allDone) {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      }
    }
  }, [batchGenerations]);

  /* Derived fields from model schema */
  const allFields: ParamField[] = selectedModel?.paramsSchema.fields ?? [];
  const aspectField = allFields.find((f) => f.key === "aspect_ratio");
  const resField = allFields.find((f) => f.key === "resolution");
  const durationField = allFields.find((f) => f.key === "duration");
  // characters = Seed Audio voice; voice_id = ElevenLabs voice
  const charsField = allFields.find((f) => f.key === "characters" || f.key === "voice_id");
  const surfacedKeys = new Set(["aspect_ratio", "resolution", "duration", "characters", "voice_id"]);
  const extraFields = allFields.filter((f) => !surfacedKeys.has(f.key) && f.type !== "image");
  const imageFields = allFields.filter((f) => f.type === "image");

  const aspectValue = String(params["aspect_ratio"] ?? aspectField?.default ?? "16:9");
  const resValue = String(params["resolution"] ?? resField?.default ?? "");
  const durationValue = String(params["duration"] ?? durationField?.default ?? "");
  const charsValue = String(params[charsField?.key ?? ""] ?? charsField?.default ?? "");

  /* Credits */
  const hasOwnKey = useMemo(
    () => apiKeys?.some((k: { provider: string; status: string }) => k.provider === selectedModel?.adapter && k.status === "valid"),
    [apiKeys, selectedModel],
  );
  const perGenCost = useOwnKey && hasOwnKey ? 0 : (selectedModel?.creditCost ?? 0);
  const totalCost = perGenCost * batchQty;
  const insufficientCredits = !!me && !useOwnKey && (me.creditsBalance ?? 0) < totalCost;
  const missingRequiredImage = imageFields.some((f) => f.required && !imageParams[f.key]);
  const canSubmit = prompt.trim().length > 0 && !insufficientCredits && !missingRequiredImage && selectedModel !== null && !isSubmitting;

  /* Submit — fire N parallel calls */
  const createGeneration = useCreateGeneration();

  const handleSubmit = async () => {
    if (!selectedModel || !canSubmit) return;
    setIsSubmitting(true);
    const merged: Record<string, unknown> = { ...params };
    for (const [k, v] of Object.entries(imageParams)) { if (v) merged[k] = v; }

    const calls = Array.from({ length: batchQty }, () =>
      (createGeneration.mutateAsync as Function)({
        data: {
          modelId: selectedModel.modelId,
          prompt: prompt.trim(),
          params: merged,
          autoSelect: false,
          useOwnKey: useOwnKey && hasOwnKey,
          skipEnhance: !enhance,
        },
      }).catch((err: any) => {
        const msg = err?.data?.error ?? err?.message ?? "Generation failed";
        toast({ title: "Generation failed", description: msg, variant: "destructive" });
        return null;
      })
    );

    try {
      const results = await Promise.all(calls);
      const ids = (results as any[]).filter(Boolean).map((r: any) => r.id as number);
      if (ids.length > 0) {
        setActiveBatchIds(ids);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const anyStillProcessing = batchGenerations.some(
    (g) => g.status === "pending" || g.status === "processing",
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">

      {/* ── Canvas ─────────────────────────────────────────────────────── */}
      {modelsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : (
        <CanvasArea
          model={selectedModel}
          category={category}
          batchGenerations={batchGenerations}
          isSubmitting={isSubmitting || anyStillProcessing}
        />
      )}

      {/* ── Unified generation card ─────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-4 pt-0">
        <div className="max-w-4xl mx-auto flex items-stretch gap-3">

          {/* Main card: prompt + chips */}
          <div className="flex-1 bg-[#141414] border border-white/[0.09] rounded-2xl overflow-hidden min-w-0">

            {/* Prompt row */}
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
              <ReferenceImageButton
                field={imageFields[0]}
                value={imageFields[0] ? imageParams[imageFields[0].key] : undefined}
                onChange={(v) => imageFields[0] && setImageParams((p) => ({ ...p, [imageFields[0].key]: v }))}
              />
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={PROMPT_PLACEHOLDER[category]}
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 resize-none focus:outline-none leading-relaxed max-h-24 overflow-y-auto"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
            </div>

            {/* Divider */}
            <div className="h-px bg-white/[0.06] mx-4" />

            {/* Controls row */}
            <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">

              {/* Model */}
              {models && models.length > 0 && (
                <ModelPicker models={models} selectedId={selectedModelId} onSelect={handleSelectModel} />
              )}

              {/* Aspect ratio */}
              {aspectField && (
                <Select value={aspectValue} onValueChange={(v) => setParams((p) => ({ ...p, aspect_ratio: v }))}>
                  <SelectTrigger className="h-7 px-3 w-auto gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.09] hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium focus:ring-0 focus:ring-offset-0 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] border-white/10">
                    {(aspectField.options ?? ["1:1","16:9","9:16","4:3","3:4"]).map((o) => (
                      <SelectItem key={o} value={o} className="text-white/80 focus:bg-white/10 text-xs">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Resolution — only show if model has this field */}
              {resField && (
                <Select value={resValue} onValueChange={(v) => setParams((p) => ({ ...p, resolution: v }))}>
                  <SelectTrigger className="h-7 px-3 w-auto gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.09] hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium focus:ring-0 focus:ring-offset-0 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] border-white/10">
                    {(resField.options ?? ["1K","2K","4K"]).map((o) => (
                      <SelectItem key={o} value={o} className="text-white/80 focus:bg-white/10 text-xs">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Duration — video (e.g. 5s, 10s) and audio (e.g. 10s, 30s, 60s) */}
              {durationField && (
                <Select value={durationValue} onValueChange={(v) => setParams((p) => ({ ...p, duration: v }))}>
                  <SelectTrigger className="h-7 px-3 w-auto gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.09] hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium focus:ring-0 focus:ring-offset-0 shrink-0">
                    <SelectValue placeholder="Duration" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] border-white/10">
                    {(durationField.options ?? []).map((o) => (
                      <SelectItem key={String(o)} value={String(o)} className="text-white/80 focus:bg-white/10 text-xs">
                        {String(o).match(/^\d+$/) ? `${o}s` : String(o)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Voice / character — audio models */}
              {charsField && (
                <Select
                  value={charsValue}
                  onValueChange={(v) => setParams((p) => ({ ...p, [charsField.key]: v }))}
                >
                  <SelectTrigger className="h-7 px-3 w-auto gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.09] hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium focus:ring-0 focus:ring-offset-0 shrink-0">
                    <Mic className="w-3 h-3 shrink-0" />
                    <SelectValue placeholder="Voice" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] border-white/10">
                    {(charsField.options ?? []).map((o) => (
                      <SelectItem key={o} value={o} className="text-white/80 focus:bg-white/10 text-xs">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Batch quantity */}
              <BatchStepper value={batchQty} onChange={setBatchQty} />

              {/* Enhance toggle */}
              <button
                onClick={() => setEnhance(!enhance)}
                title={enhance ? "Prompt enhance on (click to disable)" : "Prompt enhance off (click to enable)"}
                className={cn(
                  chipClass,
                  enhance ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20" : "",
                )}
              >
                <Wand2 className="w-3 h-3" />
                <span className="hidden sm:inline">Enhance</span>
              </button>

              {/* Extra params */}
              <ExtraSettings
                extraFields={extraFields}
                params={params}
                onParam={(k, v) => setParams((p) => ({ ...p, [k]: v }))}
                imageParams={imageParams}
                onImageParam={(k, v) => setImageParams((p) => ({ ...p, [k]: v }))}
              />

              {/* BYOK toggle (signed-in only, when key exists) */}
              <Show when="signed-in">
                {hasOwnKey && (
                  <button
                    onClick={() => setUseOwnKey(!useOwnKey)}
                    className={cn(chipClass, useOwnKey ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "")}
                  >
                    <Key className="w-3 h-3" />
                    <span className="hidden sm:inline">Own key</span>
                  </button>
                )}
              </Show>

              {/* Insufficient credits warning */}
              {insufficientCredits && (
                <Link href="/pricing">
                  <span className="text-xs text-red-400 px-3 h-7 flex items-center rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer shrink-0">
                    Low credits
                  </span>
                </Link>
              )}
            </div>
          </div>

          {/* Generate button — right side, spans full card height */}
          <div className="flex items-stretch shrink-0">
            <Show when="signed-in">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting || anyStillProcessing}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl font-bold transition-all w-24 text-black",
                  "bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed",
                  canSubmit && !isSubmitting && "shadow-[0_0_24px_rgba(206,255,0,0.20)] hover:shadow-[0_0_32px_rgba(206,255,0,0.30)]",
                )}
              >
                {isSubmitting || anyStillProcessing ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin mb-1.5" />
                    <span className="text-[10px] font-black">Working…</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-black leading-tight">Generate</span>
                    <div className="flex items-center gap-0.5 mt-1 opacity-75">
                      {totalCost === 0 ? (
                        <Key className="w-3 h-3" />
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          <span className="text-xs font-bold">{totalCost}</span>
                        </>
                      )}
                    </div>
                    {batchQty > 1 && (
                      <span className="text-[9px] font-semibold opacity-60 mt-0.5">×{batchQty}</span>
                    )}
                  </>
                )}
              </button>
            </Show>

            <Show when="signed-out">
              <Link href="/sign-up">
                <button className="flex flex-col items-center justify-center rounded-2xl font-bold bg-primary text-black hover:bg-primary/90 transition-all w-24 h-full shadow-[0_0_24px_rgba(206,255,0,0.20)]">
                  <span className="text-xs font-black text-center leading-tight px-2">Sign up to generate</span>
                </button>
              </Link>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
