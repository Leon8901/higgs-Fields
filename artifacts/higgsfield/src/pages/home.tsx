import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Play, Zap, Monitor, Cpu, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useJoinWaitlist, useListFeaturedTools, useListTools, useListApps, useGetPlatformStats, getListFeaturedToolsQueryKey, getListToolsQueryKey, getListAppsQueryKey, getGetPlatformStatsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function Home() {
  const { data: featuredTools, isLoading: toolsLoading } = useListFeaturedTools({
    query: { queryKey: getListFeaturedToolsQueryKey() }
  });
  
  const { data: allTools } = useListTools({ category: 'all' }, {
    query: { queryKey: getListToolsQueryKey({ category: 'all' }) }
  });
  
  const { data: apps } = useListApps({ filter: 'featured' }, {
    query: { queryKey: getListAppsQueryKey({ filter: 'featured' }) }
  });
  
  const { data: stats } = useGetPlatformStats({
    query: { queryKey: getGetPlatformStatsQueryKey() }
  });

  const [email, setEmail] = useState("");
  const joinWaitlist = useJoinWaitlist();
  const { toast } = useToast();

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    joinWaitlist.mutate({ data: { email } }, {
      onSuccess: () => {
        toast({
          title: "Added to waitlist",
          description: "We'll notify you when you have access.",
        });
        setEmail("");
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Something went wrong. Please try again.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col w-full pb-20 overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-4 flex flex-col items-center justify-center min-h-[90vh]">
        {/* Abstract background blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#CEFF00]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="container relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center">
          <motion.div 
            initial="hidden" 
            animate="visible" 
            variants={{
              hidden: { opacity: 0, scale: 0.9 },
              visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
            }}
            className="mb-8"
          >
            <Badge variant="glass" className="px-4 py-1.5 text-sm uppercase tracking-widest gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Higgsfield Cinema Studio is live
            </Badge>
          </motion.div>
          
          <motion.h1 
            initial="hidden" animate="visible" variants={fadeIn} transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-6 leading-[1.05]"
          >
            Every Frame <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50">You Imagine.</span>
          </motion.h1>
          
          <motion.p 
            initial="hidden" animate="visible" variants={fadeIn} transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl font-light"
          >
            One studio for cinematic video, photoreal imagery, and expressive audio —
            all from a single prompt, powered by the world's leading generative models.
          </motion.p>
          
          <motion.div 
            initial="hidden" animate="visible" variants={fadeIn} transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md"
          >
            <Button size="lg" variant="lime" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full group">
              Start Creating 
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-white/5 border-white/10 hover:bg-white/10">
              <Play className="mr-2 w-5 h-5" />
              Watch Reel
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Featured Tools Carousel/Grid */}
      <section className="py-20 bg-black relative border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Featured Studio Tools</h2>
            <Button variant="link" className="text-muted-foreground hover:text-white" asChild>
              <Link href="/tools">View all tools <ArrowRight className="ml-1 w-4 h-4" /></Link>
            </Button>
          </div>
          
          {toolsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="aspect-[4/5] rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredTools?.slice(0, 3).map((tool, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  key={tool.id}
                >
                  <Link href={`/tools/${tool.slug}`} className="block group">
                    <Card className="relative overflow-hidden border-0 aspect-[4/5] rounded-2xl bg-black">
                      <div className="absolute inset-0 z-0">
                        {/* Use generated images */}
                        <img 
                          src={tool.thumbnailUrl || `/thumbnails/tool-${i+1}.jpg`} 
                          alt={tool.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                      </div>
                      
                      <div className="relative z-10 h-full flex flex-col justify-between p-8">
                        <div className="flex justify-between items-start">
                          <Badge variant="glass" className="uppercase font-bold tracking-wider text-xs">
                            {tool.category}
                          </Badge>
                          {tool.badge && (
                            <Badge variant="lime" className="uppercase">{tool.badge}</Badge>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="text-3xl font-bold text-white mb-2 tracking-tight group-hover:text-primary transition-colors">
                            {tool.name}
                          </h3>
                          <p className="text-white/80 line-clamp-2">
                            {tool.tagline}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <span className="text-4xl md:text-6xl font-black text-white mb-2">
                {stats ? (stats.videosGenerated / 1000000).toFixed(1) + 'M+' : '10M+'}
              </span>
              <span className="text-sm text-muted-foreground uppercase tracking-widest">Videos Generated</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-4xl md:text-6xl font-black text-white mb-2">
                {stats ? (stats.activeCreators / 1000).toFixed(0) + 'K+' : '500K+'}
              </span>
              <span className="text-sm text-muted-foreground uppercase tracking-widest">Active Creators</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-4xl md:text-6xl font-black text-white mb-2">
                {stats ? stats.communityApps : '1,200+'}
              </span>
              <span className="text-sm text-muted-foreground uppercase tracking-widest">Community Apps</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-4xl md:text-6xl font-black text-white mb-2">
                {stats ? stats.modelsAvailable : '24'}
              </span>
              <span className="text-sm text-muted-foreground uppercase tracking-widest">Core Models</span>
            </div>
          </div>
        </div>
      </section>

      {/* App Gallery Preview */}
      <section className="py-24 bg-white/[0.02] border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">Built by the Community</h2>
            <p className="text-muted-foreground">
              Discover powerful micro-apps built on top of the Higgsfield API by our community of developers and creators.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {apps?.slice(0, 4).map((app, i) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                key={app.id}
              >
                <Card className="bg-black/50 border-white/10 hover:border-white/20 transition-all overflow-hidden group">
                  <div className="h-40 w-full relative overflow-hidden bg-white/5">
                    {app.thumbnailUrl || app.gradient ? (
                      <div className="w-full h-full" style={{ background: app.gradient || undefined }}>
                        {app.thumbnailUrl && <img src={`/thumbnails/app-${i+1}.jpg`} className="w-full h-full object-cover opacity-80" alt={app.name} />}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-black" />
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                  </div>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white text-lg truncate pr-2">{app.name}</h4>
                      {app.isTrending && <Badge variant="lime" className="text-[10px] px-1.5 py-0">Hot</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                      {app.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                        {app.authorAvatarUrl ? (
                          <img src={app.authorAvatarUrl} alt={app.authorName} className="w-full h-full object-cover" />
                        ) : (
                          app.authorName.substring(0, 1)
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{app.authorName}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" asChild>
              <Link href="/apps">Explore App Gallery</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Waitlist CTA */}
      <section className="py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="max-w-2xl mx-auto">
            <Zap className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
              Ready to redefine reality?
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Join thousands of creators building the next era of cinematic experiences.
            </p>
            
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input 
                type="email" 
                placeholder="Enter your email" 
                className="h-14 bg-white/5 border-white/10 focus-visible:border-primary text-white text-lg rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button 
                type="submit" 
                variant="lime" 
                className="h-14 px-8 text-lg rounded-xl"
                disabled={joinWaitlist.isPending}
              >
                {joinWaitlist.isPending ? "Joining..." : "Join Waitlist"}
              </Button>
            </form>
          </div>
        </div>
      </section>
      
    </div>
  );
}
