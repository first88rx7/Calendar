import { Suspense } from "react";
import { RecipesClient } from "@/components/recipes-client";

export default function RecipesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading recipes…
        </div>
      }
    >
      <RecipesClient />
    </Suspense>
  );
}
