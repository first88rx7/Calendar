"use client";

import { contrastText } from "@/lib/color";
import { hotLunchColor, hotLunchWanted } from "@/lib/hot-lunch-marks";
import { cn } from "@/lib/utils";
import type { HotLunchMark, Person } from "@/lib/types";

export function HotLunchToggles({
  date,
  initials,
  marks,
  people,
  compact = false,
  onToggle,
}: {
  date: string;
  initials: string[];
  marks: HotLunchMark[];
  people: Person[];
  compact?: boolean;
  onToggle: (date: string, initial: string, wanted: boolean) => void;
}) {
  return (
    <div className={cn("flex items-center gap-1", compact ? "justify-center" : "flex-wrap")}>
      {initials.map((initial, index) => {
        const on = hotLunchWanted(marks, date, initial);
        const color = hotLunchColor(initial, people, index);
        return (
          <button
            key={initial}
            type="button"
            aria-pressed={on}
            aria-label={`${initial} wants hot lunch on ${date}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(date, initial, !on);
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-lg border-2 font-bold leading-none",
              compact ? "size-9 text-base" : "h-12 min-w-12 px-3 text-lg",
            )}
            style={
              on
                ? { backgroundColor: color, borderColor: color, color: contrastText(color) }
                : { backgroundColor: "transparent", borderColor: `${color}99`, color }
            }
          >
            {initial}
          </button>
        );
      })}
    </div>
  );
}
