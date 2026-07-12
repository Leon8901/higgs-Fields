import { useListTools, getListToolsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Wand2 } from "lucide-react";
import { motion } from "framer-motion";
import { PRESETS } from "@/config/presets";

export default function Presets() {
  const [category, setCategory] = useState<"all" | "image" | "video" | "audio">("all");

  // Real thumbnails already backfilled for a few models (see
  // lib/db/seed-thumbnails.ts) live on the tool catalog — reuse them here so
  // a preset that shares a model with a real thumbnail shows it instead of
  // the placeholder color block.
  const { data: tools } = useListTools({}, { query: { queryKey: getListToolsQueryKey({}) } });
  const thumbnailByModel = new Map(tools?.map((t) => [t.slug, t.thumbnailUrl]));

  const filtered = PRESETS.filter((p) => category === "all" || p.category === category);

  const handleTryIt = (preset: (typeof PRESETS)[number]) => {
    sessionStorage.setItem(
      "regeneratePrefill",
      JSON.stringify({ modelId: preset.modelId, prompt: preset.prompt, params: {} }),
    );
  };

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 min-h-screen">
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4 text-primary text-sm font-bold uppercase tracking-wide">
          <Wand2 className="w-4 h-4" /> Viral Presets
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4">
          One-click presets
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Skip the blank prompt box. Pick a look, tap once, and we'll pre-fill a tuned prompt on the right model for it.
        </p>
      </div>

      <Tabs defaultValue="all" value={category} onValueChange={(v) => setCategory(v as any)} className="w-full">
        <TabsList className="bg-white/5 border border-white/10 p-1 mb-8">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-black">All</TabsTrigger>
          <TabsTrigger value="image" className="data-[state=active]:bg-primary data-[state=active]:text-black">Image</TabsTrigger>
          <TabsTrigger value="video" className="data-[state=active]:bg-primary data-[state=active]:text-black">Video</TabsTrigger>
          <TabsTrigger value="audio" className="data-[state=active]:bg-primary data-[state=active]:text-black">Audio</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((preset, i) => {
            const thumbnailUrl = thumbnailByModel.get(preset.modelId);
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                key={preset.id}
              >
                <Link href={`/tools/${preset.modelId}`} className="block h-full" onClick={() => handleTryIt(preset)}>
                  <Card className="h-full bg-black/40 border-white/10 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(206,255,0,0.1)] transition-all group overflow-hidden relative flex flex-col">
                    <div
                      className="w-full h-36 relative overflow-hidden"
                      style={!thumbnailUrl ? { background: `linear-gradient(135deg, ${preset.accent}33, #0a0a0a)` } : undefined}
                    >
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt={preset.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${preset.accent}22`, border: `1px solid ${preset.accent}55` }}
                          >
                            <Sparkles className="w-5 h-5" style={{ color: preset.accent }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-5 flex-1 flex flex-col">
                      <Badge variant="secondary" className="bg-white/5 text-muted-foreground mb-3 text-[10px] uppercase w-fit">
                        {preset.category}
                      </Badge>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">
                        {preset.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{preset.description}</p>
                      <div className="mt-4 pt-3 border-t border-white/5">
                        <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                          Try it <span className="ml-1">→</span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
}
