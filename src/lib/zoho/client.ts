import { getFreshConnection } from "./auth";
import type { ZohoConnection } from "@/lib/db/schema";

interface ZohoFetchOptions {
  /** HTTP method. Defaults to GET. */
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Query params (organization_id is auto-injected). */
  query?: Record<string, string | number | undefined>;
  /** JSON body. */
  body?: unknown;
  /** If true, do NOT auto-add organization_id (rare — most endpoints require it). */
  skipOrgId?: boolean;
}

function apiBaseUrl(conn: ZohoConnection): string {
  // Zoho returns api_domain at OAuth time (e.g. https://www.zohoapis.in for IN
  // edition, .com for US). Fall back to env / IN default.
  const domain = conn.apiDomain ?? process.env.ZOHO_API_DOMAIN ?? "https://www.zohoapis.in";
  return `${domain.replace(/\/$/, "")}/books/v3`;
}

async function attempt(
  conn: ZohoConnection,
  path: string,
  options: ZohoFetchOptions,
  accessToken: string,
): Promise<Response> {
  const params = new URLSearchParams();
  if (!options.skipOrgId) params.set("organization_id", conn.zohoOrgId);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
  }
  const qs = params.toString();
  const url = `${apiBaseUrl(conn)}${path}${qs ? `?${qs}` : ""}`;

  return fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
}

/**
 * Authenticated Zoho Books REST call tied to a specific user connection.
 *
 * - Auto-injects `organization_id` from the connection row.
 * - On 401, force-refreshes the access token and retries once.
 * - On 429, exponential backoff up to 3 attempts.
 */
export async function zohoFetch<T>(
  connection: ZohoConnection,
  path: string,
  options: ZohoFetchOptions = {},
): Promise<T> {
  let conn = await getFreshConnection(connection.id);
  let res = await attempt(conn, path, options, conn.accessToken);

  if (res.status === 401) {
    // Force a refresh by setting expiry in the past via getFreshConnection's
    // grace-window — simplest path: re-read the row (in case another worker
    // already refreshed), then retry. If still 401, the refresh in `auth.ts`
    // will have rotated by now since we just re-fetched.
    conn = await getFreshConnection(connection.id);
    res = await attempt(conn, path, options, conn.accessToken);
  }

  let backoff = 1000;
  for (let i = 0; i < 3 && res.status === 429; i++) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
    await new Promise((r) => setTimeout(r, wait));
    backoff *= 2;
    res = await attempt(conn, path, options, conn.accessToken);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API ${options.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetch every page of a paginated Zoho list endpoint by following
 * `page_context.has_more_page`. Bounded to `maxPages`.
 */
export async function zohoFetchAll<T>(
  connection: ZohoConnection,
  path: string,
  listKey: string,
  options: ZohoFetchOptions = {},
  maxPages = 10,
  perPage = 200,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await zohoFetch<{ page_context?: { has_more_page?: boolean } } & Record<string, unknown>>(
      connection,
      path,
      { ...options, query: { ...options.query, page, per_page: perPage } },
    );
    const items = (data[listKey] as T[]) ?? [];
    out.push(...items);
    if (!data.page_context?.has_more_page) break;
  }
  return out;
}

/**
 * One-shot helper used at OAuth-callback time to discover which Zoho org the
 * user has access to. The caller has just exchanged the code for tokens but
 * hasn't yet persisted a connection row (because we don't know the org_id
 * until we ask Zoho). We hit /organizations directly with the raw token.
 */
export async function listOrganizationsWithRawToken(args: {
  accessToken: string;
  apiDomain: string | null;
}): Promise<Array<{ organization_id: string; name: string; is_default_org?: boolean }>> {
  const domain = args.apiDomain ?? process.env.ZOHO_API_DOMAIN ?? "https://www.zohoapis.in";
  const url = `${domain.replace(/\/$/, "")}/books/v3/organizations`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${args.accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho /organizations failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { organizations?: Array<{ organization_id: string; name: string; is_default_org?: boolean }> };
  return data.organizations ?? [];
}
