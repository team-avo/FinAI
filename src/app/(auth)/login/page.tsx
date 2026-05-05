import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GridBg } from "@/components/effects/grid-bg";
import { GradientMesh } from "@/components/effects/gradient-mesh";
import { GlowBorder } from "@/components/effects/glow-border";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center">
      <GridBg />
      <GradientMesh />

      <div className="absolute top-5 left-5 z-10">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <span className="font-mono text-2xl font-bold tracking-tight text-fg">
            Fin<span className="text-accent">AI</span>
          </span>
          <p className="mt-1.5 text-[13px] text-fg-muted">Sign in to your account</p>
        </div>

        <GlowBorder rounded="var(--radius-lg)" className="rounded-lg">
          <div className="rounded-lg border border-transparent bg-bg-elevated p-6">
            <LoginForm />
          </div>
        </GlowBorder>
      </div>
    </main>
  );
}
