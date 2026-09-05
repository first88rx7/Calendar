"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import type { SlideshowPayload } from "@/lib/types";

export function PhotosClient() {
  const [data, setData] = useState<SlideshowPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/photos/slideshow", { cache: "no-store" });
        const payload = (await response.json()) as SlideshowPayload;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setError("Could not load the photo list.");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <GlassCard className="max-w-lg p-8 text-center">
          <h1 className="text-3xl font-semibold">Photos</h1>
          <p className="mt-3 text-white/70">{error}</p>
        </GlassCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-white/70">Loading photos…</div>
    );
  }

  if (!data.configured) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <GlassCard className="max-w-lg p-8 text-center">
          <h1 className="text-3xl font-semibold">Photos</h1>
          <p className="mt-3 text-white/70">
            The wall is using the scenic wallpaper. Add your PhotoPrism URL in Settings and the
            background will start cycling random photos from the library.
          </p>
          <div className="mt-6">
            <Link href="/settings">
              <Button className="h-12 text-base">Open settings</Button>
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (data.error && data.photos.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <GlassCard className="max-w-lg p-8 text-center">
          <h1 className="text-3xl font-semibold">Photos</h1>
          <p className="mt-3 text-white/70">{data.error}</p>
          <p className="mt-2 text-white/55">
            Check the PhotoPrism URL and password. Until it answers, the scenic wallpaper stays up.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 pb-10">
      <header>
        <p className="text-sm uppercase tracking-[0.2em] text-white/55">PhotoPrism</p>
        <h1 className="text-3xl font-semibold">On the wall</h1>
        <p className="mt-2 max-w-2xl text-white/70">
          These photos are already cycling behind the dashboard, about every {data.rotateSec} seconds.
          Sleep dims the cards so the frame can take over.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.photos.slice(0, 12).map((photo) => (
          <figure key={photo.hash} className="glass overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.thumbSrc} alt={photo.title || "Family photo"} className="aspect-square w-full object-cover" />
          </figure>
        ))}
      </div>
    </div>
  );
}
