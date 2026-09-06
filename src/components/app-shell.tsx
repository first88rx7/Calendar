"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Camera,
  CheckSquare,
  CloudSun,
  LayoutDashboard,
  Menu,
  Moon,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Wifi,
  X,
} from "lucide-react";
import { IdleDim, useIdleDim } from "@/components/idle-dim";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/lib/types";

const SIDEBAR_KEY = "household.sidebar";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/weather", label: "Weather", icon: CloudSun },
  { href: "/chores", label: "Chores", icon: CheckSquare },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/photos", label: "Photos", icon: Camera },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/mealie");
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [status, setStatus] = useState<SyncStatus[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_KEY);
    if (stored === "expanded") setCollapsed(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setStatus(data.status);
        }
      } catch {
        /* keep chrome even if status fails */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const lastSync = status
    .map((item) => item.lastSuccessAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const connected = status.some((item) => item.mode === "live" && !item.lastError) || status.length > 0;

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  };

  if (hideChrome) {
    return <IdleDim>{children}</IdleDim>;
  }

  return (
    <IdleDim>
      <div className="flex h-full overflow-hidden">
        <aside
          className={cn(
            "glass sticky top-0 hidden h-[100dvh] shrink-0 flex-col rounded-none border-y-0 border-l-0 transition-[width] duration-200 lg:flex",
            collapsed ? "w-[4.75rem]" : "w-[16.5rem]",
          )}
        >
          <div className={cn("flex px-2 pt-3", collapsed ? "justify-center" : "justify-end px-3")}>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </button>
          </div>
          <SidebarNav pathname={pathname} collapsed={collapsed} />
          <SidebarFooter connected={connected} lastSync={lastSync} collapsed={collapsed} />
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="glass absolute inset-y-0 left-0 flex w-72 flex-col rounded-none border-y-0 border-l-0">
              <div className="flex items-center justify-end px-3 py-3">
                <button type="button" className="rounded-xl p-2" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="size-5" />
                </button>
              </div>
              <SidebarNav pathname={pathname} collapsed={false} />
              <SidebarFooter connected={connected} lastSync={lastSync} collapsed={false} />
            </aside>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-3 p-3 lg:hidden">
            <button
              type="button"
              className="glass flex size-12 items-center justify-center rounded-2xl"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
          <main className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</main>
        </div>
      </div>
    </IdleDim>
  );
}

function SidebarNav({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  return (
    <nav className={cn("flex flex-1 flex-col gap-1", collapsed ? "px-2" : "px-3")}>
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            title={link.label}
            className={cn(
              "flex min-h-12 items-center rounded-xl text-base",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className={collapsed ? "sr-only" : undefined}>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  connected,
  lastSync,
  collapsed,
}: {
  connected: boolean;
  lastSync?: string | null;
  collapsed: boolean;
}) {
  const { dimNow } = useIdleDim();
  const time = lastSync
    ? new Date(lastSync).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "—";

  return (
    <div className={cn("space-y-2 py-4 text-sm text-white/70", collapsed ? "px-2" : "px-4")}>
      <button
        type="button"
        onClick={dimNow}
        title="Dim the wall"
        className={cn(
          "flex min-h-11 w-full items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white",
          collapsed ? "justify-center" : "gap-2 px-2",
        )}
      >
        <Moon className="size-4 shrink-0" />
        {!collapsed && <span>Dim now</span>}
      </button>
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2")}>
        <Wifi className={cn("size-4", connected ? "text-emerald-400" : "text-amber-400")} />
        {!collapsed && (
          <p>
            Server: {connected ? "Connected" : "Waiting"}
          </p>
        )}
        <span className={cn("size-2 rounded-full", connected ? "bg-emerald-400" : "bg-amber-400")} />
      </div>
      {!collapsed && <p>Last sync: {time}</p>}
    </div>
  );
}
