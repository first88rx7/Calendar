export function contrastText(hex: string) {
  const value = hex.replace("#", "");
  if (value.length < 6) return "#1c1917";
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y > 158 ? "#1c1917" : "#fafaf9";
}
