"use client";

/* PhotoPrism hashes change too often for next/image. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import type { SlideshowPayload } from "@/lib/types";

const FALLBACK = "/wallpaper.jpg";

export function PhotoBackdrop() {
  const [urls, setUrls] = useState<string[]>([FALLBACK]);
  const [front, setFront] = useState(0);
  const [layers, setLayers] = useState<[string, string]>([FALLBACK, FALLBACK]);
  const [rotateMs, setRotateMs] = useState(45_000);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/photos/slideshow", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as SlideshowPayload;
        if (cancelled) return;
        if (data.rotateSec) setRotateMs(data.rotateSec * 1000);
        if (data.photos.length > 0) {
          const next = data.photos.map((photo) => photo.src);
          setUrls(next);
          setLayers([next[0], next[0]]);
          setFront(0);
        }
      } catch {
        /* keep the scenic wallpaper */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 12 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (urls.length < 2) return;
    let current = 0;
    let cancelled = false;
    const id = window.setInterval(() => {
      current = (current + 1) % urls.length;
      const url = urls[current];
      setFront((visible) => {
        const incoming = visible === 0 ? 1 : 0;
        setLayers((existing) => {
          const copy: [string, string] = [existing[0], existing[1]];
          copy[incoming] = url;
          return copy;
        });
        const preload = new Image();
        preload.onload = () => {
          if (!cancelled) setFront(incoming);
        };
        preload.onerror = () => {
          if (!cancelled) setFront(incoming);
        };
        preload.src = url;
        return visible;
      });
    }, rotateMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [urls, rotateMs]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden>
      {layers.map((src, layer) => (
        <div
          key={layer}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: front === layer ? 1 : 0 }}
        >
          <img
            src={src}
            alt=""
            className="absolute inset-0 size-full scale-125 object-cover blur-2xl"
          />
          <img
            src={src}
            alt=""
            className="absolute inset-0 size-full object-contain object-center"
            onError={(event) => {
              if (event.currentTarget.src.endsWith(FALLBACK)) return;
              event.currentTarget.src = FALLBACK;
            }}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/28 via-black/40 to-black/58" />
    </div>
  );
}
