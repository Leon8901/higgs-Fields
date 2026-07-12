import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetModel,
  useGetMe,
  useListApiKeys,
  useCreateGeneration,
  useGetGeneration,
  getGetMeQueryKey,
  getListGenerationsQueryKey,
  type ModelParamField,
  type Generation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Zap,
  ImageIcon,
  Film,
  Music,
  Key,
  Sparkles,
  Upload,
  X,
  AlertCircle,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";

const categoryIcon: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-5 h-5" />,
  video: <Film className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
};

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

export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: model, isLoading, isError } = useGetModel(slug ?? "", { query: { enabled: !!slug } });
  const { data: me } = useGetMe();
  const { data: apiKeys } = useListApiKeys();

  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [enhance, setEnhance] = useState(true);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [activeGenerationId, setActiveGenerationId] = useState<number | null>(null);

  useEffect(() => {
    if (model) {
      const defaults: Record<string, unknown> = {};
      for (const field of model.paramsSchema.fields) {
        if (field.default !== undefined) defaults[field.key] = field.default;
      }
      setParams(defaults);
    }
  }, [model?.modelId]);

  const hasOwnKey = useMemo(
    () => (model ? apiKeys?.some((k) => k.provider === model.adapter) : false),
    [apiKeys, model],
  );

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
        // `err.error` is never a real property here, so reading it silently
        // fell through to the generic copy below on every failure.
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

  if (!isLoading && (isError || (slug && !model))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="text-6xl font-black text-primary">404</div>
        <h2 className="text-2xl font-bold text-white">Tool not found</h2>
        <p className="text-muted-foreground">This tool doesn't exist or has been removed.</p>
        <Link href="/tools">
          <Button className="bg-primary text-black font-bold hover:bg-primary/90">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tools
          </Button>
        </Link>
      </div>
    );
  }

  const effectiveCost = useOwnKey && hasOwnKey ? 0 : (model?.creditCost ?? 0);
  const insufficientCredits = !useOwnKey && (me?.creditsBalance ?? 0) < effectiveCost;
  const canSubmit = !!model && prompt.trim().length > 0 && !createGeneration.isPending && !insufficientCredits;

  const handleSubmit = () => {
    if (!model) return;
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
    <div className="min-h-screen">
      <div
        className="relative overflow-hidden border-b border-white/5"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)" }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative container mx-auto px-4 py-16">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-primary mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All Tools
          </Link>

          {isLoading || !model ? (
            <div className="space-y-4 max-w-2xl">
              <Skeleton className="h-8 w-32 bg-white/10" />
              <Skeleton className="h-10 w-96 bg-white/10" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-white/10 text-white border-white/20 flex items-center gap-1.5">
                  {categoryIcon[model.category] ?? <Zap className="w-4 h-4" />}
                  {model.category.charAt(0).toUpperCase() + model.category.slice(1)}
                </Badge>
                {model.badge && <Badge className="bg-primary text-black font-bold text-xs">{model.badge}</Badge>}
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight">{model.name}</h1>
              <p className="text-white/60 text-base leading-relaxed max-w-xl">{model.description}</p>
            </motion.div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {isLoading || !model ? (
          <Skeleton className="h-96 w-full max-w-5xl bg-white/5 rounded-2xl" />
        ) : (
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
        )}
      </div>
    </div>
  );
}
