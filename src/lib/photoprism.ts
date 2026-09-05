import { photoPrismSettings } from "@/lib/config";
import { extractAlbumUid, normalizePhotoPrismUrl } from "@/lib/photoprism-url";
import { setSyncState } from "@/lib/sync-state";
import type { SlideshowPhoto } from "@/lib/types";

export { extractAlbumUid, normalizePhotoPrismUrl };

const PHOTO_HASH = /^[a-fA-F0-9]{32,64}$/;
const PREVIEW_SIZES = ["fit_1920", "fit_1280", "fit_2560", "tile_500"] as const;
const PREVIEW_SIZE_SET = new Set<string>(PREVIEW_SIZES);

type SessionCache = {
  token: string;
  previewToken: string;
  expiresAt: number;
};

let sessionCache: SessionCache | null = null;
let listCache: { at: number; photos: SlideshowPhoto[]; error?: string } | null = null;

type PhotoPrismPhoto = {
  Hash?: string;
  hash?: string;
  UID?: string;
  uid?: string;
  Title?: string;
  title?: string;
  Type?: string;
  type?: string;
  Files?: Array<{ Hash?: string; hash?: string; Primary?: boolean; primary?: boolean }>;
};

function isHash(value: string) {
  return PHOTO_HASH.test(value);
}

export function previewSize(value?: string | null) {
  if (value && PREVIEW_SIZE_SET.has(value)) return value;
  return "fit_1920";
}

function resolvedSettings() {
  const settings = photoPrismSettings();
  return {
    ...settings,
    url: normalizePhotoPrismUrl(settings.url),
    albumUid: extractAlbumUid(settings.albumUid),
  };
}

async function readErrorDetail(response: Response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error || data.message || text.slice(0, 180);
  } catch {
    return text.slice(0, 180);
  }
}

