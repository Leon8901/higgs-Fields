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
import { useToast } from "@/hooks/use-toast";
import { Clapperboard, Zap, Sparkles, AlertCircle, Download, Rabbit, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";

type Pace = "snappy" | "explainer";

// Both options are real video models from the catalog; the "wrapper" here is
// entirely in the system prompt we build below — no new backend logic.
const PACE_CONFIG: Record<Pace, { label: string; description: string; modelId: string; icon: React.ReactNode }> = {
  snappy: {
    label: "Snappy short",
    description: "Fast-cut, social-first pacing with bold on-screen captions. ~5-8s.",
    modelId: "seedance-2-0",
    icon: <Rabbit className="w-5 h-5" />,
  },
  explainer: {
    label: "Explainer",
    description: "Slower pacing, clearer beats, built for walking through an idea. ~10-12s.",
    modelId: "sora-2",
    icon: <GraduationCap className="w-5 h-5" />,
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left control panel, studio-shell style */}
      <div className="w-full lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/8 bg-white/[0.02] p-6 space-y-6">
        <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-[0.2em]">
          <Clapperboard className="w-4 h-4" /> Shorts Studio
        </div>

        <div>
          <Label className="text-white/80 mb-2 block">Topic or text</Label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Why the ocean is salty — or paste a longer script/article to summarize"
            className="bg-white/[0.04] border-white/10 text-white min-h-32"
          />
        </div>

        <Show when="signed-in">
          <Button
            size="lg"
            className="w-full bg-primary text-black font-bold hover:bg-primary/90 disabled:opacity-40 rounded-full"
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
            <Button size="lg" className="w-full bg-primary text-black font-bold hover:bg-primary/90 rounded-full">
              Sign up to generate
            </Button>
          </Link>
        </Show>

        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Prompt sent to the model
          </p>
          <p className="text-sm text-white/60 leading-relaxed">{prompt}</p>
        </div>
      </div>

      {/* Right: pacing presets + result */}
      <div className="flex-1 p-6 lg:p-8 space-y-8">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-4">Pacing presets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {(Object.entries(PACE_CONFIG) as [Pace, typeof PACE_CONFIG[Pace]][]).map(([key, c]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPace(key)}
                className={`text-left rounded-2xl border p-5 transition-colors ${
                  pace === key ? "border-primary/60 bg-primary/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 mb-3">{c.icon}</div>
                <h3 className="font-bold text-white mb-1">{c.label}</h3>
                <p className="text-sm text-white/50">{c.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-4">Preview</h2>
          <ResultPanel generation={activeGeneration ?? undefined} />
        </div>
      </div>
    </div>
  );
}
