import { useEffect, useMemo, useState } from "react";
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
import { Clapperboard, Zap, Sparkles, AlertCircle, Download } from "lucide-react";
import { motion } from "framer-motion";

type Pace = "snappy" | "explainer";

// Both options are real video models from the catalog; the "wrapper" here is
// entirely in the system prompt we build below — no new backend logic.
const PACE_CONFIG: Record<Pace, { label: string; description: string; modelId: string }> = {
  snappy: {
    label: "Snappy short (~5-8s)",
    description: "Fast-cut, social-first pacing with bold on-screen captions.",
    modelId: "seedance-2-0",
  },
  explainer: {
    label: "Explainer (~10-12s)",
    description: "Slower pacing, clearer beats, built for walking through an idea.",
    modelId: "sora-2",
  },
};

function buildScriptPrompt(topic: string, pace: Pace): string {
  const style =
    pace === "snappy"
      ? "Fast-paced, punchy short-form video with quick cuts, bold readable on-screen captions synced to narration, energetic pacing."
      : "Clear, well-paced explainer video with legible on-screen captions synced to narration, one idea per beat, calm confident pacing.";
  return `A short captioned video explaining: "${topic.trim()}". ${style} Captions should be large, high-contrast, and easy to read at a glance.`;
}

function ResultPanel({ generation }: { generation: Generation | undefined }) {
  if (!generation) {
    return (
      <div className="aspect-[9/16] max-h-[420px] mx-auto rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 text-white/30">
        <Clapperboard className="w-8 h-8" />
        <p className="text-sm">Your short will appear here</p>
      </div>
    );
  }
  if (generation.status === "failed") {
    return (
      <div className="aspect-[9/16] max-h-[420px] mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center gap-3 text-red-400 text-center px-6">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{generation.errorMessage ?? "Generation failed"}</p>
      </div>
    );
  }
  if (generation.status === "pending" || generation.status === "processing") {
    return (
      <div className="aspect-[9/16] max-h-[420px] mx-auto rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col items-center justify-center gap-3 text-white/50">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm">Generating…</p>
      </div>
    );
  }
  const output = generation.outputUrls?.[0];
  return (
    <div className="aspect-[9/16] max-h-[420px] mx-auto rounded-2xl overflow-hidden border border-white/10 bg-black/40 relative group">
      <video src={output} controls autoPlay loop className="w-full h-full object-cover" />
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

export default function Shorts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [topic, setTopic] = useState("");
  const [pace, setPace] = useState<Pace>("snappy");
  const [activeGenerationId, setActiveGenerationId] = useState<number | null>(null);

  const cfg = PACE_CONFIG[pace];
  const { data: model } = useGetModel(cfg.modelId);
  const { data: me } = useGetMe();

  const createGeneration = useCreateGeneration({
    mutation: {
      onSuccess: (gen) => {
        setActiveGenerationId(gen.id);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      },
      onError: (err: any) => {
        const description = err?.data?.error ?? err?.message ?? "Please try again.";
        toast({ title: "Short generation failed to start", description, variant: "destructive" });
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
  const canSubmit = !!model && topic.trim().length > 0 && !createGeneration.isPending && !insufficientCredits;
  const prompt = useMemo(() => buildScriptPrompt(topic || "your topic", pace), [topic, pace]);

  const handleSubmit = () => {
    if (!model) return;
    createGeneration.mutate({
      data: { modelId: model.modelId, prompt, params: {}, autoSelect: false, skipEnhance: true },
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
              <Clapperboard className="w-4 h-4" /> Shorts &amp; Explainers
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tighter">
              Any topic, one captioned short.
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xl">
              Type a topic or paste in longer text — we'll pace it into a short captioned video for you.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
            <div>
              <Label className="text-white/80 mb-2 block">Topic or text</Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Why the ocean is salty — or paste a longer script/article to summarize"
                className="bg-white/[0.04] border-white/10 text-white min-h-32"
              />
            </div>

            <div>
              <Label className="text-white/80 mb-2 block">Pacing</Label>
              <Select value={pace} onValueChange={(v) => setPace(v as Pace)}>
                <SelectTrigger className="bg-white/[0.04] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PACE_CONFIG).map(([key, c]) => (
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
                    <Zap className="w-4 h-4 mr-2" /> Generate short — {effectiveCost || "…"} credits
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
