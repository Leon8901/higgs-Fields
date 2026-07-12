import { useListTools, getListToolsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Sparkles, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Tools() {
  const [category, setCategory] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tools, isLoading } = useListTools(
    { category },
    { query: { queryKey: getListToolsQueryKey({ category }) } }
  );

  const filteredTools = tools?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4">
            Studio Tools
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Professional-grade AI models optimized for cinematic production. 
            Select a tool to start generating.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search tools..." 
              className="pl-9 bg-white/5 border-white/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="border-white/10 text-white shrink-0">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={category} onValueChange={(v) => setCategory(v as any)} className="w-full">
        <TabsList className="bg-white/5 border border-white/10 p-1 mb-8">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-black">All Tools</TabsTrigger>
          <TabsTrigger value="image" className="data-[state=active]:bg-primary data-[state=active]:text-black">Image</TabsTrigger>
          <TabsTrigger value="video" className="data-[state=active]:bg-primary data-[state=active]:text-black">Video</TabsTrigger>
          <TabsTrigger value="audio" className="data-[state=active]:bg-primary data-[state=active]:text-black">Audio</TabsTrigger>
        </TabsList>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="bg-white/5 border-white/10 h-64 animate-pulse" />
              ))}
            </div>
          ) : filteredTools?.length === 0 ? (
            <div className="text-center py-24 border border-white/5 rounded-2xl bg-white/[0.02]">
              <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-white mb-2">No tools found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTools?.map((tool, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={tool.id}
                >
                  <Link href={`/tools/${tool.slug}`} className="block h-full">
                    <Card className="h-full bg-black/40 border-white/10 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(206,255,0,0.1)] transition-all group overflow-hidden relative flex flex-col">
                      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: tool.accentColor || '#CEFF00' }} />
                      
                      <CardContent className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden relative">
                            {tool.thumbnailUrl ? (
                              <img src={tool.thumbnailUrl} alt={tool.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full" style={{ background: tool.gradient || 'linear-gradient(45deg, #111, #333)' }} />
                            )}
                          </div>
                          <div className="flex gap-2">
                            {tool.isFeatured && <Badge variant="lime" className="text-[10px]">Featured</Badge>}
                            {tool.badge && <Badge variant="outline" className="text-white border-white/20 text-[10px]">{tool.badge}</Badge>}
                          </div>
                        </div>
                        
                        <div className="mb-2">
                          <Badge variant="secondary" className="bg-white/5 text-muted-foreground mb-3 text-[10px] uppercase">
                            {tool.category}
                          </Badge>
                          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                            {tool.name}
                          </h3>
                        </div>
                        
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-6 flex-1">
                          {tool.description}
                        </p>
                        
                        <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                          <span className="text-xs text-white/50 font-mono">v2.4.0</span>
                          <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                            Launch <span className="ml-1">→</span>
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
