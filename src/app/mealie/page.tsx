"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { PublicConfig } from "@/lib/types";

export default function MealieFramePage() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  useEffect(() => {
    void fetch("/api/config", { cache: "no-store" })
      .then((res) => res.json())
      .then(setConfig);
  }, []);

  const url = config?.mealieOpenUrl;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-background px-3 py-2">
        <Link href="/" className={buttonVariants({ variant: "secondary", className: "h-11" })}>
          <ArrowLeft className="size-4" />
          Back to household
        </Link>
        <p className="text-sm text-muted-foreground">Mealie</p>
      </div>
      {!url ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
          Set MEALIE_URL on the home server to open your recipe app here.
        </div>
      ) : (
        <iframe title="Mealie" src={url} className="min-h-0 flex-1 border-0 bg-white" />
      )}
    </div>
  );
}
