import { getDb } from "@/lib/db";

export type OAuthRecord = {
  access_token: string | null;
  refresh_token: string | null;
  expiry: string | null;
  email: string | null;
};

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function readOAuth(): OAuthRecord | null {
  const row = getDb().prepare("SELECT * FROM oauth WHERE id = 1").get() as
    | OAuthRecord
    | undefined;
  return row ?? null;
}

export function writeOAuth(record: OAuthRecord) {
  getDb()
    .prepare(
      `INSERT INTO oauth (id, access_token, refresh_token, expiry, email)
       VALUES (1, @access_token, @refresh_token, @expiry, @email)
       ON CONFLICT(id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, oauth.refresh_token),
         expiry = excluded.expiry,
         email = COALESCE(excluded.email, oauth.email)`,
    )
    .run(record);
}

export function clearOAuth() {
  getDb().prepare("DELETE FROM oauth WHERE id = 1").run();
}
