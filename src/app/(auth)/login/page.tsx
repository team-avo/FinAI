import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GridBg } from "@/components/effects/grid-bg";
import { GradientMesh } from "@/components/effects/gradient-mesh";
import { GlowBorder } from "@/components/effects/glow-border";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center">
      <GridBg />
      <GradientMesh />

      {/* Back link */}
      <div className="absolute top-5 left-5 z-10">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <span className="font-mono text-2xl font-bold tracking-tight text-fg">
            Fin<span className="text-accent">AI</span>
          </span>
          <p className="mt-1.5 text-[13px] text-fg-muted">Sign in with your work email</p>
        </div>

        <GlowBorder rounded="var(--radius-lg)" className="rounded-lg">
          <div className="rounded-lg border border-transparent bg-bg-elevated p-6">
            {/* Magic link form — wired to Better Auth in W3 */}
            <form className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="default">
                Send magic link
              </Button>
            </form>

            <div className="mt-5 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-mono text-fg-subtle uppercase tracking-widest">
                or
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* OAuth placeholder */}
            <Button variant="secondary" className="w-full mt-4" size="default" disabled>
              <GoogleIcon />
              Continue with Google
            </Button>

            <p className="mt-5 text-center text-[11px] text-fg-subtle leading-relaxed">
              By signing in you agree to our{" "}
              <Link href="#" className="text-fg-muted underline underline-offset-2 hover:text-fg">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="#" className="text-fg-muted underline underline-offset-2 hover:text-fg">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </GlowBorder>

        <p className="mt-5 text-center text-[12px] text-fg-subtle">
          No account?{" "}
          <Link href="/login" className="text-accent hover:text-accent/80 font-medium">
            Request access →
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
