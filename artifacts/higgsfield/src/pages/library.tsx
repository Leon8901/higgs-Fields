import { Link } from "wouter";
import { Show } from "@clerk/react";
import { useListGenerations, type Generation } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, Film, Music, Zap, Key, AlertCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";

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

function GenerationCard({ gen }: { gen: Generation }) {
  const firstOutput = gen.outputUrls?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-colors"
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
        <div className="mb-10">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">Your Library</h1>
          <p className="text-muted-foreground">Everything you've generated, in one place.</p>
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generations.map((gen) => (
              <GenerationCard key={gen.id} gen={gen} />
            ))}
          </div>
        )}
      </Show>
    </div>
  );
}
