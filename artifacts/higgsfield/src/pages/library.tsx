import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Show } from "@clerk/react";
import {
  useListGenerations,
  useDeleteGeneration,
  getListGenerationsQueryKey,
  type Generation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ImageIcon,
  Film,
  Music,
  Zap,
  Key,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const categoryIcon: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Music className="w-4 h-4" />,
};

const statusStyles: Record<string, string> = {
  pending: "bg-white/10 text-white/70 border-white/20",
  processing: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  completed: "bg-primary/10 text-primary border-primary/30",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
};

type CategoryFilter = "all" | "image" | "video" | "audio";
type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";
type SortOption = "newest" | "oldest" | "credits";

function GenerationCard({
  gen,
  onDelete,
  isDeleting,
}: {
  gen: Generation;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
  const [, navigate] = useLocation();
  const firstOutput = gen.outputUrls?.[0];

  const handleRegenerate = () => {
    // Stash the prompt/params for tool-detail.tsx to pick up once it's
    // mounted for this model — see the sessionStorage read there.
    sessionStorage.setItem(
      "regeneratePrefill",
      JSON.stringify({ modelId: gen.modelId, prompt: gen.prompt, params: gen.params ?? {} }),
    );
    navigate(`/tools/${gen.modelId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-colors group"
    >
      <div className="aspect-video bg-black/40 relative flex items-center justify-center overflow-hidden">
        {gen.status === "completed" && firstOutput ? (
          gen.category === "video" ? (
            <video src={firstOutput} className="w-full h-full object-cover" controls muted />
          ) : gen.category === "audio" ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <audio src={firstOutput} controls className="w-full" />
            </div>
          ) : (
            <img src={firstOutput} alt={gen.prompt} className="w-full h-full object-cover" />
          )
        ) : gen.status === "failed" ? (
          <div className="flex flex-col items-center gap-2 text-red-400/80 text-sm px-4 text-center">
            <AlertCircle className="w-6 h-6" />
            {gen.errorMessage ?? "Generation failed"}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/40 text-sm">
            <Clock className="w-6 h-6 animate-pulse" />
            {gen.status === "processing" ? "Processing…" : "Queued…"}
          </div>
        )}
        <Badge className={`absolute top-3 right-3 border ${statusStyles[gen.status]}`}>{gen.status}</Badge>

        <div className="absolute top-3 left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {gen.status === "completed" && firstOutput && (
            <a
              href={firstOutput}
              download
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-primary"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={handleRegenerate}
            className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-primary"
            title="Regenerate"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(gen.id)}
            disabled={isDeleting}
            className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-red-400 disabled:opacity-40"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2 text-xs text-white/50">
          {categoryIcon[gen.category]}
          <span>{gen.modelName}</span>
          <span className="ml-auto flex items-center gap-1">
            {gen.usedOwnKey ? (
              <span className="flex items-center gap-1 text-white/40">
                <Key className="w-3 h-3" /> own key
              </span>
            ) : (
              <span className="flex items-center gap-1 text-primary/80">
                <Zap className="w-3 h-3" /> {gen.creditsCharged}
              </span>
            )}
          </span>
        </div>
        <p className="text-sm text-white/80 line-clamp-2">{gen.prompt}</p>
      </div>
    </motion.div>
  );
}

export default function Library() {
  const { data: generations, isLoading } = useListGenerations();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const deleteGeneration = useDeleteGeneration({
    mutation: {
      onMutate: (vars) => setPendingDeleteId(vars.id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
        toast({ title: "Deleted", description: "Generation removed from your library." });
      },
      onError: () =>
        toast({ title: "Couldn't delete", description: "Please try again.", variant: "destructive" }),
      onSettled: () => setPendingDeleteId(null),
    },
  });

  const filtered = useMemo(() => {
    if (!generations) return [];
    let rows = generations;
    if (category !== "all") rows = rows.filter((g) => g.category === category);
    if (status !== "all") rows = rows.filter((g) => g.status === status);
    rows = [...rows].sort((a, b) => {
      if (sort === "credits") return b.creditsCharged - a.creditsCharged;
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return rows;
  }, [generations, category, status, sort]);

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this generation? This can't be undone.")) return;
    deleteGeneration.mutate({ id });
  };

  return (
    <div className="container mx-auto px-4 py-16 min-h-screen">
      <Show when="signed-out">
        <div className="flex flex-col items-center justify-center text-center gap-6 py-24">
          <h1 className="text-3xl md:text-4xl font-black text-white">Sign in to see your library</h1>
          <p className="text-muted-foreground max-w-md">
            Every image, video, and audio clip you generate is saved here.
          </p>
          <Link href="/sign-in">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90">Log in</Button>
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">Your Library</h1>
            <p className="text-muted-foreground">Everything you've generated, in one place.</p>
          </div>

          {generations && generations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
                <SelectTrigger className="w-32 bg-white/[0.04] border-white/10 text-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="w-36 bg-white/[0.04] border-white/10 text-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="w-36 bg-white/[0.04] border-white/10 text-white">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="credits">Most credits</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-video bg-white/5 rounded-2xl" />
            ))}
          </div>
        ) : !generations || generations.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-6 py-24 border border-dashed border-white/10 rounded-2xl">
            <h2 className="text-2xl font-bold text-white">Nothing here yet</h2>
            <p className="text-muted-foreground max-w-md">
              Pick a tool and generate your first image, video, or audio clip.
            </p>
            <Link href="/tools">
              <Button className="bg-primary text-black font-bold hover:bg-primary/90">Browse Tools</Button>
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-24 border border-dashed border-white/10 rounded-2xl">
            <h2 className="text-xl font-bold text-white">No matches</h2>
            <p className="text-muted-foreground max-w-md">Try a different filter combination.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((gen) => (
              <GenerationCard
                key={gen.id}
                gen={gen}
                onDelete={handleDelete}
                isDeleting={pendingDeleteId === gen.id}
              />
            ))}
          </div>
        )}
      </Show>
    </div>
  );
}
