import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Show } from "@clerk/react";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Palette,
  Cpu,
  Key,
  Search,
  ShieldAlert,
  Loader2,
  LogOut,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/toaster";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const NAV_ITEMS = [
  { href: "/admin/branding", label: "Site Branding", icon: Palette },
  { href: "/admin/providers/platform", label: "Platform Providers", icon: Cpu },
  { href: "/admin/providers/byok", label: "BYOK Providers", icon: Key },
] as const;

// ── Sidebar ────────────────────────────────────────────────────────────────────

function AdminSidebar() {
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { data: me } = useGetMe();
  const { user } = useUser();
  const { signOut } = useClerk();
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = q ? NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q)) : NAV_ITEMS;

  function isActive(href: string) {
    return location === href || location.startsWith(href + "/");
  }

  return (
    <aside className="w-[220px] shrink-0 border-r border-white/[0.06] bg-[#0c0c0c] flex flex-col h-full overflow-hidden">
      {/* Workspace header */}
      <div className="shrink-0 border-b border-white/[0.06] px-3 py-3 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0 text-black font-black text-sm">
          H
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate leading-tight">Higgsfield</p>
          <p className="text-white/40 text-[10px] leading-tight">Admin Panel</p>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-2 py-2 border-b border-white/[0.04]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder="Search settings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 h-7 text-xs bg-white/[0.04] border-white/[0.06] text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:border-white/20"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-mono bg-white/5 px-1 rounded pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {filtered.length === 0 && (
          <p className="text-xs text-white/25 text-center py-6">No results</p>
        )}
        <div className="space-y-0.5">
          {filtered.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/[0.05]",
              )}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{label}</span>
              {isActive(href) && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-colors group"
        >
          <div className="w-6 h-6 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.primaryEmailAddress?.emailAddress?.[0] ?? "A").toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-white truncate leading-tight">
              {user?.fullName ?? "Admin Owner"}
            </p>
            <p className="text-[10px] text-white/40 truncate leading-tight">
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </p>
          </div>
          {userMenuOpen ? (
            <ChevronUp className="w-3 h-3 text-white/30 shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-white/30 shrink-0" />
          )}
        </button>

        {userMenuOpen && (
          <div className="mt-1 space-y-0.5">
            <Link
              href={`${basePath}/`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" /> Back to app
            </Link>
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-3 h-3 shrink-0" /> Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Forbidden ─────────────────────────────────────────────────────────────────

function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-24 h-full">
      <ShieldAlert className="w-10 h-10 text-white/30" />
      <h1 className="text-2xl font-black text-white">Owner access required</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        This page is only available to the site owner.
      </p>
      <Link href={`${basePath}/`}>
        <Button variant="ghost" className="text-white/70 hover:text-white mt-2">
          Back home
        </Button>
      </Link>
    </div>
  );
}

// ── Shell export ──────────────────────────────────────────────────────────────

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe();

  return (
    <div className="h-[100dvh] flex bg-[#0a0a0a] text-white overflow-hidden">
      <Show when="signed-out">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <ShieldAlert className="w-10 h-10 text-white/30" />
          <h1 className="text-3xl font-black text-white">Sign in to continue</h1>
          <Link href="/sign-in">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90 mt-2">
              Log in
            </Button>
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : me?.isOwner ? (
          <>
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </>
        ) : (
          <div className="flex-1">
            <Forbidden />
          </div>
        )}
      </Show>

      <Toaster />
    </div>
  );
}
