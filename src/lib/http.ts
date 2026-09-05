import type { NextRequest } from "next/server";

function hostLooksPublic(host: string) {
  const name = host.toLowerCase().split(":")[0];
  return Boolean(name) && name !== "0.0.0.0" && name !== "[::]" && name !== "::";
}

export function browserOrigin(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = (forwarded || request.headers.get("host") || "").trim();
  const proto =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "") ||
    "http";
  if (hostLooksPublic(host)) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  const origin = request.nextUrl.origin.replace(/\/$/, "");
  if (hostLooksPublic(origin.replace(/^https?:\/\//, ""))) {
    return origin;
  }
  return (process.env.APP_URL || "http://127.0.0.1:3847").replace(/\/$/, "");
}
