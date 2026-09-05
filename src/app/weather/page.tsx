"use client";

import { GlassCard } from "@/components/glass-card";
import { WeatherPanel } from "@/components/weather-panel";
import { useDashboardData } from "@/hooks/use-dashboard-data";

export default function WeatherPage() {
  const { data, error, load, start, refreshing } = useDashboardData();

  if (error && !data) return <p className="p-8 text-white/70">{error}</p>;
  if (!data) return <p className="p-8 text-white/70">Loading weather…</p>;

  return (
    <div className="flex min-h-0 flex-1 p-4 lg:p-6">
      <GlassCard className="mx-auto w-full max-w-xl">
        <WeatherPanel
          weather={data.weather}
          locationLabel={data.config.weather.locationLabel}
          onRefresh={() => void load(start, true)}
          refreshing={refreshing}
        />
      </GlassCard>
    </div>
  );
}
