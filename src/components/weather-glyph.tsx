import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import { weatherIconName } from "@/lib/weather-copy";
import { cn } from "@/lib/utils";

export function WeatherGlyph({
  code,
  className,
}: {
  code: number;
  className?: string;
}) {
  const name = weatherIconName(code);
  const iconClass = cn("size-6", className);
  if (name === "sun") return <Sun className={iconClass} />;
  if (name === "sun-cloud") return <CloudSun className={iconClass} />;
  if (name === "fog") return <CloudFog className={iconClass} />;
  if (name === "snow") return <CloudSnow className={iconClass} />;
  if (name === "storm") return <CloudLightning className={iconClass} />;
  if (name === "rain") return <CloudRain className={iconClass} />;
  return <Cloud className={iconClass} />;
}