async function photoprismFetch(
  path: string,
  init: RequestInit & { token?: string; acceptJson?: boolean } = {},
) {
  const settings = resolvedSettings();
  if (!settings.url) {
    throw new Error("PhotoPrism URL is not set");
  }
  const headers = new Headers(init.headers);
  if (init.acceptJson !== false && !headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
    headers.set("X-Auth-Token", init.token);
  }
  const rest = { ...init };
  delete rest.token;
  delete rest.acceptJson;
  return fetch(`${settings.url}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(12_000),
  });
}

async function createSession() {
  const settings = resolvedSettings();
  if (settings.token) {
    return { token: settings.token, previewToken: "" };
  }
  if (!settings.username || !settings.password) {
    return { token: "", previewToken: "" };
  }
  const response = await photoprismFetch("/api/v1/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: settings.username,
      password: settings.password,
    }),
  });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`PhotoPrism sign-in failed (${response.status}${detail ? `: ${detail}` : ""})`);
  }
  const data = (await response.json()) as {
    id?: string;
    access_token?: string;
    config?: { previewToken?: string; PreviewToken?: string };
  };
  const token = data.access_token || data.id || "";
  if (!token) {
    throw new Error("PhotoPrism did not return a session token");
  }
  return {
    token,
    previewToken: data.config?.previewToken || data.config?.PreviewToken || "",
  };
}

async function getSession(force = false) {
  if (!force && sessionCache && sessionCache.expiresAt > Date.now()) {
    return sessionCache;
  }
  const created = await createSession();
  sessionCache = {
    token: created.token,
    previewToken: created.previewToken,
    expiresAt: Date.now() + 10 * 60 * 60 * 1000,
  };
  return sessionCache;
}

function photoHash(photo: PhotoPrismPhoto) {
  const direct = photo.Hash || photo.hash || "";
  if (direct && isHash(direct)) return direct;
  const files = photo.Files || [];
  const primary = files.find((file) => file.Primary || file.primary) || files[0];
  const fromFile = primary?.Hash || primary?.hash || "";
  return isHash(fromFile) ? fromFile : "";
}

function photoType(photo: PhotoPrismPhoto) {
  return (photo.Type || photo.type || "image").toLowerCase();
}

function photoSearchAttempts() {
  const settings = resolvedSettings();
  const album = settings.albumUid;
  const query = settings.query.trim();
  const attempts: URLSearchParams[] = [];

  const make = (extra: Record<string, string>) => {
    const params = new URLSearchParams({
      count: "80",
      offset: "0",
      order: "random",
      merged: "true",
      ...extra,
    });
    attempts.push(params);
  };

  // Folder albums store a path filter. Extra q=type:image on top of s=<uid>
  // makes PhotoPrism return 400 ("unable to do that" / bad filter).
  if (album && query) {
    make({ s: album, q: query });
    make({ q: `${query} album:${album}` });
  } else if (album) {
    make({ s: album });
    make({ album });
    make({ q: `album:${album}` });
  } else if (query) {
    make({ q: query });
  } else {
    make({});
    make({ q: "type:image" });
  }

  return attempts;
}

async function searchPhotos(session: SessionCache) {
  let lastMessage = "PhotoPrism photos failed";
  for (const params of photoSearchAttempts()) {
    const path = `/api/v1/photos?${params}`;
    let response = await photoprismFetch(path, { token: session.token || undefined });
    if (response.status === 401 && session.token) {
      sessionCache = null;
      const retrySession = await getSession(true);
      session.token = retrySession.token;
      session.previewToken = retrySession.previewToken || session.previewToken;
      response = await photoprismFetch(path, { token: retrySession.token || undefined });
    }
    if (response.ok) {
      return {
        photos: await parsePhotoList(response),
        previewToken: response.headers.get("X-Preview-Token") || session.previewToken,
      };
    }
    const detail = await readErrorDetail(response);
    lastMessage = `PhotoPrism photos failed (${response.status}${detail ? `: ${detail}` : ""})`;
    if (response.status !== 400 && response.status !== 404) {
      throw new Error(lastMessage);
    }
  }
  throw new Error(lastMessage);
}

async function parsePhotoList(response: Response) {
  const payload = (await response.json()) as PhotoPrismPhoto[] | { photos?: PhotoPrismPhoto[] };
  const rows = Array.isArray(payload) ? payload : payload.photos || [];
  return rows.filter((photo) => photoType(photo) !== "video" && photoType(photo) !== "live");
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export async function listSlideshowPhotos(force = false) {
  const settings = resolvedSettings();
  if (!settings.url) {
    return { configured: false as const, photos: [] as SlideshowPhoto[] };
  }
  if (!force && listCache && Date.now() - listCache.at < 8 * 60 * 1000) {
    return { configured: true as const, photos: listCache.photos, error: listCache.error };
  }
  try {
    const session = await getSession();
    const { photos, previewToken } = await searchPhotos(session);
    if (previewToken) {
      sessionCache = {
        ...(sessionCache || session),
        previewToken,
        expiresAt: sessionCache?.expiresAt || Date.now() + 10 * 60 * 60 * 1000,
      };
    }
    const mapped = shuffle(photos)
      .map((photo) => {
        const hash = photoHash(photo);
        if (!hash) return null;
        return {
          hash,
          src: `/api/photos/image?hash=${encodeURIComponent(hash)}&size=fit_1920`,
          thumbSrc: `/api/photos/image?hash=${encodeURIComponent(hash)}&size=tile_500`,
          title: photo.Title || photo.title || "",
        } satisfies SlideshowPhoto;
      })
      .filter((photo): photo is SlideshowPhoto => Boolean(photo));
    listCache = { at: Date.now(), photos: mapped };
    setSyncState("photos", "live");
    return { configured: true as const, photos: mapped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PhotoPrism is unreachable";
    listCache = { at: Date.now(), photos: listCache?.photos || [], error: message };
    setSyncState("photos", "live", message);
    return {
      configured: true as const,
      photos: listCache.photos,
      error: message,
    };
  }
}

export async function fetchPhotoBytes(hash: string, size = "fit_1920") {
  if (!isHash(hash)) {
    throw new Error("Bad photo hash");
  }
  const settings = resolvedSettings();
  if (!settings.url) {
    throw new Error("PhotoPrism URL is not set");
  }
  const session = await getSession();
  let previewToken = session.previewToken;
  if (!previewToken) {
    const listed = await listSlideshowPhotos();
    if (listed.error && !sessionCache?.previewToken) {
      throw new Error(listed.error);
    }
    previewToken = sessionCache?.previewToken || "public";
  }

  const sizes = [previewSize(size), "fit_1920", "fit_1280"].filter(
    (item, index, all) => all.indexOf(item) === index,
  );
  let lastStatus = 0;
  let lastDetail = "";
  for (const candidate of sizes) {
    const path = `/api/v1/t/${hash}/${previewToken}/${candidate}`;
    let response = await photoprismFetch(path, {
      token: session.token || undefined,
      acceptJson: false,
    });
    if (response.status === 401 && session.token) {
      sessionCache = null;
      listCache = null;
      const retrySession = await getSession(true);
      previewToken = retrySession.previewToken || previewToken;
      response = await photoprismFetch(`/api/v1/t/${hash}/${previewToken}/${candidate}`, {
        token: retrySession.token || undefined,
        acceptJson: false,
      });
    }
    if (response.ok) {
      return {
        buffer: await response.arrayBuffer(),
        contentType: response.headers.get("content-type") || "image/jpeg",
      };
    }
    lastStatus = response.status;
    lastDetail = await readErrorDetail(response);
    if (response.status !== 400 && response.status !== 404) break;
  }
  throw new Error(
    `Photo fetch failed (${lastStatus}${lastDetail ? `: ${lastDetail}` : ""})`,
  );
}

export function invalidatePhotoCache() {
  sessionCache = null;
  listCache = null;
}
