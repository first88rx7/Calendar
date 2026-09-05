export function normalizePhotoPrismUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed.replace(/\/library\/.*$/i, "").replace(/\/$/, "");
  }
}

/** Album / folder UID from a pasted PhotoPrism URL or a raw UID. */
export function extractAlbumUid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const fromPath = trimmed.match(/\/albums\/([a-z0-9]+)(?:\/|$|\?)/i);
  if (fromPath) return fromPath[1];
  const token = trimmed.replace(/^s:/i, "");
  if (/^[a-z][a-z0-9]{14,41}$/i.test(token)) return token;
  return trimmed;
}
