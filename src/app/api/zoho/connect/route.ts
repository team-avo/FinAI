import { NextResponse, type NextRequest } from "next/server";
import { randomBytes, createHmac } from "node:crypto";
import { auth } from "@/lib/auth";
import { buildAuthorizationUrl } from "@/lib/zoho/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORG_ID = "advertout";

function appBaseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
}

function signState(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-before-production";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Start the Zoho OAuth flow.
 *
 * Requires an authenticated FinAI session (we need to know which user to
 * attribute the connection to). Builds a signed `state` so the callback can
 * verify the redirect came from us and trust the embedded userId/orgId.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    const loginUrl = `${appBaseUrl(req)}/login?redirect=/settings?tab=integrations`;
    return NextResponse.redirect(loginUrl);
  }

  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET not set on server" },
      { status: 500 },
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ userId: session.user.id, orgId: ORG_ID, nonce, ts: Date.now() });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = signState(payloadB64);
  const state = `${payloadB64}.${sig}`;

  const redirectUri = `${appBaseUrl(req)}/api/zoho/callback`;
  const authUrl = buildAuthorizationUrl({ state, redirectUri });

  return NextResponse.redirect(authUrl);
}
