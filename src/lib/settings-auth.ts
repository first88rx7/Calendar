import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "household_settings";

function token() {
  const pin = process.env.SETTINGS_PIN;
  if (!pin) return null;
  return createHmac("sha256", pin).update("household-settings").digest("hex");
}

export async function settingsUnlocked() {
  if (!process.env.SETTINGS_PIN) return true;
  const expected = token();
  if (!expected) return true;
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!value || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function unlockSettings(pin: string) {
  if (!process.env.SETTINGS_PIN) return true;
  const a = Buffer.from(pin);
  const b = Buffer.from(process.env.SETTINGS_PIN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const jar = await cookies();
  jar.set(COOKIE, token()!, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export function assertPin(pinHeader: string | null) {
  if (!process.env.SETTINGS_PIN) return true;
  if (!pinHeader) return false;
  const a = Buffer.from(pinHeader);
  const b = Buffer.from(process.env.SETTINGS_PIN);
  return a.length === b.length && timingSafeEqual(a, b);
}
