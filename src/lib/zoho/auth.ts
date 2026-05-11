import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { zohoConnections, type ZohoConnection } from "@/lib/db/schema";

/**
 * Per-user Zoho OAuth.
 *
 * v1 was a single org-level refresh token in env vars. This is the multi-user
 * version: every connected user has a row in `zoho_connections` with their own
 * access + refresh tokens, plus the Zoho org they authorised against.
 *
 * Access tokens live 1 h. We refresh ~5 min before expiry so a long-running
 * request never crosses an expiry boundary mid-flight. The DB row is the
 * source of truth — no in-memory cache layer (Vercel functions are short-lived
 * anyway and Postgres reads are cheap).
 *
 * `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` remain server env vars (they're the
 * FinAI app's identity with Zoho, not per-user). `ZOHO_REFRESH_TOKEN` and
 * `ZOHO_ORG_ID` are now gone — those come from the DB row.
 */

const REFRESH_GRACE_MS = 5 * 60 * 1000; // refresh 5 min before stated expiry

interface RefreshResponse {
  access_token: string;
  scope?: string;
  api_domain?: string;
  expires_in: number; // seconds
  error?: string;
}

function accountsBaseUrl() {
  return process.env.ZOHO_ACCOUNTS_URL ?? "https://accounts.zoho.in";
}

function requireOAuthAppCreds() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET must be set for Zoho OAuth.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * In-flight dedup keyed by connection id. A burst of parallel `zohoFetch` calls
 * (the aggregator runs 7 fetches in Promise.all) will all see an expired token
 * at once; without this guard each would POST to Zoho's OAuth endpoint and get
 * rate-limited.
 */
const inflightRefresh = new Map<string, Promise<ZohoConnection>>();

/**
 * Return a fresh ZohoConnection row for `connectionId`, refreshing the access
 * token transparently if it's within the grace window of expiry.
 */
export async function getFreshConnection(connectionId: string): Promise<ZohoConnection> {
  const [row] = await db
    .select()
    .from(zohoConnections)
    .where(eq(zohoConnections.id, connectionId))
    .limit(1);

  if (!row) throw new Error(`Zoho connection ${connectionId} not found`);

  const expiresAt = row.accessTokenExpiresAt.getTime();
  if (expiresAt - Date.now() > REFRESH_GRACE_MS) return row;

  const inflight = inflightRefresh.get(connectionId);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const { clientId, clientSecret } = requireOAuthAppCreds();
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refreshToken,
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
      const data = (await res.json()) as RefreshResponse;
      if (data.error || !data.access_token) {
        throw new Error(`Zoho token refresh error: ${data.error ?? "unknown"}`);
      }

      const newExpiry = new Date(Date.now() + data.expires_in * 1000);
      const [updated] = await db
        .update(zohoConnections)
        .set({
          accessToken: data.access_token,
          accessTokenExpiresAt: newExpiry,
          apiDomain: data.api_domain ?? row.apiDomain,
          scope: data.scope ?? row.scope,
          updatedAt: new Date(),
        })
        .where(eq(zohoConnections.id, connectionId))
        .returning();
      return updated;
    } finally {
      inflightRefresh.delete(connectionId);
    }
  })();

  inflightRefresh.set(connectionId, p);
  return p;
}

/**
 * Find a usable Zoho connection for a (user, org) pair.
 *
 * Precedence:
 *   1. The user's own connection in that org.
 *   2. Any teammate's connection in the same org (so one connection serves all).
 *
 * Returns null if no one in the org has connected Zoho yet.
 */
export async function findConnectionForUserOrg(
  userId: string | null | undefined,
  orgId: string,
): Promise<ZohoConnection | null> {
  if (userId) {
    const [own] = await db
      .select()
      .from(zohoConnections)
      .where(and(eq(zohoConnections.userId, userId), eq(zohoConnections.orgId, orgId)))
      .limit(1);
    if (own) return own;
  }
  const [any] = await db
    .select()
    .from(zohoConnections)
    .where(eq(zohoConnections.orgId, orgId))
    .limit(1);
  return any ?? null;
}

/**
 * Exchange the OAuth `code` from /api/zoho/callback for tokens. Returns the raw
 * response — the caller persists the row (it also needs to look up the Zoho
 * organization_id before insert).
 */
export async function exchangeAuthorizationCode(args: {
  code: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  apiDomain: string | null;
  scope: string | null;
}> {
  const { clientId, clientSecret } = requireOAuthAppCreds();
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: args.redirectUri,
  });

  const res = await fetch(`${accountsBaseUrl()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho code exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    api_domain?: string;
    scope?: string;
    error?: string;
  };
  if (data.error || !data.access_token || !data.refresh_token) {
    throw new Error(`Zoho code exchange error: ${data.error ?? "no_tokens"}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    apiDomain: data.api_domain ?? null,
    scope: data.scope ?? null,
  };
}

/**
 * Revoke a refresh token at Zoho (best-effort — DB row is deleted regardless).
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await fetch(
      `${accountsBaseUrl()}/oauth/v2/token/revoke?token=${encodeURIComponent(refreshToken)}`,
      { method: "POST" },
    );
  } catch {
    // best-effort
  }
}

/**
 * Build the Zoho authorization URL the user is redirected to in /api/zoho/connect.
 *
 * `state` is signed/opaque to the caller — we just embed { userId, orgId, nonce }
 * and verify on callback.
 */
export function buildAuthorizationUrl(args: {
  state: string;
  redirectUri: string;
  scope?: string;
}) {
  const { clientId } = requireOAuthAppCreds();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: args.scope ?? "ZohoBooks.fullaccess.all",
    redirect_uri: args.redirectUri,
    access_type: "offline",
    prompt: "consent",
    state: args.state,
  });
  return `${accountsBaseUrl()}/oauth/v2/auth?${params.toString()}`;
}
