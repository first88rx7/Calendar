export function mediaSrc(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("/") || url.startsWith("data:")) return url;
  return `/api/media?url=${encodeURIComponent(url)}`;
}

export function entryTypeLabel(type: string) {
  const value = type.toLowerCase();
  if (value === "breakfast") return "Breakfast";
  if (value === "lunch") return "Lunch";
  if (value === "dinner") return "Dinner";
  if (value === "side") return "Side";
  return type;
}
