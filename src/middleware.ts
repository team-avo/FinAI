import { NextRequest, NextResponse } from "next/server";

// Paths that never require auth
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/trpc",
  "/api/whatsapp",
  "/api/cron",
  "/api/ocr",
  "/api/ai",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always pass through static assets and public API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Skip auth enforcement when DATABASE_URL not set (local dev without infra)
  if (!process.env.DATABASE_URL) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookies (both secure and non-secure variants)
  const sessionCookie =
    req.cookies.get("better-auth.session_token") ??
    req.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie?.value) {
    // Allow unauthenticated users to see the marketing page at /
    if (pathname === "/") return NextResponse.next();

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from the marketing root to the dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/contacts", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
