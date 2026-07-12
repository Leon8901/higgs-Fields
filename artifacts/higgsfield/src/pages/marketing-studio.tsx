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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Megaphone,
  Upload,
  X,
  Zap,
  Sparkles,
  AlertCircle,
  Download,
  Package,
  Clapperboard,
  Building2,
  Smartphone,
  Wand2,
  Video,
  Crown,
  Mic,
} from "lucide-react";
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

type SourceType = "product" | "app";
type FilterTag = "all" | "tiktok" | "new" | "ugc" | "commercial";

type TemplateId = "ugc-testimonial" | "studio-commercial" | "cinematic-launch" | "quick-social-cut" | "hero-reveal" | "text-only-pitch";

// Each template maps to a real model in the catalog + a directive appended
// to the crafted prompt — mirrors higgsfield.ai's Marketing Studio template
// gallery (named templates, tag-filterable, "Try" applies it to the composer).
const TEMPLATES: Record<
  TemplateId,
  {
    label: string;
    description: string;
    modelId: string;
    directive: string;
    needsImage: boolean;
    tags: Exclude<FilterTag, "all">[];
    icon: React.ReactNode;
  }
> = {
  "ugc-testimonial": {
    label: "UGC Testimonial",
    description: "Realistic social media video — feels like a real customer filmed it.",
    modelId: "wan-2-2-image-to-video",
    directive: "Shot on a phone, natural handheld camera movement, authentic UGC creator energy, casual lighting, no studio polish.",
    needsImage: true,
    tags: ["ugc", "tiktok"],
    icon: <Package className="w-4 h-4" />,
  },
  "studio-commercial": {
    label: "Studio Commercial",
    description: "Clean studio lighting, polished product-focused shots.",
    modelId: "kling-v3-pro",
    directive: "Professional studio product commercial, clean CGI-quality lighting, smooth camera moves, polished brand-safe composition.",
    needsImage: false,
    tags: ["commercial"],
    icon: <Building2 className="w-4 h-4" />,
  },
  "cinematic-launch": {
    label: "Cinematic Launch",
    description: "Dramatic, film-grade lighting for a big product reveal moment.",
    modelId: "seedance-2-0",
    directive: "Cinematic ad film, dramatic lighting, shallow depth of field, film-grade color grade, high-production-value camera movement.",
    needsImage: false,
    tags: ["commercial", "new"],
    icon: <Clapperboard className="w-4 h-4" />,
  },
  "quick-social-cut": {
    label: "Quick Social Cut",
    description: "Fast, punchy, vertical-friendly pacing built for scroll-stopping feeds.",
    modelId: "seedance-2-0-fast",
    directive: "Fast-cut vertical social video, punchy pacing, bold energetic transitions, thumb-stopping first second.",
    needsImage: false,
    tags: ["tiktok", "new"],
    icon: <Video className="w-4 h-4" />,
  },
  "hero-reveal": {
    label: "Hero Reveal",
    description: "Premium, high-fidelity reveal shot for flagship launches.",
    modelId: "veo-3-1",
    directive: "Premium hero reveal shot, flagship-launch production value, sweeping camera move, immaculate lighting and detail.",
    needsImage: false,
    tags: ["commercial", "new"],
    icon: <Crown className="w-4 h-4" />,
  },
  "text-only-pitch": {
    label: "Text-Only Pitch",
    description: "A narrated pitch video generated purely from your description — no photo needed.",
    modelId: "sora-2",
    directive: "Narrated product pitch, confident presenter voice-over energy, clear staged demonstration, no handheld shake.",
    needsImage: false,
    tags: ["ugc"],
    icon: <Mic className="w-4 h-4" />,
  },
};

const FILTERS: { value: FilterTag; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tiktok", label: "TikTok" },
  { value: "new", label: "New" },
  { value: "ugc", label: "UGC" },
  { value: "commercial", label: "Commercial" },
];

type ContentToggle = "hook" | "setting" | "product" | "avatar";

