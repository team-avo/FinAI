import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { zohoConnections } from "@/lib/db/schema";
import { exchangeAuthorizationCode } from "@/lib/zoho/auth";
import { listOrganizationsWithRawToken } from "@/lib/zoho/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appBaseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
}

function signState(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-before-production";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifyAndParseState(state: string): { userId: string; orgId: string } | null {
  const dot = state.lastIndexOf(".");
  if (dot < 0) return null;
  const payloadB64 = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = signState(payloadB64);
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (typeof decoded.userId !== "string" || typeof decoded.orgId !== "string") return null;
    // 10 min freshness window for the state
    if (typeof decoded.ts !== "number" || Date.now() - decoded.ts > 10 * 60 * 1000) return null;
    return { userId: decoded.userId, orgId: decoded.orgId };
  } catch {
    return null;
  }
}

function errorRedirect(req: NextRequest, message: string) {
  const url = new URL(`${appBaseUrl(req)}/settings`);
  url.searchParams.set("tab", "integrations");
  url.searchParams.set("zoho_error", message);
  return NextResponse.redirect(url);
}

/**
 * Zoho OAuth callback.
 *
 * Steps:
 *   1. Verify HMAC-signed `state` (anti-CSRF + carries userId/orgId).
 *   2. Exchange `code` for access + refresh tokens.
 *   3. Hit /organizations to discover which Zoho Books org the user authorised
 *      against. If they have multiple, pick the default (or first).
 *   4. Upsert the (user, org) row in `zoho_connections`.
 *   5. Redirect back to /settings?tab=integrations with a success flag.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const zohoError = searchParams.get("error");

  if (zohoError) return errorRedirect(req, zohoError);
  if (!code || !state) return errorRedirect(req, "missing_code_or_state");

  const parsed = verifyAndParseState(state);
  if (!parsed) return errorRedirect(req, "invalid_state");

  const redirectUri = `${appBaseUrl(req)}/api/zoho/callback`;

  let tokens;
  try {
    tokens = await exchangeAuthorizationCode({ code, redirectUri });
  } catch (err) {
    return errorRedirect(req, err instanceof Error ? err.message : "token_exchange_failed");
  }

  let orgs;
  try {
    orgs = await listOrganizationsWithRawToken({
      accessToken: tokens.accessToken,
      apiDomain: tokens.apiDomain,
    });
  } catch (err) {
    return errorRedirect(req, err instanceof Error ? err.message : "org_lookup_failed");
  }

  if (orgs.length === 0) return errorRedirect(req, "no_zoho_organizations");

  const chosen = orgs.find((o) => o.is_default_org) ?? orgs[0];

  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  // Upsert: delete any existing row for this (user, finai-org) pair, then insert.
  // Simpler than ON CONFLICT for a small-volume table and avoids leaking stale
  // tokens if the user reconnects to a different Zoho org.
  await db
    .delete(zohoConnections)
    .where(
      and(eq(zohoConnections.userId, parsed.userId), eq(zohoConnections.orgId, parsed.orgId)),
    );

  await db.insert(zohoConnections).values({
    userId: parsed.userId,
    orgId: parsed.orgId,
    zohoOrgId: chosen.organization_id,
    zohoOrgName: chosen.name,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: expiresAt,
    scope: tokens.scope,
    apiDomain: tokens.apiDomain,
  });

  const successUrl = new URL(`${appBaseUrl(req)}/settings`);
  successUrl.searchParams.set("tab", "integrations");
  successUrl.searchParams.set("zoho_connected", "1");
  return NextResponse.redirect(successUrl);
}
