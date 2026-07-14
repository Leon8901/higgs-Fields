import { useListApps, useGetAppStats, getListAppsQueryKey, getGetAppStatsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutGrid, Search, Flame, Clock, Users, ArrowUpRight, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

const FILTERS: { value: 'all' | 'featured' | 'trending' | 'new'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'featured', label: 'Featured' },
  { value: 'trending', label: 'Trending' },
  { value: 'new', label: 'New' },
];

export default function Apps() {
  const [filter, setFilter] = useState<'all' | 'featured' | 'trending' | 'new'>('all');
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const { data: apps, isLoading } = useListApps(
    { filter, search: search || undefined },
    { query: { queryKey: getListAppsQueryKey({ filter, search: search || undefined }) } }
  );

  const { data: stats } = useGetAppStats({
    query: { queryKey: getGetAppStatsQueryKey() }
  });

  return (
    <div className="container mx-auto px-4 py-12 md:py-16 min-h-screen">
      <div className="mb-10">
        <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center mb-5">
          <LayoutGrid className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
          Welcome to <span className="text-primary">Higgsfield Apps</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          One-click AI effects that transform any content into professional ads, viral trends, or creative pipelines.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 max-w-4xl">
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Apps</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/50">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Trending</p>
                <p className="text-3xl font-bold text-white">{stats.trending}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Flame className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">New This Week</p>
                <p className="text-3xl font-bold text-white">{stats.newThisWeek}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-9 bg-white/5 border-white/10 rounded-full w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.value ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              {f.value === 'trending' && <Flame className="inline w-3 h-3 mr-1.5 text-orange-500" />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Card key={i} className="bg-white/5 border-white/10 h-72 animate-pulse" />
          ))}
        </div>
      ) : apps?.length === 0 ? (
        <div className="text-center py-32 border border-white/5 rounded-2xl bg-white/[0.02]">
          <h3 className="text-xl font-bold text-white mb-2">No apps found</h3>
          <p className="text-muted-foreground">We couldn't find any apps matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps?.map((app, i) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              key={app.id}
            >
              <Card
                className="bg-black border-white/10 hover:border-white/30 transition-all overflow-hidden group h-full flex flex-col cursor-pointer"
                onClick={() => navigate("/marketing-studio")}
              >
                <div className="h-40 w-full relative overflow-hidden bg-white/5 shrink-0">
                  {app.thumbnailUrl ? (
                    <img
                      src={app.thumbnailUrl}
                      alt={app.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : app.gradient ? (
                    <div
                      className="w-full h-full transition-transform duration-700 group-hover:scale-105"
                      style={{ background: app.gradient }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black transition-transform duration-700 group-hover:scale-105" />
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {app.isTrending && (
                      <Badge className="bg-black/60 backdrop-blur-md text-orange-400 border border-orange-500/30 text-[10px] px-2 py-0.5">
                        <Flame className="w-3 h-3 mr-1" /> Hot
                      </Badge>
                    )}
                    {app.isNew && (
                      <Badge className="bg-black/60 backdrop-blur-md text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5">New</Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <h4 className="font-bold text-white text-lg mb-1.5 group-hover:text-primary transition-colors">{app.name}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {app.description}
                  </p>

                  <Button
                    className="w-full bg-white text-black hover:bg-white/90 font-bold rounded-full mb-4"
                    onClick={(e) => { e.stopPropagation(); navigate("/marketing-studio"); }}
                  >
                    <Play className="w-3.5 h-3.5 mr-2 fill-black" /> Try now
                  </Button>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden">
                        {app.authorAvatarUrl ? (
                          <img src={app.authorAvatarUrl} alt={app.authorName} className="w-full h-full object-cover" />
                        ) : (
                          app.authorName.substring(0, 1)
                        )}
                      </div>
                      <span>{app.authorName}</span>
                    </div>
                    <div className="flex items-center font-mono">
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      {app.viewCount.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
