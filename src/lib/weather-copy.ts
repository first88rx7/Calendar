export function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Clouds";
}

export function weatherIconName(code: number) {
  if (code === 0 || code === 1) return "sun" as const;
  if (code === 2) return "sun-cloud" as const;
  if (code === 3) return "cloud" as const;
  if (code === 45 || code === 48) return "fog" as const;
  if (code >= 71 && code <= 77) return "snow" as const;
  if (code >= 85 && code <= 86) return "snow" as const;
  if (code >= 95) return "storm" as const;
  if (code >= 51) return "rain" as const;
  return "cloud" as const;
}
