import { photoPrismSettings } from "@/lib/config";
import { extractAlbumUid, normalizePhotoPrismUrl } from "@/lib/photoprism-url";
import { setSyncState } from "@/lib/sync-state";
import type { SlideshowPhoto } from "@/lib/types";

export { extractAlbumUid, normalizePhotoPrismUrl };

const PHOTO_HASH = /^[a-fA-F0-9]{32,64}$/;
const PREVIEW_SIZES = ["fit_1280", "fit_1920", "fit_720", "tile_500"] as const;
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
  return "fit_1280";
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
    headers.set("X-Session-ID", init.token);
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

type PhotoPrismAlbum = {
  UID?: string;
  uid?: string;
  Type?: string;
  type?: string;
  Path?: string;
  path?: string;
  Title?: string;
  title?: string;
  Filter?: string;
  filter?: string;
  Slug?: string;
  slug?: string;
};

async function loadAlbum(session: SessionCache, uid: string): Promise<PhotoPrismAlbum | null> {
  const response = await photoprismFetch(`/api/v1/albums/${encodeURIComponent(uid)}`, {
    token: session.token || undefined,
  });
  if (response.status === 401 && session.token) {
    sessionCache = null;
    const retrySession = await getSession(true);
    session.token = retrySession.token;
    session.previewToken = retrySession.previewToken || session.previewToken;
    const retry = await photoprismFetch(`/api/v1/albums/${encodeURIComponent(uid)}`, {
      token: retrySession.token || undefined,
    });
    if (!retry.ok) return null;
    return (await retry.json()) as PhotoPrismAlbum;
  }
  if (!response.ok) return null;
  return (await response.json()) as PhotoPrismAlbum;
}

function albumLabel(album: PhotoPrismAlbum | null, uid: string) {
  if (!album) return uid || "the library";
  const title = (album.Title || album.title || "").trim();
  const type = (album.Type || album.type || "").trim();
  const path = (album.Path || album.path || "").trim();
  const bits = [title || uid];
  if (type) bits.push(type);
  if (path) bits.push(path);
  return bits.join(" · ");
}

function photoSearchAttempts(album: PhotoPrismAlbum | null) {
  const settings = resolvedSettings();
  const uid = settings.albumUid;
  const query = settings.query.trim();
  const attempts: URLSearchParams[] = [];
  const seen = new Set<string>();

  const make = (extra: Record<string, string>) => {
    const params = new URLSearchParams({
      count: "60",
      offset: "0",
      order: "newest",
      merged: "true",
      ...extra,
    });
    const key = params.toString();
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push(params);
  };

  // s=<uid> is how PhotoPrism's own UI lists an album. Folder/moment albums
  // apply their stored filter. order=random 400s on those, so we use newest
  // and shuffle locally. A 200 with zero rows is not success — keep trying.
  if (uid) {
    if (query) make({ s: uid, q: query });
    make({ s: uid });
  }

  if (album) {
    const path = (album.Path || album.path || "").replace(/^\/+/, "").trim();
    const filter = (album.Filter || album.filter || "").trim();
    const title = (album.Title || album.title || "").trim();
    if (filter) {
      make({ q: query ? `${query} ${filter}` : filter });
    }
    if (path) {
      make({ path });
      make({ folder: path });
      make({ q: query ? `${query} path:"${path}"` : `path:"${path}"` });
      if (!path.includes("*")) {
        make({ path: `${path}*` });
        make({ q: `path:"${path}/*"` });
      }
    }
    if (title) {
      make({ album: title });
      make({ q: query ? `${query} album:"${title}"` : `album:"${title}"` });
    }
  } else if (uid) {
    make({ album: uid });
    make({ q: query ? `${query} album:${uid}` : `album:${uid}` });
  } else if (query) {
    make({ q: query });
  } else {
    make({});
  }

  return attempts;
}

async function searchPhotos(session: SessionCache) {
  const uid = resolvedSettings().albumUid;
  const album = uid ? await loadAlbum(session, uid) : null;
  const label = albumLabel(album, uid);
  let lastMessage = uid
    ? `PhotoPrism signed in, but ${label} returned no still photos.`
    : "PhotoPrism photos failed";
  const attempts = photoSearchAttempts(album);
  let emptyOk = false;
  let previewToken = session.previewToken;
  for (const params of attempts) {
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
      const photos = await parsePhotoList(response);
      previewToken = response.headers.get("X-Preview-Token") || previewToken;
      if (photos.length > 0) {
        return { photos, previewToken };
      }
      emptyOk = true;
      continue;
    }
    const detail = await readErrorDetail(response);
    lastMessage = `PhotoPrism photos failed (${response.status}${detail ? `: ${detail}` : ""})`;
    if (response.status !== 400 && response.status !== 404) {
      throw new Error(lastMessage);
    }
  }
  if (emptyOk) {
    throw new Error(`PhotoPrism signed in, but ${label} returned no still photos.`);
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
          src: `/api/photos/image?hash=${encodeURIComponent(hash)}&size=fit_1280`,
          thumbSrc: `/api/photos/image?hash=${encodeURIComponent(hash)}&size=tile_500`,
          title: photo.Title || photo.title || "",
        } satisfies SlideshowPhoto;
      })
      .filter((photo): photo is SlideshowPhoto => Boolean(photo));
    if (mapped.length === 0) {
      throw new Error(
        photos.length
          ? `PhotoPrism returned ${photos.length} items but none were still photos with a file hash.`
          : "PhotoPrism signed in, but that album returned no still photos.",
      );
    }
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

export async function fetchPhotoBytes(hash: string, size = "fit_1280") {
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

  const sizes = [previewSize(size), "fit_1280", "fit_720"].filter(
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
