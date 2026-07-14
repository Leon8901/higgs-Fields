import { motion } from "framer-motion";
import { Link } from "wouter";
import { useState } from "react";
import { Show } from "@clerk/react";
import { ArrowRight, ArrowUpRight, ImageIcon, Film, Music, Sparkles, Search, Flame, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useJoinWaitlist,
  useListFeaturedTools,
  useListModels,
  useListApps,
  useGetPlatformStats,
  getListFeaturedToolsQueryKey,
  getListModelsQueryKey,
  getListAppsQueryKey,
  getGetPlatformStatsQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const categoryIcon: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-5 h-5" />,
  video: <Film className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
};

/**
 * Higgsfield.ai's homepage doubles as the product's dashboard/explore surface
 * rather than a traditional marketing hero — it drops straight into bento
 * grids of featured tools, a quick-launch model grid, and the app gallery.
 * This mirrors that structure with our real data.
 */
export default function Home() {
  const { data: featuredTools, isLoading: toolsLoading } = useListFeaturedTools({
    query: { queryKey: getListFeaturedToolsQueryKey() },
  });

  const { data: allModels } = useListModels(
    { category: "all" },
    { query: { queryKey: getListModelsQueryKey({ category: "all" }) } },
  );

  const { data: apps } = useListApps(
    { filter: "featured" },
    { query: { queryKey: getListAppsQueryKey({ filter: "featured" }) } },
  );

  const { data: stats } = useGetPlatformStats({
    query: { queryKey: getGetPlatformStatsQueryKey() },
  });

  const [email, setEmail] = useState("");
  const [appSearch, setAppSearch] = useState("");
  const joinWaitlist = useJoinWaitlist();
  const { toast } = useToast();

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    joinWaitlist.mutate(
      { data: { email } },
      {
        onSuccess: () => {
          toast({ title: "Added to waitlist", description: "We'll notify you when you have access." });
          setEmail("");
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Something went wrong. Please try again." });
        },
      },
    );
  };

  const quickModels = (allModels ?? []).filter((m) => m.isFeatured).slice(0, 5);
  const filteredApps = (apps ?? []).filter(
    (a) =>
      !appSearch ||
      a.name.toLowerCase().includes(appSearch.toLowerCase()) ||
      a.description.toLowerCase().includes(appSearch.toLowerCase()),
  ).slice(0, 4);

  return (
    <div className="flex flex-col w-full pb-20">
      <div className="container mx-auto px-4 pt-8">
        {/* Featured tools bento row */}
        <section className="mb-4">
          {toolsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[4/3] rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredTools?.slice(0, 4).map((tool, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  key={tool.id}
                >
                  <Link href={`/tools/${tool.slug}`} className="block group">
                    <Card className="relative overflow-hidden border border-white/10 aspect-[4/3] rounded-2xl bg-black">
                      <div className="absolute inset-0 z-0">
                        <img
                          src={tool.thumbnailUrl || `/thumbnails/tool-${i + 1}.jpg`}
                          alt={tool.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                      </div>

                      <div className="relative z-10 h-full flex flex-col justify-between p-5">
                        <div className="flex justify-between items-start">
                          <Badge variant="glass" className="uppercase font-bold tracking-wider text-[10px]">
                            {tool.category}
                          </Badge>
                          {tool.badge && <Badge variant="lime" className="uppercase text-[10px]">{tool.badge}</Badge>}
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-white mb-1 tracking-tight group-hover:text-primary transition-colors">
                            {tool.name}
                          </h3>
                          <p className="text-white/70 text-sm line-clamp-1">{tool.tagline}</p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Quick-launch model grid */}
        <section className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Show when="signed-out">
              <div className="rounded-2xl bg-gradient-to-br from-teal-900/60 to-black border border-white/10 p-6 flex flex-col justify-center gap-3 lg:row-span-2">
                <Badge variant="lime" className="w-fit uppercase text-[10px]">Extra discount</Badge>
                <h3 className="text-2xl font-black text-white leading-tight">
                  Sign up and get your <span className="text-primary">extra discount</span>
                </h3>
                <p className="text-sm text-white/60">Create an account and unlock additional credits on every plan.</p>
                <Link href="/sign-up">
                  <Button className="bg-white text-black font-bold hover:bg-white/90 w-fit mt-2">
                    Sign up and get your discount
                  </Button>
                </Link>
              </div>
            </Show>

            {quickModels.map((model) => (
              <Link key={model.id} href={`/${model.category}?model=${encodeURIComponent(model.modelId)}`} className="block group">
                <Card className="bg-white/[0.03] border-white/10 hover:border-white/25 transition-colors h-full">
                  <CardContent className="p-5 flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/70">
                        {categoryIcon[model.category]}
                      </div>
                      {model.badge && <Badge variant="lime" className="text-[10px] uppercase">{model.badge}</Badge>}
                    </div>
                    <div>
                      <h4 className="font-bold text-white group-hover:text-primary transition-colors">{model.name}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1">{model.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* App gallery bento */}
        <section className="py-16 border-t border-white/5 mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Built by the Community</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Micro-apps built on the Higgsfield API by our community of developers and creators.
              </p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search apps..."
                className="pl-9 bg-white/5 border-white/10 w-full"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredApps.map((app, i) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                key={app.id}
              >
                <Card className="bg-black/50 border-white/10 hover:border-white/25 transition-all overflow-hidden group">
                  <div className="h-32 w-full relative overflow-hidden bg-white/5">
                    {app.thumbnailUrl || app.gradient ? (
                      <div className="w-full h-full" style={{ background: app.gradient || undefined }}>
                        {app.thumbnailUrl && (
                          <img src={`/thumbnails/app-${i + 1}.jpg`} className="w-full h-full object-cover opacity-80" alt={app.name} />
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-black" />
                    )}
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      {app.isTrending && (
                        <Badge className="bg-black/60 backdrop-blur-md text-orange-400 border border-orange-500/30 text-[10px] px-1.5 py-0">
                          <Flame className="w-3 h-3 mr-1" /> Hot
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h4 className="font-bold text-white text-sm truncate mb-1">{app.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 h-8">{app.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden">
                          {app.authorAvatarUrl ? (
                            <img src={app.authorAvatarUrl} alt={app.authorName} className="w-full h-full object-cover" />
                          ) : (
                            app.authorName.substring(0, 1)
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{app.authorName}</span>
                      </div>
                      <div className="flex items-center text-[10px] text-muted-foreground font-mono">
                        <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        {app.viewCount.toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" asChild>
              <Link href="/apps">
                Explore App Gallery <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Platform stats */}
        <section className="py-16 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <span className="text-3xl md:text-5xl font-black text-white mb-2">
                {stats ? (stats.videosGenerated / 1000000).toFixed(1) + "M+" : "10M+"}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Videos Generated</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-3xl md:text-5xl font-black text-white mb-2">
                {stats ? (stats.activeCreators / 1000).toFixed(0) + "K+" : "500K+"}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Active Creators</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-3xl md:text-5xl font-black text-white mb-2">
                {stats ? stats.communityApps : "1,200+"}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Community Apps</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-3xl md:text-5xl font-black text-white mb-2">{stats ? stats.modelsAvailable : "24"}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Core Models</span>
            </div>
          </div>
        </section>

        {/* Waitlist CTA */}
        <section className="py-16 border-t border-white/5">
          <div className="max-w-xl mx-auto text-center">
            <Zap className="w-8 h-8 text-primary mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">Ready to redefine reality?</h2>
            <p className="text-muted-foreground mb-8">Join thousands of creators building the next era of cinematic experiences.</p>

            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                className="h-12 bg-white/5 border-white/10 focus-visible:border-primary text-white rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" variant="lime" className="h-12 px-6 rounded-xl" disabled={joinWaitlist.isPending}>
                {joinWaitlist.isPending ? "Joining…" : "Join Waitlist"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
