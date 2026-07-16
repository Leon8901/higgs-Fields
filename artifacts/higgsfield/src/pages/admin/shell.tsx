import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Show } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Palette,
  Cpu,
  Key,
  ChevronLeft,
  ChevronRight,
  Settings,
  ShieldAlert,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";

const NAV_ITEMS = [
  { href: "/admin/branding", label: "Site Branding", icon: Palette },
  { href: "/admin/providers/platform", label: "Platform Providers", icon: Cpu },
  { href: "/admin/providers/byok", label: "BYOK Providers", icon: Key },
] as const;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-24 h-full">
      <ShieldAlert className="w-10 h-10 text-white/30" />
      <h1 className="text-2xl font-black text-white">Owner access required</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        This page is only available to the site owner.
      </p>
      <Link href="/">
        <Button variant="ghost" className="text-white/70 hover:text-white mt-2">
          Back home
        </Button>
      </Link>
    </div>
  );
}

function AdminTopBar() {
  return (
    <header className="shrink-0 h-12 border-b border-white/[0.06] bg-[#0a0a0a] flex items-center px-4 gap-4">
      {/* Back to app — use href directly instead of nested <a> */}
      <Link
        href={`${basePath}/`}
        className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-xs font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to app
      </Link>
      <div className="h-4 w-px bg-white/[0.08]" />
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Settings className="w-3 h-3 text-black" />
        </div>
        <span className="text-xs font-bold text-white/60">Admin Panel</span>
      </div>
    </header>
  );
}

function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-white/[0.06] bg-[#0c0c0c] transition-all duration-200 flex flex-col overflow-hidden",
        collapsed ? "w-14" : "w-[220px]",
      )}
    >
      {/* Collapse toggle */}
      <div
        className={cn(
          "flex items-center px-3 py-3 border-b border-white/[0.06]",
          collapsed && "justify-center",
        )}
      >
        {!collapsed && (
          <span className="flex-1 text-xs font-bold text-white/30 uppercase tracking-widest">
            Navigation
          </span>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Navigation — Link renders as <a>, no inner <a> needed */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? label : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe();

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      <AdminTopBar />

      <Show when="signed-out">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
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
          <div className="flex flex-1 min-h-0">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
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
