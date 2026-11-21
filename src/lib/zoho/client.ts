import type { ZohoConnection } from "@/lib/db/schema";
import { getFreshConnection } from "./auth";

interface ZohoFetchOptions {
  /** HTTP method. Defaults to GET. */
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Query params (organization_id is auto-injected). */
  query?: Record<string, string | number | undefined>;
  /** JSON body. */
  body?: unknown;
  /** If true, do NOT auto-add organization_id (rare — most endpoints require it). */
  skipOrgId?: boolean;
  /** Accept header. Defaults to application/json; set e.g. "application/pdf" for binary. */
  accept?: string;
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
      Accept: options.accept ?? "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
}

/** Shared token-refresh + 429-backoff loop, returning the raw Response. */
async function attemptWithRetry(
  connection: ZohoConnection,
  path: string,
  options: ZohoFetchOptions,
): Promise<{ conn: ZohoConnection; res: Response }> {
  let conn = await getFreshConnection(connection.id);
  let res = await attempt(conn, path, options, conn.accessToken);

  if (res.status === 401) {
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

  return { conn, res };
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
  const { res } = await attemptWithRetry(connection, path, options);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API ${options.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * Binary variant of {@link zohoFetch} — same auth/refresh/backoff, but returns
 * the raw bytes instead of parsing JSON. Used for the invoice-PDF endpoint
 * (`/invoices/{id}?accept=pdf`), which replies with `application/pdf`.
 *
 * On error Zoho returns a JSON envelope, so we read it as text for the message.
 */
export async function zohoFetchBinary(
  connection: ZohoConnection,
  path: string,
  options: ZohoFetchOptions = {},
): Promise<Buffer> {
  const { res } = await attemptWithRetry(connection, path, {
    ...options,
    accept: options.accept ?? "application/pdf",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API ${options.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return Buffer.from(await res.arrayBuffer());
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
    const data = await zohoFetch<
      { page_context?: { has_more_page?: boolean } } & Record<string, unknown>
    >(connection, path, { ...options, query: { ...options.query, page, per_page: perPage } });
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
  const data = (await res.json()) as {
    organizations?: Array<{ organization_id: string; name: string; is_default_org?: boolean }>;
  };
  return data.organizations ?? [];
}
