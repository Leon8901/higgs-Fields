import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetMe,
  useListApiKeys,
  useCreateGeneration,
  useGetGeneration,
  getGetMeQueryKey,
  getListGenerationsQueryKey,
  getGetGenerationQueryKey,
  type Model,
  type ModelParamField,
  type Generation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Zap, Key, Sparkles, Upload, X, AlertCircle, Download } from "lucide-react";

// Everything below (ImageField, ParamField, ResultPanel, uploadFile, and the
// generate/submit/regenerate-prefill logic) is lifted verbatim from the old
// per-tool page (tool-detail.tsx) — this is a routing/UI reorganization only,
// the generation, credit, and BYOK-key behavior is untouched.

const basePath = import.meta.env.BASE_URL;

async function uploadFile(file: File): Promise<string> {
  const requestRes = await fetch(`${basePath}api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
  });
  if (!requestRes.ok) throw new Error("Failed to request an upload URL");
  const { uploadURL, objectPath } = await requestRes.json();

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) throw new Error("Failed to upload file");

  return `${window.location.origin}${basePath}api/storage${objectPath}`;
}

function ImageField({
  field,
  value,
  onChange,
}: {
  field: ModelParamField;
  value: unknown;
  onChange: (v: string | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = typeof value === "string" ? value : undefined;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      onChange(uploaded);
    } catch {
      onChange(undefined);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Label className="text-white/80 mb-2 block">
        {field.label}
        {field.required && <span className="text-primary ml-1">*</span>}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {url ? (
        <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/10 group">
          <img src={url} alt={field.label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-32 h-32 rounded-xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-2 text-white/40 hover:text-primary hover:border-primary/50 transition-colors text-xs"
        >
          <Upload className="w-5 h-5" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
      )}
      {field.helpText && <p className="text-xs text-white/40 mt-1.5">{field.helpText}</p>}
    </div>
  );
}

function ParamField({
  field,
  value,
  onChange,
}: {
  field: ModelParamField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "image":
      return <ImageField field={field} value={value} onChange={onChange} />;
    case "toggle":
      return (
        <div className="flex items-center justify-between py-1">
          <div>
            <Label className="text-white/80">{field.label}</Label>
            {field.helpText && <p className="text-xs text-white/40 mt-0.5">{field.helpText}</p>}
          </div>
          <Switch checked={Boolean(value)} onCheckedChange={onChange} className="data-[state=checked]:bg-primary" />
        </div>
      );
    case "select":
      return (
        <div>
          <Label className="text-white/80 mb-2 block">{field.label}</Label>
          <Select value={String(value ?? field.default ?? "")} onValueChange={onChange}>
            <SelectTrigger className="bg-white/[0.04] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "number":
      return (
        <div>
          <Label className="text-white/80 mb-2 block">{field.label}</Label>
          <Input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            className="bg-white/[0.04] border-white/10 text-white"
          />
        </div>
      );
    case "textarea":
      return (
        <div>
          <Label className="text-white/80 mb-2 block">{field.label}</Label>
          <Textarea
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white/[0.04] border-white/10 text-white min-h-24"
          />
        </div>
      );
    default:
      return (
        <div>
          <Label className="text-white/80 mb-2 block">{field.label}</Label>
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white/[0.04] border-white/10 text-white"
          />
        </div>
      );
  }
}

function ResultPanel({ generation }: { generation: Generation | undefined }) {
  if (!generation) {
    return (
      <div className="aspect-square rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 text-white/30">
        <Sparkles className="w-8 h-8" />
        <p className="text-sm">Your generation will appear here</p>
      </div>
    );
  }

  if (generation.status === "failed") {
    return (
      <div className="aspect-square rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center gap-3 text-red-400 text-center px-6">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{generation.errorMessage ?? "Generation failed"}</p>
      </div>
    );
  }

  if (generation.status === "pending" || generation.status === "processing") {
    return (
      <div className="aspect-square rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col items-center justify-center gap-3 text-white/50">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm">Generating…</p>
      </div>
    );
  }

  const output = generation.outputUrls?.[0];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40 relative group">
      {generation.category === "video" ? (
        <video src={output} controls autoPlay loop className="w-full aspect-square object-cover" />
      ) : generation.category === "audio" ? (
        <div className="aspect-square flex items-center justify-center p-8">
          <audio src={output} controls className="w-full" />
        </div>
      ) : (
        <img src={output} alt={generation.prompt} className="w-full aspect-square object-cover" />
      )}
      {output && (
        <a
          href={output}
          download
          target="_blank"
          rel="noreferrer"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Download className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

/**
 * The generation form + result panel for a single model. Used both by the
 * per-category studio pages (/image, /video, /audio) with a model switcher,
 * and previously by the per-tool pages — the form/credit/BYOK logic itself
 * is unchanged.
 */
export function ModelStudio({ model }: { model: Model }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data: apiKeys } = useListApiKeys();

  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [enhance, setEnhance] = useState(true);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [activeGenerationId, setActiveGenerationId] = useState<number | null>(null);

  useEffect(() => {
    // Regenerate flow from the Library: it stashes the original prompt/params
    // for this model in sessionStorage right before navigating here. Consume
    // it once so a plain visit to the model doesn't keep reapplying it.
    const raw = sessionStorage.getItem("regeneratePrefill");
    if (raw) {
      try {
        const prefill = JSON.parse(raw) as { modelId: string; prompt: string; params: Record<string, unknown> };
        if (prefill.modelId === model.modelId) {
          sessionStorage.removeItem("regeneratePrefill");
          setPrompt(prefill.prompt);
          setParams(prefill.params ?? {});
          setActiveGenerationId(null);
          return;
        }
      } catch {
        sessionStorage.removeItem("regeneratePrefill");
      }
    }

    const defaults: Record<string, unknown> = {};
    for (const field of model.paramsSchema.fields) {
      if (field.default !== undefined) defaults[field.key] = field.default;
    }
    setPrompt("");
    setParams(defaults);
    setActiveGenerationId(null);
  }, [model.modelId]);

  const hasOwnKey = useMemo(() => apiKeys?.some((k) => k.provider === model.adapter), [apiKeys, model]);

  const createGeneration = useCreateGeneration({
    mutation: {
      onSuccess: (gen) => {
        setActiveGenerationId(gen.id);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      },
      onError: (err: any) => {
        // `err` is an ApiError (see custom-fetch.ts) — its `.data` is the
        // parsed JSON error body from the server (`{ error: "..." }`), and
        // `.message` is a formatted "HTTP <status>: <detail>" fallback.
        const description = err?.data?.error ?? err?.message ?? "Please try again.";
        toast({
          title: "Generation failed to start",
          description,
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

  const effectiveCost = useOwnKey && hasOwnKey ? 0 : model.creditCost;
  const insufficientCredits = !useOwnKey && (me?.creditsBalance ?? 0) < effectiveCost;
  const canSubmit = prompt.trim().length > 0 && !createGeneration.isPending && !insufficientCredits;

  const handleSubmit = () => {
    createGeneration.mutate({
      data: {
        modelId: model.modelId,
        prompt: prompt.trim(),
        params,
        autoSelect: false,
        useOwnKey: useOwnKey && hasOwnKey,
        skipEnhance: !enhance,
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
      {/* Form */}
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
        <div>
          <Label className="text-white/80 mb-2 block">Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Describe the ${model.category} you want to create…`}
            className="bg-white/[0.04] border-white/10 text-white min-h-28"
          />
        </div>

        {model.paramsSchema.fields.map((field) => (
          <ParamField
            key={field.key}
            field={field}
            value={params[field.key]}
            onChange={(v) => setParams((p) => ({ ...p, [field.key]: v }))}
          />
        ))}

        <div className="flex items-center justify-between py-1 border-t border-white/5 pt-4">
          <div>
            <Label className="text-white/80">Enhance prompt with AI</Label>
            <p className="text-xs text-white/40 mt-0.5">Improves your prompt before generating</p>
          </div>
          <Switch checked={enhance} onCheckedChange={setEnhance} className="data-[state=checked]:bg-primary" />
        </div>

        <Show when="signed-in">
          {hasOwnKey && (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-white/50" />
                <div>
                  <Label className="text-white/80">Use my own API key</Label>
                  <p className="text-xs text-white/40 mt-0.5">Skip platform credits, use your WaveSpeed key</p>
                </div>
              </div>
              <Switch checked={useOwnKey} onCheckedChange={setUseOwnKey} className="data-[state=checked]:bg-primary" />
            </div>
          )}
        </Show>

        <Show when="signed-in">
          <Button
            size="lg"
            className="w-full bg-primary text-black font-bold hover:bg-primary/90 disabled:opacity-40"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {createGeneration.isPending ? (
              "Submitting…"
            ) : effectiveCost === 0 ? (
              <>
                <Key className="w-4 h-4 mr-2" /> Generate — free with your key
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" /> Generate — {effectiveCost} credits
              </>
            )}
          </Button>
          {insufficientCredits && (
            <p className="text-xs text-red-400 text-center">
              Not enough credits.{" "}
              <Link href="/pricing" className="underline hover:text-red-300">
                Upgrade your plan
              </Link>{" "}
              or add your own API key in{" "}
              <Link href="/account" className="underline hover:text-red-300">
                Account
              </Link>
              .
            </p>
          )}
        </Show>
        <Show when="signed-out">
          <Link href="/sign-up">
            <Button size="lg" className="w-full bg-primary text-black font-bold hover:bg-primary/90">
              Sign up to generate
            </Button>
          </Link>
        </Show>
      </div>

      {/* Result */}
      <div>
        <ResultPanel generation={activeGeneration ?? undefined} />
      </div>
    </div>
  );
}
