import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetModel,
  useGetMe,
  useCreateGeneration,
  useGetGeneration,
  getGetMeQueryKey,
  getListGenerationsQueryKey,
  getGetGenerationQueryKey,
  type Generation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Upload, X, Zap, Sparkles, AlertCircle, Download } from "lucide-react";
import { motion } from "framer-motion";

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

type AdStyle = "ugc" | "professional" | "cinematic";

// Maps each ad style to a real model in the catalog + a directive appended
// to the crafted prompt. wan-2-2 needs a source image, so it powers the
// UGC style (animate an actual product photo); the other two are pure
// text-to-video for a more polished, studio-shot feel.
const STYLE_CONFIG: Record<AdStyle, { label: string; description: string; modelId: string; directive: string; needsImage: boolean }> = {
  ugc: {
    label: "UGC-style",
    description: "Casual, handheld, feels like a real customer filmed it.",
    modelId: "wan-2-2-image-to-video",
    directive:
      "Shot on a phone, natural handheld camera movement, authentic UGC creator energy, casual lighting, no studio polish.",
    needsImage: true,
  },
  professional: {
    label: "Professional / CGI",
    description: "Clean studio lighting, polished product-focused shots.",
    modelId: "kling-v3-pro",
    directive:
      "Professional studio product commercial, clean CGI-quality lighting, smooth camera moves, polished brand-safe composition.",
    needsImage: false,
  },
  cinematic: {
    label: "Cinematic",
    description: "Dramatic, film-grade lighting and camera work.",
    modelId: "seedance-2-0",
    directive:
      "Cinematic ad film, dramatic lighting, shallow depth of field, film-grade color grade, high-production-value camera movement.",
    needsImage: false,
  },
};

function buildAdPrompt(productName: string, description: string, style: AdStyle): string {
  const cfg = STYLE_CONFIG[style];
  return `A short advertisement for "${productName}". ${description.trim()} ${cfg.directive}`.trim();
}

function ResultPanel({ generation }: { generation: Generation | undefined }) {
  if (!generation) {
    return (
      <div className="aspect-video rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 text-white/30">
        <Megaphone className="w-8 h-8" />
        <p className="text-sm">Your ad will appear here</p>
      </div>
    );
  }
  if (generation.status === "failed") {
    return (
      <div className="aspect-video rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center gap-3 text-red-400 text-center px-6">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{generation.errorMessage ?? "Generation failed"}</p>
      </div>
    );
  }
  if (generation.status === "pending" || generation.status === "processing") {
    return (
      <div className="aspect-video rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col items-center justify-center gap-3 text-white/50">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm">Generating your ad…</p>
      </div>
    );
  }
  const output = generation.outputUrls?.[0];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40 relative group">
      <video src={output} controls autoPlay loop className="w-full aspect-video object-cover" />
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

export default function MarketingStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [style, setStyle] = useState<AdStyle>("professional");
  const [activeGenerationId, setActiveGenerationId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cfg = STYLE_CONFIG[style];
  const { data: model } = useGetModel(cfg.modelId);
  const { data: me } = useGetMe();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadFile(file));
    } catch {
      setImageUrl(undefined);
    } finally {
      setUploading(false);
    }
  };

  const createGeneration = useCreateGeneration({
    mutation: {
      onSuccess: (gen) => {
        setActiveGenerationId(gen.id);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      },
      onError: (err: any) => {
        const description = err?.data?.error ?? err?.message ?? "Please try again.";
        toast({ title: "Ad generation failed to start", description, variant: "destructive" });
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

  const effectiveCost = model?.creditCost ?? 0;
  const insufficientCredits = (me?.creditsBalance ?? 0) < effectiveCost;
  const missingImage = cfg.needsImage && !imageUrl;
  const canSubmit =
    !!model &&
    productName.trim().length > 0 &&
    description.trim().length > 0 &&
    !missingImage &&
    !createGeneration.isPending &&
    !insufficientCredits;

  const prompt = useMemo(() => buildAdPrompt(productName || "your product", description, style), [productName, description, style]);

  const handleSubmit = () => {
    if (!model) return;
    createGeneration.mutate({
      data: {
        modelId: model.modelId,
        prompt,
        params: cfg.needsImage ? { image: imageUrl } : {},
        autoSelect: false,
        skipEnhance: true,
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4 text-primary text-sm font-bold uppercase tracking-wide">
              <Megaphone className="w-4 h-4" /> Marketing Studio
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tighter">
              Turn a product into an ad.
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xl">
              Describe what you're selling, pick a style, and generate a short ad-style video — no editing timeline required.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
            <div>
              <Label className="text-white/80 mb-2 block">Product name</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Aurora Sport Bottle"
                className="bg-white/[0.04] border-white/10 text-white"
              />
            </div>

            <div>
              <Label className="text-white/80 mb-2 block">Product description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is it, who's it for, what makes it worth buying?"
                className="bg-white/[0.04] border-white/10 text-white min-h-24"
              />
            </div>

            <div>
              <Label className="text-white/80 mb-2 block">
                Product photo{cfg.needsImage && <span className="text-primary ml-1">*</span>}
              </Label>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {imageUrl ? (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/10 group">
                  <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
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
              <p className="text-xs text-white/40 mt-1.5">
                {cfg.needsImage
                  ? "This style animates your actual product photo."
                  : "Optional context — this style generates from your description alone (single-image support only, for now)."}
              </p>
            </div>

            <div>
              <Label className="text-white/80 mb-2 block">Ad style</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as AdStyle)}>
                <SelectTrigger className="bg-white/[0.04] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STYLE_CONFIG).map(([key, c]) => (
                    <SelectItem key={key} value={key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-white/40 mt-1.5">{cfg.description}</p>
            </div>

            <Show when="signed-in">
              <Button
                size="lg"
                className="w-full bg-primary text-black font-bold hover:bg-primary/90 disabled:opacity-40"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {createGeneration.isPending ? (
                  "Submitting…"
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" /> Generate ad — {effectiveCost || "…"} credits
                  </>
                )}
              </Button>
              {insufficientCredits && (
                <p className="text-xs text-red-400 text-center">
                  Not enough credits.{" "}
                  <Link href="/pricing" className="underline hover:text-red-300">
                    Upgrade your plan
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

          <div className="space-y-4">
            <ResultPanel generation={activeGeneration ?? undefined} />
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Prompt sent to the model
              </p>
              <p className="text-sm text-white/60 leading-relaxed">{prompt}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
