import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import {
  useGetModel,
  useGetMe,
  useCreateGeneration,
  useGetGeneration,
  useListGenerations,
  useDeleteGeneration,
  useListAvatars,
  useCreateAvatar,
  useUpdateAvatar,
  useDeleteAvatar,
  getGetMeQueryKey,
  getListGenerationsQueryKey,
  getGetGenerationQueryKey,
  getListAvatarsQueryKey,
  type Generation,
  type Avatar as AvatarRecord,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  LayoutGrid,
  Heart,
  Link2,
  FileImage,
  Plus,
  Folder,
  ChevronDown,
  Package,
  Smartphone,
  Sparkles,
  Zap,
  AlertCircle,
  Download,
  User,
  User2,
  LogOut,
  RefreshCw,
  Trash2,
  Upload,
  Settings,
  Shuffle,
  Play,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Film,
  Wand2,
  Pencil,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── constants ────────────────────────────────────────────────────────────────
const FAVORITES_KEY = "mktStudio_favorites";

function loadFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveFavorites(set: Set<number>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
}

// ─── upload helper ────────────────────────────────────────────────────────────
async function uploadFile(file: File): Promise<string> {
  const requestRes = await fetch(`${basePath}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!requestRes.ok) throw new Error("Failed to request upload URL");
  const { uploadURL, objectPath } = await requestRes.json();
  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) throw new Error("Failed to upload file");
  return `${window.location.origin}${basePath}/api/storage${objectPath}`;
}

// ─── types ────────────────────────────────────────────────────────────────────
type SourceType = "product" | "app";
type FilterTag = "all" | "tiktok" | "ugc" | "commercial";
type TemplateId =
  | "ugc-testimonial"
  | "this-gadget-saved-me"
  | "giant-figure"
  | "unboxing-virtual-try-on"
  | "unboxing-asmr"
  | "virtual-try-on-sneakers"
  | "studio-commercial"
  | "cinematic-launch";
type CreativeMode = "ugc" | "cgi" | "cinematic" | "wildcard";
type UgcSubVariant = "testimonial" | "unboxing" | "tutorial" | "handson";
type SidebarSection =
  | "home"
  | "all-generations"
  | "favorites"
  | "url-to-ad"
  | "ad-reference"
  | "avatars";

// ─── template catalogue ───────────────────────────────────────────────────────
const TEMPLATES: Record<
  TemplateId,
  {
    label: string;
    description: string;
    modelId: string;
    directive: string;
    needsImage: boolean;
    tags: Exclude<FilterTag, "all">[];
    iconColor: string;
    thumbnails: [string, string, string];
    isNew?: boolean;
  }
> = {
  "ugc-testimonial": {
    label: "UGC",
    description: "Realistic social media videos",
    modelId: "wan-2-2-image-to-video",
    directive:
      "Shot on a phone, natural handheld camera movement, authentic UGC creator energy, casual lighting, no studio polish.",
    needsImage: true,
    tags: ["ugc", "tiktok"],
    iconColor: "from-cyan-400 to-blue-500",
    thumbnails: [
      "https://picsum.photos/seed/ugc1/300/480",
      "https://picsum.photos/seed/ugc2/300/480",
      "https://picsum.photos/seed/ugc3/300/480",
    ],
  },
  "this-gadget-saved-me": {
    label: "This Gadget Saved Me",
    description: "Turn product features into a creator-led recommendation",
    modelId: "wan-2-2-image-to-video",
    directive:
      "Creator-style product recommendation, direct-to-camera authentic moment, emotional reveal of product benefit.",
    needsImage: true,
    tags: ["ugc"],
    iconColor: "from-orange-400 to-red-500",
    thumbnails: [
      "https://picsum.photos/seed/gadget1/300/480",
      "https://picsum.photos/seed/gadget2/300/480",
      "https://picsum.photos/seed/gadget3/300/480",
    ],
  },
  "giant-figure": {
    label: "Giant Figure",
    description: "Oversized, scroll-stopping product moments",
    modelId: "kling-v3-pro",
    directive:
      "Product shown at giant scale against real environments, surrealist product photography, scroll-stopping visual surprise.",
    needsImage: false,
    tags: ["commercial"],
    isNew: true,
    iconColor: "from-violet-400 to-purple-600",
    thumbnails: [
      "https://picsum.photos/seed/giant1/300/480",
      "https://picsum.photos/seed/giant2/300/480",
      "https://picsum.photos/seed/giant3/300/480",
    ],
  },
  "unboxing-virtual-try-on": {
    label: "Unboxing Virtual Try-On",
    description: "Unbox and try on in one take",
    modelId: "wan-2-2-image-to-video",
    directive:
      "Unboxing moment followed immediately by virtual try-on, seamless cut, creator energy, high-anticipation pacing.",
    needsImage: true,
    tags: ["ugc", "tiktok"],
    isNew: true,
    iconColor: "from-teal-400 to-emerald-500",
    thumbnails: [
      "https://picsum.photos/seed/unbox1/300/480",
      "https://picsum.photos/seed/unbox2/300/480",
      "https://picsum.photos/seed/unbox3/300/480",
    ],
  },
  "unboxing-asmr": {
    label: "Unboxing ASMR",
    description: "Satisfying ASMR unboxing experiences",
    modelId: "seedance-2-0",
    directive:
      "ASMR-style unboxing, close-up textures, deliberate slow pacing, crisp tactile sounds implied, intimate framing.",
    needsImage: false,
    tags: ["ugc"],
    iconColor: "from-pink-400 to-rose-500",
    thumbnails: [
      "https://picsum.photos/seed/asmr1/300/480",
      "https://picsum.photos/seed/asmr2/300/480",
      "https://picsum.photos/seed/asmr3/300/480",
    ],
  },
  "virtual-try-on-sneakers": {
    label: "Virtual Try-On Sneakers",
    description: "Virtual sneaker try-on videos",
    modelId: "wan-2-2-image-to-video",
    directive:
      "Virtual sneaker try-on, foot-level close-ups, lifestyle walking shots, clean floor backgrounds, dynamic angles.",
    needsImage: true,
    tags: ["commercial", "ugc"],
    iconColor: "from-lime-400 to-green-500",
    thumbnails: [
      "https://picsum.photos/seed/sneaker1/300/480",
      "https://picsum.photos/seed/sneaker2/300/480",
      "https://picsum.photos/seed/sneaker3/300/480",
    ],
  },
  "studio-commercial": {
    label: "Studio Commercial",
    description: "Clean studio lighting, polished product-focused shots",
    modelId: "kling-v3-pro",
    directive:
      "Professional studio product commercial, clean CGI-quality lighting, smooth camera moves, polished brand-safe composition.",
    needsImage: false,
    tags: ["commercial"],
    iconColor: "from-slate-400 to-blue-500",
    thumbnails: [
      "https://picsum.photos/seed/studio1/300/480",
      "https://picsum.photos/seed/studio2/300/480",
      "https://picsum.photos/seed/studio3/300/480",
    ],
  },
  "cinematic-launch": {
    label: "Cinematic Launch",
    description: "Dramatic, film-grade lighting for a big product reveal",
    modelId: "seedance-2-0",
    directive:
      "Cinematic ad film, dramatic lighting, shallow depth of field, film-grade color grade, high-production-value camera movement.",
    needsImage: false,
    tags: ["commercial"],
    isNew: true,
    iconColor: "from-amber-400 to-orange-500",
    thumbnails: [
      "https://picsum.photos/seed/cinematic1/300/480",
      "https://picsum.photos/seed/cinematic2/300/480",
      "https://picsum.photos/seed/cinematic3/300/480",
    ],
  },
};

const FILTERS: { value: FilterTag; label: string; isNew?: boolean }[] = [
  { value: "all", label: "All" },
  { value: "tiktok", label: "TikTok", isNew: true },
  { value: "ugc", label: "UGC" },
  { value: "commercial", label: "Commercial" },
];

// ─── creative mode config ─────────────────────────────────────────────────────
const CREATIVE_MODES: Record<
  CreativeMode,
  {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    description: string;
    modelId: string;
    hint: string;
    accentColor: string; // tailwind classes for active state
  }
> = {
  ugc: {
    label: "UGC",
    Icon: Smartphone,
    description: "Authentic creator-style content",
    modelId: "wan-2-2-image-to-video",
    hint: "iPhone-shot, face-to-camera, creator energy",
    accentColor: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  },
  cgi: {
    label: "Professional",
    Icon: Sparkles,
    description: "Studio-grade, precision product reveal",
    modelId: "kling-v3-pro",
    hint: "CGI quality, precise camera choreography",
    accentColor: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  },
  cinematic: {
    label: "Cinematic",
    Icon: Film,
    description: "Story arc, broadcast commercial feel",
    modelId: "seedance-2-0",
    hint: "Real-world location, film-grade lighting",
    accentColor: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  },
  wildcard: {
    label: "Wild Card",
    Icon: Wand2,
    description: "Unexpected, imagination-first",
    modelId: "seedance-2-0",
    hint: "No rules — full creative direction to the AI",
    accentColor: "bg-pink-500/15 text-pink-300 border-pink-400/30",
  },
};

const UGC_SUB_VARIANTS: Record<UgcSubVariant, { label: string; hint: string }> = {
  testimonial: { label: "Testimonial", hint: "Creator speaks to camera" },
  unboxing: { label: "Unboxing", hint: "First reaction reveal" },
  tutorial: { label: "Tutorial", hint: "Step-by-step walkthrough" },
  handson: { label: "Hands-On", hint: "Close-up product demo" },
};

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ─── generation card ──────────────────────────────────────────────────────────
function GenerationCard({
  gen,
  isFavorite,
  onToggleFavorite,
  onRerun,
  onDelete,
}: {
  gen: Generation;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  onRerun: (gen: Generation) => void;
  onDelete: (id: number) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const output = gen.outputUrls?.[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#111411] group"
    >
      {/* Thumbnail area */}
      <div className="aspect-video bg-black/40 flex items-center justify-center relative overflow-hidden">
        {gen.status === "completed" && output ? (
          gen.category === "video" ? (
            <video
              src={output}
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
          ) : (
            <img src={output} alt={gen.prompt} className="w-full h-full object-cover" />
          )
        ) : gen.status === "failed" ? (
          <div className="flex flex-col items-center gap-2 text-red-400/70">
            <AlertCircle className="w-8 h-8" />
            <p className="text-xs text-center px-4">{gen.errorMessage ?? "Generation failed"}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/30">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-xs">Generating…</p>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          {gen.status === "completed" && (
            <span className="flex items-center gap-1 bg-black/70 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-2.5 h-2.5" /> Done
            </span>
          )}
          {gen.status === "failed" && (
            <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <AlertCircle className="w-2.5 h-2.5" /> Failed
            </span>
          )}
          {(gen.status === "pending" || gen.status === "processing") && (
            <span className="flex items-center gap-1 bg-black/70 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Processing
            </span>
          )}
        </div>

        {/* Download overlay */}
        {gen.status === "completed" && output && (
          <a
            href={output}
            download
            target="_blank"
            rel="noreferrer"
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-white/80 font-medium leading-snug line-clamp-2 mb-2">
          {gen.prompt}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full">
              {gen.modelName ?? gen.modelId}
            </span>
            <span className="text-[10px] text-white/25">
              {gen.createdAt ? relativeTime(gen.createdAt) : ""}
            </span>
          </div>

          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Favorite */}
            <button
              type="button"
              onClick={() => onToggleFavorite(gen.id)}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                isFavorite
                  ? "text-red-400 hover:text-red-300"
                  : "text-white/30 hover:text-red-400"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-current" : ""}`} />
            </button>

            {/* Re-run */}
            {gen.status === "completed" && (
              <button
                type="button"
                onClick={() => onRerun(gen)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-primary transition-colors"
                title="Re-run"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete */}
            {confirmDelete ? (
              <button
                type="button"
                onClick={() => onDelete(gen.id)}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors px-1"
              >
                Confirm
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                onBlur={() => setTimeout(() => setConfirmDelete(false), 200)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── all generations view ─────────────────────────────────────────────────────
function AllGenerationsView({
  favorites,
  onToggleFavorite,
  onRerun,
}: {
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
  onRerun: (gen: Generation) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: generations, isLoading } = useListGenerations();

  const deleteGen = useDeleteGeneration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/30">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading generations…
      </div>
    );
  }

  if (!generations?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
          <LayoutGrid className="w-6 h-6 text-white/30" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">No generations yet</p>
          <p className="text-xs text-white/30 mt-1 max-w-xs">
            Your generated ads will appear here once you start creating.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-6 pb-44">
      <h2 className="text-sm font-bold text-white/70 mb-4">
        All generations · {generations.length}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {generations.map((gen: Generation) => (
            <GenerationCard
              key={gen.id}
              gen={gen}
              isFavorite={favorites.has(gen.id)}
              onToggleFavorite={onToggleFavorite}
              onRerun={onRerun}
              onDelete={(id) => deleteGen.mutate({ id })}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── favorites view ───────────────────────────────────────────────────────────
function FavoritesView({
  favorites,
  onToggleFavorite,
  onRerun,
}: {
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
  onRerun: (gen: Generation) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allGenerations, isLoading } = useListGenerations();
  const favorited = (allGenerations ?? []).filter((g: Generation) => favorites.has(g.id));

  const deleteGen = useDeleteGeneration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/30">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (!favorited.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
          <Heart className="w-6 h-6 text-white/30" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">No favorites yet</p>
          <p className="text-xs text-white/30 mt-1 max-w-xs">
            Click the ♥ on any generation to save it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-6 pb-44">
      <h2 className="text-sm font-bold text-white/70 mb-4">
        My favorites · {favorited.length}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {favorited.map((gen: Generation) => (
            <GenerationCard
              key={gen.id}
              gen={gen}
              isFavorite
              onToggleFavorite={onToggleFavorite}
              onRerun={onRerun}
              onDelete={(id) => deleteGen.mutate({ id })}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── url-to-ad modal ──────────────────────────────────────────────────────────
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isPlausibleUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  // Must have at least one dot and no spaces
  return s.includes(".") && !s.includes(" ") && s.length > 3;
}

function UrlToAdModal({
  open,
  onClose,
  onFill,
}: {
  open: boolean;
  onClose: () => void;
  onFill: (productName: string, description: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Reset state when modal opens
  useEffect(() => {
    if (open) { setUrl(""); setError(null); setAnalyzing(false); }
  }, [open]);

  const handleContinue = async () => {
    const normalized = normalizeUrl(url);
    if (!isPlausibleUrl(url)) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/marketing/url-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't analyse that page — try another URL.");
        return;
      }
      onFill(data.productName ?? "", data.description || data.tagline || "");
      toast({ title: "Product info loaded", description: "Brief pre-filled — hit Generate when ready." });
      onClose();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const canContinue = isPlausibleUrl(url) && !analyzing;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[900px] rounded-2xl overflow-hidden border border-white/[0.1] shadow-2xl shadow-black/80"
            style={{ background: "#141414" }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.14] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex min-h-[480px]">
              {/* ── Left panel */}
              <div className="flex-1 flex flex-col justify-between p-8 md:p-10">
                {/* Header */}
                <div>
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center mb-6 shadow-lg shadow-pink-900/30">
                    <Wand2 className="w-6 h-6 text-white" />
                  </div>

                  <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                    One link.<br />A ready-to-post ad.
                  </h2>
                  <p className="text-sm text-white/50 leading-relaxed max-w-sm">
                    Drop your product URL — we'll scrape the page, extract the brief, and
                    fill the generator. No filming, no editing, no form to fill.
                  </p>
                </div>

                {/* Input */}
                <div className="mt-10 space-y-3">
                  <div className="relative">
                    <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); setError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && canContinue && handleContinue()}
                      placeholder="www.yourproduct.com"
                      autoFocus
                      className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/25 transition-colors"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!canContinue}
                    className="w-full py-3.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                    style={{
                      background: canContinue
                        ? "linear-gradient(135deg, #e040fb 0%, #f06292 100%)"
                        : "rgba(255,255,255,0.06)",
                      color: canContinue ? "#fff" : "rgba(255,255,255,0.2)",
                      boxShadow: canContinue ? "0 0 24px rgba(224,64,251,0.28)" : "none",
                    }}
                  >
                    {analyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analysing your page…
                      </>
                    ) : (
                      "Continue"
                    )}
                  </button>
                </div>
              </div>

              {/* ── Right panel — example output */}
              <div className="hidden md:flex w-[46%] shrink-0 relative overflow-hidden">
                {/* Gradient background */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #0d1f0a 0%, #1a3a10 40%, #0d2b17 70%, #061508 100%)",
                  }}
                />
                {/* Noise texture overlay */}
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                  }}
                />
                {/* Glow orbs */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(206,255,0,0.18) 0%, transparent 70%)" }} />
                <div className="absolute bottom-1/4 right-1/4 w-32 h-32 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(224,64,251,0.12) 0%, transparent 70%)" }} />

                {/* Faux product card */}
                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full gap-4 px-8">
                  <div className="w-[180px] h-[220px] rounded-2xl border border-white/[0.12] overflow-hidden relative"
                    style={{ background: "linear-gradient(160deg,#1e3d12,#0c1f09)" }}>
                    {/* Abstract product shape */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full"
                        style={{ background: "radial-gradient(circle, rgba(206,255,0,0.7) 0%, rgba(100,200,50,0.3) 60%, transparent 100%)", filter: "blur(2px)" }} />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 px-4 py-3 backdrop-blur-sm"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Generated</p>
                      <p className="text-xs text-white/70 font-semibold">15-sec product ad</p>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-[11px] text-white/40 font-medium">TikTok · Reels · Shorts</p>
                  </div>
                </div>

                {/* Bottom label */}
                <div className="absolute bottom-5 left-0 right-0 flex justify-center">
                  <div className="flex items-center gap-1.5 bg-black/40 border border-white/[0.08] rounded-full px-3 py-1.5 backdrop-blur-sm">
                    <CheckCircle2 className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-white/50 font-medium">No filming or editing needed</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── avatars section ──────────────────────────────────────────────────────────
function AvatarsSection({ onSelect }: { onSelect: (av: AvatarRecord) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: avatars, isLoading } = useListAvatars();

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // rename state per avatar id
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const createAvatar = useCreateAvatar({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAvatarsQueryKey() });
        setShowCreate(false);
        setNewName("");
        setNewPhotoUrl(null);
        toast({ title: "Avatar saved" });
      },
      onError: () => toast({ title: "Failed to save avatar", variant: "destructive" }),
    },
  });

  const updateAvatar = useUpdateAvatar({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAvatarsQueryKey() });
        setRenamingId(null);
      },
      onError: () => toast({ title: "Rename failed", variant: "destructive" }),
    },
  });

  const deleteAvatar = useDeleteAvatar({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAvatarsQueryKey() });
        toast({ title: "Avatar deleted" });
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    },
  });

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setNewPhotoUrl(await uploadFile(file));
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = () => {
    if (!newName.trim() || !newPhotoUrl) return;
    createAvatar.mutate({ data: { name: newName.trim(), photoUrl: newPhotoUrl } });
  };

  return (
    <div className="relative z-10 pb-44 px-6 pt-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-white">Saved Avatars</h2>
          <p className="text-xs text-white/40 mt-0.5">Reuse a spokesperson across generations</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New avatar
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden mb-5"
          >
            <div className="bg-[#111411]/90 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest">New Avatar</p>

              {/* Photo upload */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoFile(e.target.files?.[0])}
              />
              {newPhotoUrl ? (
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-white/15">
                  <img src={newPhotoUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setNewPhotoUrl(null)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-20 h-20 rounded-2xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1.5 text-white/30 hover:text-primary hover:border-primary/50 transition-colors"
                >
                  {uploading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span className="text-[10px]">Photo</span>
                    </>
                  )}
                </button>
              )}

              {/* Name */}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Avatar name (e.g. 'Sarah')"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50 transition-colors"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || !newPhotoUrl || createAvatar.isPending}
                  className="flex-1 py-2 bg-primary text-black text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {createAvatar.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save avatar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewName(""); setNewPhotoUrl(null); }}
                  className="px-4 py-2 rounded-xl border border-white/10 text-white/50 text-xs font-medium hover:text-white hover:border-white/25 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-white/30">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : !avatars?.length ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
            <User2 className="w-6 h-6 text-white/30" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/60">No avatars yet</p>
            <p className="text-xs text-white/30 mt-1 max-w-xs">
              Save a spokesperson photo once and reuse it across every generation.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {avatars.map((av: AvatarRecord) => (
              <motion.div
                key={av.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#111411] group"
              >
                {/* Photo */}
                <div className="aspect-square overflow-hidden bg-black/40">
                  <img src={av.photoUrl} alt={av.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>

                {/* Name / rename */}
                <div className="px-3 py-2.5 flex items-center gap-1.5">
                  {renamingId === av.id ? (
                    <form
                      className="flex-1 flex items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renameValue.trim()) updateAvatar.mutate({ id: av.id, data: { name: renameValue.trim() } });
                      }}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="flex-1 min-w-0 bg-white/[0.08] border border-white/15 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-primary/50"
                      />
                      <button type="submit" className="text-primary">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setRenamingId(null)} className="text-white/30 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-white/80 truncate flex-1">{av.name}</p>
                      <button
                        type="button"
                        onClick={() => { setRenamingId(av.id); setRenameValue(av.name); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-primary"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>

                {/* Actions overlay */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onSelect(av)}
                    className="px-2.5 py-1 rounded-lg bg-primary text-black text-[10px] font-bold hover:bg-primary/90 transition-colors"
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAvatar.mutate({ id: av.id })}
                    className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white/60 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── ad reference section ─────────────────────────────────────────────────────
function AdReferenceSection({
  onGenerate,
}: {
  onGenerate: (imageUrl: string, description: string) => void;
}) {
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setRefImageUrl(await uploadFile(file));
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = () => {
    if (!refImageUrl) return;
    onGenerate(refImageUrl, description);
    toast({
      title: "Reference applied",
      description: "Switched to image-to-video with your reference. Hit Generate.",
    });
  };

  return (
    <div className="relative z-10 pb-44 px-6 pt-12 max-w-lg mx-auto w-full">
      <div className="bg-[#111411]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center mb-4">
          <FileImage className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Ad Reference</h2>
        <p className="text-sm text-white/50 mb-5">
          Upload a reference image or ad screenshot to use as the base for your new
          video ad. We'll animate it into a short clip.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {/* Upload area */}
        {refImageUrl ? (
          <div className="relative mb-4 rounded-xl overflow-hidden border border-white/10">
            <img
              src={refImageUrl}
              alt="Reference"
              className="w-full h-48 object-cover"
            />
            <button
              type="button"
              onClick={() => setRefImageUrl(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-40 rounded-xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-3 text-white/40 hover:text-primary hover:border-primary/50 transition-colors mb-4"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-sm">Uploading…</span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                <span className="text-sm">Click to upload reference image</span>
                <span className="text-xs text-white/25">PNG, JPG, WEBP</span>
              </>
            )}
          </button>
        )}

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the style of ad you want (optional)…"
          rows={3}
          className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50 transition-colors resize-none mb-4"
        />

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!refImageUrl}
          className="w-full py-2.5 bg-primary text-black text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" /> Apply Reference & Generate
        </button>
      </div>
    </div>
  );
}

// ─── sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  active,
  onNavigate,
  creditsBalance,
}: {
  active: SidebarSection;
  onNavigate: (s: SidebarSection) => void;
  creditsBalance?: number;
}) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const { user } = useUser();
  const { signOut } = useClerk();

  const mainNav = [
    {
      id: "home" as SidebarSection,
      label: "Home",
      Icon: Home,
      gradient: "from-cyan-400 to-teal-500",
    },
    {
      id: "all-generations" as SidebarSection,
      label: "All generations",
      Icon: LayoutGrid,
      gradient: "from-purple-400 to-pink-500",
    },
    {
      id: "favorites" as SidebarSection,
      label: "My favorites",
      Icon: Heart,
      gradient: "from-pink-400 to-red-500",
    },
  ];

  const tools = [
    {
      id: "url-to-ad" as SidebarSection,
      label: "Url to Ad",
      Icon: Link2,
      gradient: "from-blue-400 to-cyan-400",
    },
    {
      id: "ad-reference" as SidebarSection,
      label: "Ad Reference",
      Icon: FileImage,
      gradient: "from-violet-400 to-purple-500",
    },
    {
      id: "avatars" as SidebarSection,
      label: "Avatars",
      Icon: User2,
      gradient: "from-emerald-400 to-teal-500",
    },
  ];

  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-[#0e0e0e] border-r border-white/[0.06] h-screen sticky top-0 overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.06] shrink-0">
        <div className="w-7 h-7 bg-primary rounded-md shadow-[0_0_10px_rgba(206,255,0,0.35)] flex items-center justify-center shrink-0">
          <div className="w-2.5 h-2.5 bg-black rounded-sm" />
        </div>
        <span className="font-bold text-sm text-white leading-none">
          Marketing Studio
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-white/30 ml-auto shrink-0" />
      </div>

      {/* Credits badge */}
      {creditsBalance !== undefined && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-white">{creditsBalance}</span>
          </div>
          <Link href="/pricing">
            <span className="text-[10px] text-white/40 hover:text-primary transition-colors font-medium">
              Get more →
            </span>
          </Link>
        </div>
      )}

      {/* Main nav */}
      <div className="px-2 pt-3 pb-1 space-y-0.5">
        {mainNav.map(({ id, label, Icon, gradient }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
              active === id
                ? "bg-white/[0.08] text-white"
                : "text-white/55 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}
            >
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            {label}
          </button>
        ))}
      </div>

      {/* Tools */}
      <div className="px-4 pt-5 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">
          Tools
        </p>
        <div className="space-y-0.5 -mx-2">
          {tools.map(({ id, label, Icon, gradient }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                active === id
                  ? "bg-white/[0.08] text-white"
                  : "text-white/55 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}
              >
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div className="px-4 pt-5 pb-1">
        <button
          type="button"
          onClick={() => setProjectsOpen((o) => !o)}
          className="flex items-center justify-between w-full mb-2 group"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 group-hover:text-white/40 transition-colors">
            Projects
          </p>
          <ChevronDown
            className={`w-3 h-3 text-white/25 transition-transform ${
              projectsOpen ? "" : "-rotate-90"
            }`}
          />
        </button>
        <AnimatePresence initial={false}>
          {projectsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden -mx-2 space-y-0.5"
            >
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New project
              </button>
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <Folder className="w-3.5 h-3.5" /> New folder
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User */}
      <div className="mt-auto border-t border-white/[0.06] p-3">
        <Show when="signed-in">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (user?.primaryEmailAddress?.emailAddress?.[0] ?? "U").toUpperCase()
              )}
            </div>
            <p className="text-xs text-white/50 truncate flex-1">
              {user?.primaryEmailAddress?.emailAddress ?? "Account"}
            </p>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </Show>
        <Show when="signed-out">
          <Link href="/sign-in">
            <button
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <User className="w-3.5 h-3.5" /> Sign in
            </button>
          </Link>
        </Show>
      </div>
    </aside>
  );
}

// ─── template card ────────────────────────────────────────────────────────────
function TemplateCard({
  id,
  cfg,
  isSelected,
  onTry,
}: {
  id: TemplateId;
  cfg: (typeof TEMPLATES)[TemplateId];
  isSelected: boolean;
  onTry: (id: TemplateId) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className={`relative rounded-2xl overflow-hidden border transition-all duration-200 group ${
        isSelected
          ? "border-primary/60 shadow-[0_0_0_1px_rgba(206,255,0,0.25)]"
          : "border-white/[0.08] hover:border-white/20"
      }`}
      style={{ background: "#111411" }}
    >
      <div className="flex gap-0.5 h-52 overflow-hidden">
        {cfg.thumbnails.map((src, i) => (
          <div key={i} className="flex-1 overflow-hidden">
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.iconColor} flex items-center justify-center shrink-0`}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">{cfg.label}</p>
            {cfg.isNew && (
              <span className="text-[9px] font-bold bg-primary text-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                NEW
              </span>
            )}
          </div>
          <p className="text-xs text-white/45 truncate">{cfg.description}</p>
        </div>
        <button
          type="button"
          onClick={() => onTry(id)}
          className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary text-black hover:bg-primary/90 transition-colors"
        >
          {isSelected ? "Selected ✓" : "Try"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── inline result banner (home section) ─────────────────────────────────────
function ResultBanner({ generation }: { generation: Generation | undefined }) {
  if (!generation) return null;

  if (generation.status === "failed") {
    return (
      <div className="mx-6 mb-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center gap-3 px-4 py-3 text-red-400 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {generation.errorMessage ?? "Generation failed — please try again."}
      </div>
    );
  }
  if (generation.status === "pending" || generation.status === "processing") {
    return (
      <div className="mx-6 mb-4 rounded-xl border border-white/10 bg-white/[0.03] flex items-center gap-3 px-4 py-3 text-white/50 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
        Generating your ad — this takes a moment…
      </div>
    );
  }
  const output = generation.outputUrls?.[0];
  if (!output) return null;

  return (
    <div className="mx-6 mb-4 rounded-2xl overflow-hidden border border-primary/20 bg-black/40 relative group">
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 text-primary text-[10px] font-bold px-2.5 py-1 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Generated
      </div>
      {generation.category === "video" ? (
        <video src={output} controls autoPlay loop className="w-full aspect-video object-cover" />
      ) : (
        <img src={output} alt={generation.prompt} className="w-full aspect-video object-cover" />
      )}
      <a
        href={output}
        download
        target="_blank"
        rel="noreferrer"
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function MarketingStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── nav
  const [activeSection, setActiveSection] = useState<SidebarSection>("home");
  const [urlToAdOpen, setUrlToAdOpen] = useState(false);

  const handleNavigate = useCallback((section: SidebarSection) => {
    if (section === "url-to-ad") {
      setUrlToAdOpen(true);
    } else {
      setActiveSection(section);
    }
  }, []);

  // ── gen form
  const [sourceType, setSourceType] = useState<SourceType>("product");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("ugc-testimonial");
  const [creativeMode, setCreativeMode] = useState<CreativeMode>("ugc");
  const [ugcSubVariant, setUgcSubVariant] = useState<UgcSubVariant>("testimonial");
  const [promptBuilding, setPromptBuilding] = useState(false);
  const [filter, setFilter] = useState<FilterTag>("all");
  const [activeGenerationId, setActiveGenerationId] = useState<number | null>(null);

  // ── favorites
  const [favorites, setFavorites] = useState<Set<number>>(() => loadFavorites());
  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  // ── file refs
  const productInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const cfg = TEMPLATES[template];
  const { data: model } = useGetModel(CREATIVE_MODES[creativeMode].modelId);
  const { data: me } = useGetMe();

  const applyTemplate = (id: TemplateId) => {
    setTemplate(id);
    setActiveSection("home");
    // Clear image if new template doesn't need one
    if (!TEMPLATES[id].needsImage) setImageUrl(undefined);
  };

  const filteredTemplates = (
    Object.entries(TEMPLATES) as [TemplateId, (typeof TEMPLATES)[TemplateId]][]
  ).filter(([, c]) => filter === "all" || c.tags.includes(filter as Exclude<FilterTag, "all">));

  // ── file uploads
  const handleProductFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadFile(file));
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    setAvatarUploading(true);
    try {
      setAvatarUrl(await uploadFile(file));
      toast({ title: "Avatar uploaded", description: "It'll influence your UGC generation." });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── generation
  const createGeneration = useCreateGeneration({
    mutation: {
      onSuccess: (gen: Generation) => {
        setActiveGenerationId(gen.id);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      },
      onError: (err: any) => {
        const msg = err?.data?.error ?? err?.message ?? "Please try again.";
        toast({ title: "Generation failed", description: msg, variant: "destructive" });
      },
    },
  });

  const { data: activeGeneration } = useGetGeneration(activeGenerationId ?? 0, {
    query: {
      queryKey: getGetGenerationQueryKey(activeGenerationId ?? 0),
      enabled: !!activeGenerationId,
      refetchInterval: (query: { state: { data?: Generation } }) => {
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
  const needsImage = creativeMode === "ugc";
  const missingImage = needsImage && !imageUrl;
  const canSubmit =
    !!model &&
    description.trim().length > 0 &&
    !missingImage &&
    !createGeneration.isPending &&
    !promptBuilding &&
    !insufficientCredits;

  const handleSubmit = async () => {
    if (!model || promptBuilding || createGeneration.isPending) return;
    setPromptBuilding(true);
    let finalPrompt = `${productName ? `${productName}. ` : ""}${description}`.trim();
    try {
      const res = await fetch(`${basePath}/api/marketing/build-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productName,
          description,
          mode: creativeMode,
          ugcSubVariant: creativeMode === "ugc" ? ugcSubVariant : undefined,
          sourceType,
          hasAvatar: !!avatarUrl,
          hasProductImage: !!imageUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prompt) finalPrompt = data.prompt as string;
      }
    } catch {
      // Network failure — fall back to local string, still generate
    } finally {
      setPromptBuilding(false);
    }
    createGeneration.mutate({
      data: {
        modelId: model.modelId,
        prompt: finalPrompt,
        params: needsImage ? { image: imageUrl } : {},
        autoSelect: false,
        skipEnhance: true,
      },
    });
  };

  // ── re-run from All Generations / Favorites
  const handleRerun = (gen: Generation) => {
    // Match modelId back to a creative mode
    const modeEntry = (Object.entries(CREATIVE_MODES) as [CreativeMode, (typeof CREATIVE_MODES)[CreativeMode]][]).find(
      ([, m]) => m.modelId === gen.modelId,
    );
    if (modeEntry) setCreativeMode(modeEntry[0]);
    // Also try to find a matching template for the style pill
    const templateEntry = Object.entries(TEMPLATES).find(
      ([, t]) => t.modelId === gen.modelId,
    );
    if (templateEntry) setTemplate(templateEntry[0] as TemplateId);
    setDescription(gen.prompt);
    setActiveGenerationId(null);
    setActiveSection("home");
  };

  // ── URL-to-Ad auto-fill
  const handleUrlFill = (name: string, desc: string) => {
    setProductName(name);
    setDescription(desc);
    setActiveSection("home");
    setUrlToAdOpen(false);
  };

  // ── Ad Reference apply
  const handleAdReferenceFill = (refUrl: string, desc: string) => {
    // Switch to image-to-video template and fill image
    setTemplate("ugc-testimonial"); // wan-2-2-image-to-video
    setImageUrl(refUrl);
    if (desc) setDescription(desc);
    setActiveSection("home");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Hidden file inputs */}
      <input
        ref={productInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleProductFile(e.target.files?.[0])}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleAvatarFile(e.target.files?.[0])}
      />

      {/* ── Url to Ad modal */}
      <UrlToAdModal
        open={urlToAdOpen}
        onClose={() => setUrlToAdOpen(false)}
        onFill={handleUrlFill}
      />

      {/* ── Sidebar */}
      <Sidebar
        active={activeSection}
        onNavigate={handleNavigate}
        creditsBalance={me?.creditsBalance}
      />

      {/* ── Main */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] shrink-0 bg-[#0e0e0e]/80 backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
            Marketing Studio
          </p>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-pink-500/40 bg-pink-500/10 text-xs font-bold text-pink-300 hover:bg-pink-500/20 transition-colors"
              >
                <span className="text-[9px] bg-pink-500 text-white rounded-full px-1.5 py-0.5 font-black">
                  30% OFF
                </span>
                Pricing
              </button>
            </Link>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-primary" />
              Assets
            </button>
            <Show when="signed-in">
              <Link href="/account">
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white font-bold text-xs hover:border-primary/50 transition-colors overflow-hidden cursor-pointer" />
              </Link>
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-full bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  Sign in
                </button>
              </Link>
            </Show>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto relative"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
        >
          {/* Dot-grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "#0d1209",
              backgroundImage:
                "radial-gradient(circle, rgba(206,255,0,0.13) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          {/* ── Home */}
          {activeSection === "home" && (
            <div className="relative z-10 pb-44">
              <div className="text-center pt-12 pb-8 px-6">
                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-none"
                >
                  Turn any product
                  <br />
                  into a video ad
                </motion.h1>
              </div>

              {/* Result */}
              <ResultBanner generation={activeGeneration ?? undefined} />

              {/* Filter tabs */}
              <div className="flex items-center gap-2 px-6 mb-5 flex-wrap">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      filter === f.value
                        ? "bg-white/12 text-white border border-white/20"
                        : "text-white/50 hover:text-white border border-transparent"
                    }`}
                  >
                    {f.value === "tiktok" && (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z" />
                      </svg>
                    )}
                    {f.label}
                    {f.isNew && (
                      <span className="text-[8px] font-black bg-primary text-black px-1 py-0.5 rounded uppercase">
                        NEW
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Template grid */}
              <div className="px-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredTemplates.map(([key, c]) => (
                    <TemplateCard
                      key={key}
                      id={key}
                      cfg={c}
                      isSelected={template === key}
                      onTry={applyTemplate}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* ── All generations */}
          {activeSection === "all-generations" && (
            <div className="relative z-10">
              <AllGenerationsView
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onRerun={handleRerun}
              />
            </div>
          )}

          {/* ── Favorites */}
          {activeSection === "favorites" && (
            <div className="relative z-10">
              <FavoritesView
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onRerun={handleRerun}
              />
            </div>
          )}

          {/* ── Avatars */}
          {activeSection === "avatars" && (
            <AvatarsSection
              onSelect={(av) => {
                setAvatarUrl(av.photoUrl);
                setActiveSection("home");
              }}
            />
          )}

          {/* ── Ad Reference */}
          {activeSection === "ad-reference" && (
            <div className="relative z-10 flex justify-center">
              <AdReferenceSection onGenerate={handleAdReferenceFill} />
            </div>
          )}
        </div>

        {/* ── Sticky generation bar */}
        <div
          className="absolute bottom-0 left-[220px] right-0 z-20"
          style={{
            background: "linear-gradient(to top, #0d1209 60%, transparent)",
          }}
        >
          <div className="mx-6 mb-5">
            <div className="bg-[#111411]/95 border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden">
              {/* Product name row */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/25 shrink-0 w-14">
                  {sourceType === "app" ? "App" : "Product"}
                </span>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder={
                    sourceType === "app" ? "App name…" : "Product name…"
                  }
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none py-1.5 border-b border-white/[0.06] focus:border-primary/40 transition-colors"
                />
              </div>

              {/* Main prompt row */}
              <div className="flex items-stretch">
                {/* Source type */}
                <div className="flex flex-col border-r border-white/[0.08] px-1 py-1 gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSourceType("product")}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold transition-colors min-w-[54px] ${
                      sourceType === "product"
                        ? "bg-white/10 text-white"
                        : "text-white/40 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType("app")}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold transition-colors min-w-[54px] ${
                      sourceType === "app"
                        ? "bg-white/10 text-white"
                        : "text-white/40 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    App
                  </button>
                </div>

                {/* Prompt textarea */}
                <div className="flex-1 min-w-0 flex items-center px-4">
                  <Plus className="w-4 h-4 text-white/30 shrink-0 mr-2" />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what happens in the ad…"
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none resize-none leading-relaxed py-3"
                    style={{ minHeight: 0 }}
                    onInput={(e) => {
                      const t = e.currentTarget;
                      t.style.height = "auto";
                      t.style.height = Math.min(t.scrollHeight, 80) + "px";
                    }}
                  />
                </div>

                {/* Product / Avatar / Generate */}
                <div className="flex items-center gap-2 pr-3 pl-2 shrink-0">
                  {/* Product image */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => productInputRef.current?.click()}
                      disabled={uploading}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors overflow-hidden ${
                        imageUrl
                          ? "border-primary/50"
                          : cfg.needsImage
                          ? "border-amber-400/40 text-amber-400/60 hover:border-amber-400/70"
                          : "border-white/15 text-white/40 hover:border-white/30 hover:text-white"
                      }`}
                      title={imageUrl ? "Change product photo" : "Upload product photo"}
                    >
                      {uploading ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : imageUrl ? (
                        <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-[9px] text-white/30 font-bold uppercase tracking-wide">
                      PRODUCT
                    </span>
                  </div>

                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors overflow-hidden ${
                        avatarUrl
                          ? "border-primary/50"
                          : "border-white/15 text-white/40 hover:border-white/30 hover:text-white"
                      }`}
                      title={avatarUrl ? "Change avatar" : "Upload UGC avatar"}
                    >
                      {avatarUploading ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-[9px] text-white/30 font-bold uppercase tracking-wide">
                      AVATAR
                    </span>
                  </div>

                  {/* Generate */}
                  <Show when="signed-in">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className={`flex flex-col items-center justify-center gap-0.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all ${
                        canSubmit
                          ? "bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(206,255,0,0.3)]"
                          : "bg-primary/30 text-black/40 cursor-not-allowed"
                      }`}
                    >
                      <span className="text-sm font-black">
                        {createGeneration.isPending ? "…" : "GENERATE"}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold opacity-70">
                        <Zap className="w-2.5 h-2.5" />
                        {effectiveCost > 0 ? (
                          <>
                            <span className="line-through opacity-50">
                              {effectiveCost + 8}
                            </span>{" "}
                            {effectiveCost}
                          </>
                        ) : (
                          "…"
                        )}
                      </span>
                    </button>
                  </Show>
                  <Show when="signed-out">
                    <Link href="/sign-up">
                      <button
                        type="button"
                        className="px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black hover:bg-primary/90 transition-colors"
                      >
                        Sign up
                      </button>
                    </Link>
                  </Show>
                </div>
              </div>

              {/* Creative mode row */}
              <div className="border-t border-white/[0.06]">
                {/* 4-way mode switcher */}
                <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-2 flex-wrap">
                  {(
                    Object.entries(CREATIVE_MODES) as [
                      CreativeMode,
                      (typeof CREATIVE_MODES)[CreativeMode],
                    ][]
                  ).map(([key, m]) => {
                    const isActive = creativeMode === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCreativeMode(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          isActive
                            ? `${m.accentColor} shadow-sm`
                            : "bg-transparent text-white/40 border-white/[0.08] hover:text-white/70 hover:border-white/15"
                        }`}
                      >
                        <m.Icon className="w-3 h-3" />
                        {m.label}
                      </button>
                    );
                  })}

                  {/* Template style pill */}
                  <div className="ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                    <div className={`w-2.5 h-2.5 rounded-sm bg-gradient-to-br ${cfg.iconColor}`} />
                    <span className="text-[10px] text-white/50 font-medium">{cfg.label}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const ids = Object.keys(TEMPLATES) as TemplateId[];
                      setTemplate(ids[Math.floor(Math.random() * ids.length)]);
                    }}
                    title="Random style"
                    className="ml-auto p-1.5 rounded-full text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>

                  {insufficientCredits && (
                    <Link href="/pricing">
                      <span className="text-xs text-red-400 hover:text-red-300 transition-colors">
                        Not enough credits
                      </span>
                    </Link>
                  )}
                  {missingImage && !insufficientCredits && (
                    <span className="text-xs text-amber-400/80">
                      Upload a product photo for UGC mode
                    </span>
                  )}
                  {promptBuilding && (
                    <span className="flex items-center gap-1 text-xs text-white/40">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Building prompt…
                    </span>
                  )}
                </div>

                {/* UGC sub-variant row */}
                <AnimatePresence>
                  {creativeMode === "ugc" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5 px-4 pb-2.5 overflow-hidden flex-wrap"
                    >
                      {(
                        Object.entries(UGC_SUB_VARIANTS) as [
                          UgcSubVariant,
                          (typeof UGC_SUB_VARIANTS)[UgcSubVariant],
                        ][]
                      ).map(([key, v]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setUgcSubVariant(key)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                            ugcSubVariant === key
                              ? "bg-cyan-500/15 text-cyan-300 border-cyan-400/30"
                              : "bg-transparent text-white/30 border-white/[0.06] hover:text-white/50 hover:border-white/15"
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                      <span className="text-[10px] text-white/20 ml-1 italic">
                        {UGC_SUB_VARIANTS[ugcSubVariant].hint}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
