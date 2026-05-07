import { getZohoAccessToken, invalidateZohoAccessToken } from "./auth";

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

function baseUrl() {
  return process.env.ZOHO_API_BASE_URL ?? "https://www.zohoapis.in/books/v3";
}

function orgId() {
  const id = process.env.ZOHO_ORG_ID;
  if (!id) throw new Error("ZOHO_ORG_ID is not configured.");
  return id;
}

async function attempt(
  path: string,
  options: ZohoFetchOptions,
  accessToken: string,
): Promise<Response> {
  const params = new URLSearchParams();
  if (!options.skipOrgId) params.set("organization_id", orgId());
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
  }
  const qs = params.toString();
  const url = `${baseUrl()}${path}${qs ? `?${qs}` : ""}`;

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
 * Authenticated Zoho Books REST call.
 *
 * Behaviour:
 *   - Auto-injects organization_id query param.
 *   - On 401 (token rejected), invalidates the access-token cache and retries
 *     once with a freshly minted token.
 *   - On 429 (rate limit), retries with exponential backoff (max 3 attempts).
 *   - All other non-2xx responses throw with the response body for debugging.
 */
export async function zohoFetch<T>(path: string, options: ZohoFetchOptions = {}): Promise<T> {
  let token = await getZohoAccessToken();
  let res = await attempt(path, options, token);

  if (res.status === 401) {
    await invalidateZohoAccessToken();
    token = await getZohoAccessToken();
    res = await attempt(path, options, token);
  }

  let backoff = 1000;
  for (let i = 0; i < 3 && res.status === 429; i++) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
    await new Promise((r) => setTimeout(r, wait));
    backoff *= 2;
    res = await attempt(path, options, token);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API ${options.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetch every page of a paginated Zoho list endpoint by following
 * `page_context.has_more_page`. Bounded to `maxPages` so a runaway list never
 * hits the rate-limit wall.
 */
export async function zohoFetchAll<T>(
  path: string,
  listKey: string,
  options: ZohoFetchOptions = {},
  maxPages = 10,
  perPage = 200,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await zohoFetch<{ page_context?: { has_more_page?: boolean } } & Record<string, unknown>>(
      path,
      { ...options, query: { ...options.query, page, per_page: perPage } },
    );
    const items = (data[listKey] as T[]) ?? [];
    out.push(...items);
    if (!data.page_context?.has_more_page) break;
  }
  return out;
}
