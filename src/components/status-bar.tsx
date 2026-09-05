"use client";

import { formatDistanceToNow } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncStatus } from "@/lib/types";

export function StatusBar({
  status,
  onRefresh,
  refreshing,
}: {
  status: SyncStatus[];
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {status.map((item) => (
        <span
          key={item.source}
          className="rounded-full bg-secondary px-3 py-1 capitalize"
          title={item.lastError || undefined}
        >
          {item.source}
          {item.lastError ? (
            <span className="text-destructive"> · issue</span>
          ) : (
            <>
              {" "}
              · {item.mode === "mock" ? "demo" : item.lastSuccessAt ? ago(item.lastSuccessAt) : "pending"}
            </>
          )}
        </span>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto h-10 px-3"
        onClick={onRefresh}
        disabled={refreshing}
      >
        <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        Sync
      </Button>
    </div>
  );
}

function ago(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "just now";
  }
}
