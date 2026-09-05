import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Household",
    short_name: "Household",
    description: "Family wall calendar, meals, and weather.",
    start_url: "/",
    display: "standalone",
    background_color: "#2a241c",
    theme_color: "#2a241c",
  };
}
