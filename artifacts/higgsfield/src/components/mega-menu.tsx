import { useRef, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useListModels } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Sparkles, User, Palette, ShoppingBag, Zap,
  Film, Clapperboard, Rabbit, GraduationCap,
  Mic, Volume2, Music2,
} from "lucide-react";

type Category = "image" | "video" | "audio";

interface MegaMenuProps {
  category: Category;
  label: string;
  active: boolean;
}

function BadgePill({ badge }: { badge: string }) {
  const colors: Record<string, string> = {
    NEW: "bg-[#CEFF00] text-black",
    TRENDING: "bg-orange-500 text-white",
    HOT: "bg-red-500 text-white",
    TOP: "bg-blue-500 text-white",
  };
  return (
    <span
      className={cn(
        "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0",
        colors[badge] ?? "bg-white/20 text-white",
      )}
    >
      {badge}
    </span>
  );
}

function ModelIcon({ thumbnailUrl, name }: { thumbnailUrl?: string | null; name: string }) {
  if (thumbnailUrl) {
    return (
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/10">
        <img src={thumbnailUrl} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg shrink-0 bg-white/10 border border-white/10 flex items-center justify-center text-white/40">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 9h6M9 12h6M9 15h4" />
      </svg>
    </div>
  );
}

function ModelsColumn({ category, onSelect }: { category: Category; onSelect: () => void }) {
  const [, navigate] = useLocation();
  const { data: models, isLoading } = useListModels({ category });

  const catPath = `/${category}`;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 rounded-lg bg-white/5 shrink-0 animate-pulse" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-white/5 rounded animate-pulse w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!models || models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
        <Sparkles className="w-6 h-6 text-white/20" />
        <p className="text-sm text-white/40 font-medium">Coming soon</p>
        <p className="text-xs text-white/25">Models for this category are on the way.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-2 max-h-[440px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {models.map((model) => (
        <button
          key={model.modelId}
          onClick={() => { navigate(`${catPath}?model=${model.modelId}`); onSelect(); }}
          className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg mx-1 transition-colors text-left group"
        >
          <ModelIcon thumbnailUrl={model.thumbnailUrl} name={model.name} />
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors truncate">
                {model.name}
              </span>
              {model.badge && <BadgePill badge={model.badge} />}
            </div>
            <span className="text-xs text-white/45 leading-snug line-clamp-1">
              {model.description}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function FeaturesColumn({ category, onSelect }: { category: Category; onSelect: () => void }) {
  const [, navigate] = useLocation();

  const featuresByCategory: Record<
    Category,
    { icon: React.ReactNode; label: string; description: string; path: string }[]
  > = {
    image: [
      {
        icon: <User className="w-4 h-4" />,
        label: "Portrait Edit",
        description: "Relight and retouch faces",
        path: "/image?model=nano-banana-pro-edit",
      },
      {
        icon: <Palette className="w-4 h-4" />,
        label: "Concept Art",
        description: "High-fidelity creative renders",
        path: "/image?model=seedream-v5-pro",
      },
      {
        icon: <ShoppingBag className="w-4 h-4" />,
        label: "Product Shots",
        description: "Studio-quality product photos",
        path: "/image?model=nano-banana-pro-ultra",
      },
      {
        icon: <Zap className="w-4 h-4" />,
        label: "Quick Draft",
        description: "Fast, low-cost concept images",
        path: "/image?model=nano-banana-2",
      },
    ],
    video: [
      {
        icon: <Film className="w-4 h-4" />,
        label: "Cinematic Video",
        description: "Hollywood-grade motion generation",
        path: "/video?model=seedance-2-0",
      },
      {
        icon: <Clapperboard className="w-4 h-4" />,
        label: "AI Film",
        description: "Long-form narrative clips",
        path: "/video?model=sora-2",
      },
      {
        icon: <Rabbit className="w-4 h-4" />,
        label: "Fast Clip",
        description: "Quick social-ready cuts",
        path: "/video?model=seedance-2-0-fast",
      },
      {
        icon: <GraduationCap className="w-4 h-4" />,
        label: "Explainer Shorts",
        description: "Captioned educational videos",
        path: "/shorts",
      },
    ],
    audio: [
      {
        icon: <Mic className="w-4 h-4" />,
        label: "Voice Synthesis",
        description: "Realistic narration & dialogue",
        path: "/audio?model=seed-audio-1-0",
      },
      {
        icon: <Volume2 className="w-4 h-4" />,
        label: "Text to Speech",
        description: "Multi-voice TTS with emotion",
        path: "/audio?model=elevenlabs-tts",
      },
      {
        icon: <Music2 className="w-4 h-4" />,
        label: "Sound Design",
        description: "Ambient & foley audio tracks",
        path: "/audio",
      },
    ],
  };

  const features = featuresByCategory[category];

  return (
    <div className="flex flex-col py-2">
      {features.map((f, i) => (
        <button
          key={i}
          onClick={() => { navigate(f.path); onSelect(); }}
          className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg mx-1 transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/50 group-hover:text-white/80 group-hover:bg-white/10 shrink-0 transition-colors">
            {f.icon}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">{f.label}</span>
            <span className="text-xs text-white/40 leading-snug">{f.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function MegaMenuTrigger({ category, label, active }: MegaMenuProps) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setOpen(false);
  }, []);

  const scheduleOpen = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    hoverTimerRef.current = setTimeout(openMenu, 150);
  }, [openMenu]);

  const scheduleClose = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    closeTimerRef.current = setTimeout(closeMenu, 200);
  }, [closeMenu]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closeMenu]);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeMenu]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          closeMenu();
          navigate(`/${category}`);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            closeMenu();
            navigate(`/${category}`);
          }
        }}
        className={cn(
          "px-4 py-2 rounded-md text-sm font-medium transition-colors",
          active || open
            ? "bg-white/10 text-white"
            : "text-muted-foreground hover:text-white hover:bg-white/5",
        )}
      >
        {label}
      </button>

      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          {/* Arrow */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a1a] border-t border-l border-white/10 rotate-45 z-10" />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
            style={{ width: 560 }}
          >
            <div className="flex">
              {/* Left — Features */}
              <div className="w-[220px] border-r border-white/8 shrink-0">
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">
                    Features
                  </span>
                </div>
                <FeaturesColumn category={category} onSelect={closeMenu} />
              </div>
              {/* Right — Models */}
              <div className="flex-1 min-w-0">
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">
                    Models
                  </span>
                </div>
                <ModelsColumn category={category} onSelect={closeMenu} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
