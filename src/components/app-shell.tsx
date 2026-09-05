"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Settings, UtensilsCrossed } from "lucide-react";
import { IdleDim } from "@/components/idle-dim";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Calendar", icon: CalendarDays },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/mealie");

  return (
    <IdleDim>
      <div className="flex min-h-[100dvh] flex-col">
        <main className={cn("flex min-h-0 flex-1 flex-col", hideChrome && "pb-0")}>
          {children}
        </main>
        {!hideChrome && (
          <nav className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-md">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-6" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </IdleDim>
  );
}
