import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { X, Menu, Zap, LibraryBig, User, LogOut, Key } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Show, useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { MegaMenuTrigger } from "@/components/mega-menu";
import { useSiteSettings } from "@/lib/settings";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function CreditsBadge() {
  const { data: me } = useGetMe();
  if (!me) return null;
  return (
    <Link
      href="/account"
      className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
    >
      <Zap className="w-3.5 h-3.5" />
      {me.creditsBalance}
    </Link>
  );
}

function AuthArea({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();

  if (mobile) {
    return (
      <>
        <Show when="signed-out">
          <Link href="/sign-in" onClick={onNavigate}>
            <Button variant="ghost" className="justify-start text-muted-foreground hover:text-white w-full">
              Log in
            </Button>
          </Link>
          <Link href="/sign-up" onClick={onNavigate}>
            <Button variant="lime" className="justify-start mt-2 w-full">
              Sign up
            </Button>
          </Link>
        </Show>
        <Show when="signed-in">
          <Link href="/library" onClick={onNavigate}>
            <Button variant="ghost" className="justify-start text-muted-foreground hover:text-white w-full">
              Library
            </Button>
          </Link>
          <Link href="/account" onClick={onNavigate}>
            <Button variant="ghost" className="justify-start text-muted-foreground hover:text-white w-full">
              Account
            </Button>
          </Link>
          <Link href="/api-keys" onClick={onNavigate}>
            <Button variant="ghost" className="justify-start text-muted-foreground hover:text-white w-full">
              API Keys
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="justify-start text-muted-foreground hover:text-white w-full"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
          >
            Log out
          </Button>
        </Show>
      </>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <Link href="/sign-in">
          <Button variant="ghost" className="text-muted-foreground hover:text-white">
            Log in
          </Button>
        </Link>
        <Link href="/sign-up">
          <Button variant="lime">Sign up</Button>
        </Link>
      </Show>
      <Show when="signed-in">
        <CreditsBadge />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white font-bold text-sm hover:border-primary/50 transition-colors overflow-hidden">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (user?.primaryEmailAddress?.emailAddress?.[0] ?? "U").toUpperCase()
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#111111] border-white/10">
            <DropdownMenuLabel className="text-white/50 text-xs truncate">
              {user?.primaryEmailAddress?.emailAddress}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem asChild className="text-white/80 focus:text-white focus:bg-white/10 cursor-pointer">
              <Link href="/library" className="flex items-center gap-2 w-full">
                <LibraryBig className="w-4 h-4" /> Library
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-white/80 focus:text-white focus:bg-white/10 cursor-pointer">
              <Link href="/account" className="flex items-center gap-2 w-full">
                <User className="w-4 h-4" /> Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-white/80 focus:text-white focus:bg-white/10 cursor-pointer">
              <Link href="/api-keys" className="flex items-center gap-2 w-full">
                <Key className="w-4 h-4" /> API Keys
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
            >
              <LogOut className="w-4 h-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Show>
    </>
  );
}

// The dismissible bar shown at the top of every page — content is fully
// admin-editable via Settings > homepage_banner (see admin-settings.tsx),
// never hardcoded here. Renders nothing while the setting is disabled.
export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { homepage_banner: banner } = useSiteSettings();

  if (!banner.enabled || !banner.text || dismissed) return null;

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4 relative flex items-center justify-center font-medium text-sm z-50">
      <div className="flex items-center gap-2">
        <span className="animate-pulse">✦</span>
        <span>{banner.text}</span>
        {banner.linkUrl && banner.linkLabel ? (
          <a
            href={banner.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="underline font-bold ml-2 hover:text-black/70"
          >
            {banner.linkLabel}
          </a>
        ) : null}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Navbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const settings = useSiteSettings();

  const navLinks = [
    { href: "/tools", label: "Explore" },
    { href: "/marketing-studio", label: "Marketing Studio" },
    { href: "/presets", label: "Presets" },
    { href: "/shorts", label: "Shorts" },
    { href: "/apps", label: "App Gallery" },
    { href: "/pricing", label: "Pricing" },
  ];

  const megaMenuCategories: { category: "image" | "video" | "audio"; label: string }[] = [
    { category: "image", label: "Image" },
    { category: "video", label: "Video" },
    { category: "audio", label: "Audio" },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded shadow-[0_0_15px_rgba(206,255,0,0.4)] flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-3 h-3 bg-black rounded-sm" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">{settings.site_name}</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/tools"
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                location === "/tools"
                  ? "bg-white/10 text-white"
                  : "text-muted-foreground hover:text-white hover:bg-white/5",
              )}
            >
              Explore
            </Link>
            {megaMenuCategories.map(({ category, label }) => (
              <MegaMenuTrigger
                key={category}
                category={category}
                label={label}
                active={location === `/${category}`}
              />
            ))}
            {navLinks.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  location === link.href
                    ? "bg-white/10 text-white"
                    : "text-muted-foreground hover:text-white hover:bg-white/5",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <AuthArea />
        </div>

        <button 
          className="md:hidden p-2 text-muted-foreground hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-b border-white/5 bg-background overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-2">
              {[
                { href: "/tools", label: "Explore" },
                { href: "/image", label: "Image" },
                { href: "/video", label: "Video" },
                { href: "/audio", label: "Audio" },
                ...navLinks.slice(1),
              ].map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={cn(
                    "px-4 py-3 rounded-md text-sm font-medium transition-colors",
                    location === link.href 
                      ? "bg-white/10 text-white" 
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-white/5 my-2" />
              <AuthArea mobile onNavigate={closeMobileMenu} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer() {
  const settings = useSiteSettings();
  return (
    <footer className="border-t border-white/5 bg-background pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-primary rounded shadow-[0_0_10px_rgba(206,255,0,0.3)] flex items-center justify-center">
                <div className="w-2 h-2 bg-black rounded-sm" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">{settings.site_name}</span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">{settings.site_tagline}</p>

          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/tools" className="hover:text-primary transition-colors">Explore</Link></li>
              <li><Link href="/image" className="hover:text-primary transition-colors">Image</Link></li>
              <li><Link href="/video" className="hover:text-primary transition-colors">Video</Link></li>
              <li><Link href="/audio" className="hover:text-primary transition-colors">Audio</Link></li>
              <li><Link href="/marketing-studio" className="hover:text-primary transition-colors">Marketing Studio</Link></li>
              <li><Link href="/presets" className="hover:text-primary transition-colors">Presets</Link></li>
              <li><Link href="/shorts" className="hover:text-primary transition-colors">Shorts</Link></li>
              <li><Link href="/apps" className="hover:text-primary transition-colors">App Gallery</Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/tools" className="hover:text-primary transition-colors">Explore Tools</Link></li>
              <li><Link href="/api-keys" className="hover:text-primary transition-colors">API Keys</Link></li>
              <li><Link href="/apps" className="hover:text-primary transition-colors">Community Apps</Link></li>
              <li><Link href="/presets" className="hover:text-primary transition-colors">Presets</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/pricing" className="hover:text-primary transition-colors">About</Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
              <li><a href="mailto:support@higgsfield.ai" className="hover:text-primary transition-colors">Contact</a></li>
              <li><Link href="/sign-up" className="hover:text-primary transition-colors">Get Started</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Higgsfield AI. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-white transition-colors">
              Twitter / X
            </a>
            <a href="https://discord.com/" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-white transition-colors">
              Discord
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// The category studios (/image, /video, /audio) render a fixed-height,
// full-viewport canvas + sticky generation bar (see category-studio.tsx). A
// Footer rendered below them pushes total document height past the viewport,
// producing an unwanted page-level scrollbar under the studio. Keep the
// Navbar/banner (needed for cross-category nav) but skip the Footer there.
const NO_FOOTER_PATHS = ["/image", "/video", "/audio"];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  // Marketing Studio has its own full-screen layout with sidebar — skip global chrome
  if (location.startsWith("/marketing-studio")) {
    return <>{children}</>;
  }
  const hideFooter = NO_FOOTER_PATHS.includes(location);
  return (
    // Studio routes get a viewport-locked shell (fixed height, no page
    // scroll) since the studio manages its own internal scroll regions —
    // this also makes it correctly reflow if the banner above is dismissed,
    // instead of hardcoding an assumed header height. Other routes keep the
    // normal min-height/document-scroll behavior.
    <div className={cn("flex flex-col bg-noise", hideFooter ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]")}>
      <AnnouncementBanner />
      <Navbar />
      <main className={cn("flex-1", hideFooter && "min-h-0 overflow-hidden")}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
