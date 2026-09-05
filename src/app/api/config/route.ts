import { NextRequest, NextResponse } from "next/server";
import { getPublicConfig, readConfig, writeConfig } from "@/lib/config";
import { extractAlbumUid, normalizePhotoPrismUrl } from "@/lib/photoprism-url";
import { settingsUnlocked } from "@/lib/settings-auth";
import type { AppConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unlocked = await settingsUnlocked();
  return NextResponse.json({
    ...getPublicConfig(),
    settingsUnlocked: unlocked,
  });
}

export async function PUT(request: NextRequest) {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  const patch = (await request.json()) as Partial<AppConfig> & {
    photoPrism?: Partial<AppConfig["photoPrism"]> & { password?: string };
  };
  const current = readConfig();
  const incomingPassword = patch.photoPrism?.password?.trim();
  const next: AppConfig = {
    ...current,
    ...patch,
    people: (patch.people ?? current.people).map((person) => ({
      ...person,
      calendarId: person.calendarId.startsWith("mock:") ? "" : person.calendarId,
    })),
    weather: { ...current.weather, ...(patch.weather || {}) },
    mealie: { ...current.mealie, ...(patch.mealie || {}) },
    photoPrism: {
      ...current.photoPrism,
      ...(patch.photoPrism || {}),
      password: incomingPassword ? incomingPassword : current.photoPrism.password,
    },
  };
  if (patch.idleTimeoutMs !== undefined) {
    next.idleTimeoutMs = Math.max(0, Number(patch.idleTimeoutMs) || 0);
  }
  if (patch.sleepDimPercent !== undefined) {
    next.sleepDimPercent = Math.min(95, Math.max(40, Number(patch.sleepDimPercent) || 78));
  }
  if (patch.photoRotateSec !== undefined) {
    next.photoRotateSec = Math.min(600, Math.max(10, Number(patch.photoRotateSec) || 45));
  }
  next.photoPrism.url = normalizePhotoPrismUrl(next.photoPrism.url);
  next.photoPrism.albumUid = extractAlbumUid(next.photoPrism.albumUid);
  writeConfig(next);
  const { invalidatePhotoCache } = await import("@/lib/photoprism");
  invalidatePhotoCache();
  if (patch.weather) {
    try {
      const { syncWeather } = await import("@/lib/weather");
      await syncWeather(next.weather);
    } catch (error) {
      console.error("Weather refresh after settings save failed", error);
    }
  }
  return NextResponse.json({ ...getPublicConfig(), settingsUnlocked: true });
}
