import { Suspense } from "react";
import { SettingsClient } from "@/components/settings-client";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading settings…
        </div>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}
