"use client";

import { useEffect, useState } from "react";
import { formatClock, formatLongDate } from "@/lib/time";

export function WallClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div>
      <p className="text-4xl font-semibold tracking-tight md:text-5xl">{formatClock(timeZone, now)}</p>
      <p className="mt-1 text-base text-muted-foreground">{formatLongDate(timeZone, now)}</p>
    </div>
  );
}
