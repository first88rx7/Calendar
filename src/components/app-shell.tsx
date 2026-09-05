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
  NotebookPen,
  Settings,
  Wifi,
  X,
} from "lucide-react";
import { IdleDim } from "@/components/idle-dim";
import { cn } from "@/lib/utils";
import type { PublicConfig, SyncStatus } from "@/lib/types";

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
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [status, setStatus] = useState<SyncStatus[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setConfig(data.config);
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
  const homeName = config?.homeName || "Riverside Home";
  const mark = homeName.trim().charAt(0).toUpperCase() || "H";

  if (hideChrome) {
    return <IdleDim>{children}</IdleDim>;
  }

  return (
    <IdleDim>
      <div className="flex min-h-[100dvh]">
        <aside className="glass sticky top-0 hidden h-[100dvh] w-[17rem] shrink-0 flex-col rounded-none border-y-0 border-l-0 lg:flex">
          <SidebarBrand mark={mark} homeName={homeName} />
          <SidebarNav pathname={pathname} />
          <SidebarStatus connected={connected} lastSync={lastSync} />
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="glass absolute inset-y-0 left-0 flex w-72 flex-col rounded-none border-y-0 border-l-0">
              <div className="flex items-center justify-between px-4 py-4">
                <SidebarBrand mark={mark} homeName={homeName} />
                <button type="button" className="rounded-xl p-2" onClick={() => setOpen(false)}>
                  <X className="size-5" />
                </button>
              </div>
              <SidebarNav pathname={pathname} />
              <SidebarStatus connected={connected} lastSync={lastSync} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 p-3 lg:hidden">
            <button
              type="button"
              className="glass flex size-12 items-center justify-center rounded-2xl"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <p className="text-lg font-semibold">{homeName}</p>
          </div>
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </IdleDim>
  );
}

function SidebarBrand({ mark, homeName }: { mark: string; homeName: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-6">
      <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-lg font-semibold">
        {mark}
      </span>
      <span className="text-lg font-semibold tracking-tight">{homeName}</span>
    </div>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
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
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base",
              active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="size-5" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarStatus({
  connected,
  lastSync,
}: {
  connected: boolean;
  lastSync?: string | null;
}) {
  const time = lastSync
    ? new Date(lastSync).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "—";
  return (
    <div className="space-y-1 px-5 py-5 text-sm text-white/70">
      <p className="flex items-center gap-2">
        <Wifi className="size-4 text-emerald-400" />
        Server: {connected ? "Connected" : "Waiting"}
        <span className={cn("size-2 rounded-full", connected ? "bg-emerald-400" : "bg-amber-400")} />
      </p>
      <p>Last sync: {time}</p>
    </div>
  );
}
