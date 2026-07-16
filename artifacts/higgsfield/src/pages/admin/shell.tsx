import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Palette, Server, Key, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/branding", label: "Site Branding", icon: Palette },
  { href: "/admin/providers/platform", label: "Platform Providers", icon: Server },
  { href: "/admin/providers/byok", label: "BYOK Providers", icon: Key },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-[#0d0d0d] border-r border-white/[0.06] transition-all duration-200 shrink-0",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/[0.06]">
          {!collapsed && (
            <span className="font-black text-white text-sm tracking-tight truncate">Admin Panel</span>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors select-none",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-white/45 hover:text-white/80 hover:bg-white/[0.05] font-medium",
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-white/[0.06] space-y-0.5">
          <Link href="/">
            <div
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/35 hover:text-white/60 hover:bg-white/[0.05] cursor-pointer transition-colors",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? "Back to app" : undefined}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Back to app</span>}
            </div>
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/35 hover:text-white/60 hover:bg-white/[0.05] w-full transition-colors",
              collapsed && "justify-center px-2",
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-auto">{children}</div>
    </div>
  );
}