const CONTENT_TOGGLES: Record<ContentToggle, { label: string; directive: string; icon: React.ReactNode }> = {
  hook: {
    label: "Hook",
    directive: "Open with a strong, attention-grabbing hook in the first shot.",
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  setting: {
    label: "Setting",
    directive: "Establish a clear setting/environment before revealing the product.",
    icon: <Building2 className="w-3.5 h-3.5" />,
  },
  product: {
    label: "Product",
    directive: "Keep the product clearly and prominently in frame throughout.",
    icon: <Package className="w-3.5 h-3.5" />,
  },
  avatar: {
    label: "Avatar",
    directive: "Feature a human presenter speaking directly to camera.",
    icon: <Mic className="w-3.5 h-3.5" />,
  },
};

function buildAdPrompt(
  productName: string,
  description: string,
  template: TemplateId,
  toggles: Set<ContentToggle>,
  sourceType: SourceType,
): string {
  const cfg = TEMPLATES[template];
  const subject = sourceType === "app" ? "app" : "product";
  const toggleDirectives = Array.from(toggles)
    .map((t) => CONTENT_TOGGLES[t].directive)
    .join(" ");
  return `A short advertisement for the ${subject} "${productName}". ${description.trim()} ${cfg.directive} ${toggleDirectives}`.trim();
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

  const [sourceType, setSourceType] = useState<SourceType>("product");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("studio-commercial");
  const [toggles, setToggles] = useState<Set<ContentToggle>>(new Set(["hook", "product"]));
  const [filter, setFilter] = useState<FilterTag>("all");
  const [activeGenerationId, setActiveGenerationId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const cfg = TEMPLATES[template];
  const { data: model } = useGetModel(cfg.modelId);
  const { data: me } = useGetMe();

  const toggleContentToggle = (t: ContentToggle) => {
    setToggles((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const applyTemplate = (id: TemplateId) => {
    setTemplate(id);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filteredTemplates = (Object.entries(TEMPLATES) as [TemplateId, typeof TEMPLATES[TemplateId]][]).filter(
    ([, c]) => filter === "all" || c.tags.includes(filter as Exclude<FilterTag, "all">),
  );

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

  const prompt = useMemo(
    () => buildAdPrompt(productName || "your product", description, template, toggles, sourceType),
    [productName, description, template, toggles, sourceType],
  );

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
      {/* Hero */}
      <div
        className="relative overflow-hidden border-b border-white/5 text-center"
        style={{ background: "radial-gradient(ellipse at top, rgba(206,255,0,0.08), transparent 60%), linear-gradient(135deg, #0a0a0a 0%, #0d1210 100%)" }}
      >
        <div className="relative container mx-auto px-4 py-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4 text-primary text-xs font-bold uppercase tracking-[0.2em]">
              <Megaphone className="w-4 h-4" /> Marketing Studio
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tighter uppercase">
              Turn any product<br />into a video ad
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xl mx-auto">
              Describe what you're selling, pick a style, and generate a short ad-style video — no editing timeline required.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-6 relative z-10 pb-16">
        {/* Composer */}
        <div ref={composerRef} className="max-w-3xl mx-auto bg-[#111214] border border-white/10 rounded-3xl p-5 shadow-2xl shadow-black/40 space-y-5 scroll-mt-8">
          {/* Source tabs: Product vs App, mirrors higgsfield.ai's composer */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-full p-1 w-fit">
            <button
              type="button"
              onClick={() => setSourceType("product")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                sourceType === "product" ? "bg-white text-black" : "text-white/50 hover:text-white"
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Product
            </button>
            <button
              type="button"
              onClick={() => setSourceType("app")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                sourceType === "app" ? "bg-white text-black" : "text-white/50 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> App
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start">
            <div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {imageUrl ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 group shrink-0">
                  <img src={imageUrl} alt={sourceType === "app" ? "App" : "Product"} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="w-20 h-20 rounded-xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-1.5 text-white/40 hover:text-primary hover:border-primary/50 transition-colors text-[10px] shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "…" : sourceType === "app" ? "App" : "Product"}
                </button>
              )}
            </div>

            <div className="space-y-3">
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={sourceType === "app" ? "App name — e.g. Aurora Fitness" : "Product name — e.g. Aurora Sport Bottle"}
                className="bg-white/[0.04] border-white/10 text-white h-11"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happens in the ad…"
                className="bg-white/[0.04] border-white/10 text-white min-h-16 resize-none"
              />
            </div>
          </div>

          {/* Content toggle pills: Hook / Setting / Product / Avatar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
            {(Object.entries(CONTENT_TOGGLES) as [ContentToggle, typeof CONTENT_TOGGLES[ContentToggle]][]).map(([key, c]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleContentToggle(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  toggles.has(key)
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-white/[0.03] text-white/50 border-white/10 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {c.icon}
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <span className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/70">{cfg.icon}</span>
              Template: <span className="font-bold text-white">{cfg.label}</span>
            </div>
            <Show when="signed-in">
              <Button
                className="bg-primary text-black font-bold hover:bg-primary/90 disabled:opacity-40 rounded-full px-6"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {createGeneration.isPending ? (
                  "Submitting…"
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" /> Generate — {effectiveCost || "…"} credits
                  </>
                )}
              </Button>
            </Show>
            <Show when="signed-out">
              <Link href="/sign-up">
                <Button className="bg-primary text-black font-bold hover:bg-primary/90 rounded-full px-6">Sign up to generate</Button>
              </Link>
            </Show>
          </div>
          <Show when="signed-in">
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
          <p className="text-xs text-white/40 text-center">
            {cfg.needsImage ? "This template animates your actual uploaded photo." : cfg.description}
          </p>
        </div>

        {/* Template gallery, filterable like higgsfield.ai's Marketing Studio */}
        <div className="max-w-5xl mx-auto mt-12">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">Templates</h2>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    filter === f.value ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map(([key, c]) => (
              <div
                key={key}
                className={`text-left rounded-2xl border p-5 transition-colors ${
                  template === key ? "border-primary/60 bg-primary/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70">{c.icon}</div>
                  <div className="flex gap-1">
                    {c.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 border-white/15 text-white/40 capitalize">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <h3 className="font-bold text-white mb-1">{c.label}</h3>
                <p className="text-sm text-white/50 mb-4">{c.description}</p>
                <Button
                  size="sm"
                  onClick={() => applyTemplate(key)}
                  className={`w-full rounded-full font-bold ${
                    template === key ? "bg-primary text-black hover:bg-primary/90" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" /> {template === key ? "Selected" : "Try"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="max-w-3xl mx-auto mt-12 space-y-4">
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
  );
}
