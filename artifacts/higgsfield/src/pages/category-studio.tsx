import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useListModels, getListModelsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ImageIcon, Film, Music } from "lucide-react";
import { motion } from "framer-motion";
import { ModelStudio } from "@/components/model-studio";

type Category = "image" | "video" | "audio";

const categoryMeta: Record<Category, { title: string; description: string; icon: React.ReactNode }> = {
  image: {
    title: "AI Image Generator",
    description: "Commercial-ready visuals in seconds. Pick a model and describe what you want to create.",
    icon: <ImageIcon className="w-5 h-5" />,
  },
  video: {
    title: "AI Video Generator",
    description: "Cinematic motion from a single prompt. Pick a model and bring your idea to life.",
    icon: <Film className="w-5 h-5" />,
  },
  audio: {
    title: "AI Audio Generator",
    description: "Voices, music, and sound effects generated on demand. Pick a model to get started.",
    icon: <Music className="w-5 h-5" />,
  },
};

/**
 * One page per category (Image / Video / Audio) with a model switcher, mirroring
 * higgsfield.ai's layout where each category is a single studio page instead of
 * a separate page per tool. The underlying generation form (ModelStudio) and its
 * credit/BYOK-key logic are unchanged from the previous per-tool pages.
 */
export default function CategoryStudio({ category }: { category: Category }) {
  const search = useSearch();
  const meta = categoryMeta[category];

  const { data: models, isLoading } = useListModels(
    { category },
    { query: { queryKey: getListModelsQueryKey({ category }) } },
  );

  const [selectedModelId, setSelectedModelId] = useState<string>("");

  // Preselect from ?model=<slug> (used by links from the Tools catalog, Presets,
  // Library "Regenerate", etc.), falling back to the featured/first model.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, search]);

  const selectedModel = models?.find((m) => m.modelId === selectedModelId);

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    const url = new URL(window.location.href);
    url.searchParams.set("model", modelId);
    window.history.replaceState({}, "", url);
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-white/10 text-white border-white/20 flex items-center gap-1.5">
                {meta.icon}
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Badge>
              {selectedModel?.badge && <Badge className="bg-primary text-black font-bold text-xs">{selectedModel.badge}</Badge>}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight">{meta.title}</h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xl">{meta.description}</p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {isLoading || !models ? (
          <Skeleton className="h-96 w-full max-w-5xl bg-white/5 rounded-2xl" />
        ) : models.length === 0 ? (
          <p className="text-white/50">No {category} models are available yet.</p>
        ) : (
          <div className="max-w-5xl space-y-6">
            <div className="max-w-xs">
              <label className="text-sm text-white/60 mb-2 block">Model</label>
              <Select value={selectedModelId} onValueChange={handleSelectModel}>
                <SelectTrigger className="bg-white/[0.04] border-white/10 text-white h-12">
                  <SelectValue placeholder="Choose a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.modelId} value={m.modelId}>
                      <span className="flex items-center gap-2">
                        {m.name}
                        {m.badge && <span className="text-[10px] text-primary font-bold uppercase">{m.badge}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModel && (
                <p className="text-xs text-white/40 mt-2">{selectedModel.description}</p>
              )}
            </div>

            {selectedModel && <ModelStudio model={selectedModel} key={selectedModel.modelId} />}
          </div>
        )}
      </div>
    </div>
  );
}
