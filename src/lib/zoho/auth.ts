import { cacheGet, cacheSet } from "@/lib/cache/redis";

// Zoho OAuth refresh-token → access-token exchange.
// Access tokens live 1 hour; we cache for 55 min so we always have a buffer.

const ACCESS_TOKEN_TTL_SEC = 55 * 60;

interface ZohoTokenResponse {
  access_token: string;
  scope: string;
  api_domain: string;
  token_type: string;
  expires_in: number;
}

interface CachedToken {
  accessToken: string;
  fetchedAt: number;
}

function tokenCacheKey() {
  // Tied to the refresh token (not just org) so rotating the refresh token
  // implicitly invalidates the cached access token.
  const refresh = process.env.ZOHO_REFRESH_TOKEN ?? "";
  const tail = refresh.slice(-12) || "anon";
  return `zoho:access_token:${tail}`;
}

function accountsBaseUrl() {
  // India edition uses zoho.in; mirror logic for global edition if needed later.
  return "https://accounts.zoho.in";
}

export async function getZohoAccessToken(): Promise<string> {
  const refresh = process.env.ZOHO_REFRESH_TOKEN;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!refresh || !clientId || !clientSecret) {
    throw new Error(
      "Zoho is not configured. Set ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET.",
    );
  }

  const cached = await cacheGet<CachedToken>(tokenCacheKey());
  if (cached?.accessToken) return cached.accessToken;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${accountsBaseUrl()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token refresh failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as ZohoTokenResponse & { error?: string };
  if (data.error || !data.access_token) {
    throw new Error(`Zoho token refresh error: ${data.error ?? "unknown"}`);
  }

  await cacheSet<CachedToken>(
    tokenCacheKey(),
    { accessToken: data.access_token, fetchedAt: Date.now() },
    ACCESS_TOKEN_TTL_SEC,
  );

  return data.access_token;
}

/** Force a fresh access token (used when a 401 invalidates the cache). */
export async function invalidateZohoAccessToken(): Promise<void> {
  await cacheSet<CachedToken | null>(tokenCacheKey(), null, 1);
}
