import Link from "next/link";
import { ArrowRight, Bot, Check, FileText, Receipt, Sparkles, TrendingUp, Zap } from "lucide-react";
import { GridBg } from "@/components/effects/grid-bg";
import { GradientMesh } from "@/components/effects/gradient-mesh";
import { GlowBorder } from "@/components/effects/glow-border";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingHero } from "@/components/landing/landing-hero";
import { TerminalDemo } from "@/components/landing/terminal-demo";
import { LandingFeatures } from "@/components/landing/landing-features";
import { PricingSection } from "@/components/landing/pricing-section";
import { LandingFAQ } from "@/components/landing/landing-faq";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-bg">
      <GridBg />
      <GradientMesh />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-tight text-fg">
            Fin<span className="text-accent">AI</span>
          </span>
          <Badge variant="accent">Beta</Badge>
        </Link>

        <div className="hidden sm:flex items-center gap-6 text-[12px] text-fg-muted">
          <a href="#product" className="hover:text-fg transition-colors">Product</a>
          <a href="#pricing" className="hover:text-fg transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-fg transition-colors">FAQ</a>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/login">
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <LandingHero />

      {/* Product demo */}
      <section id="product" className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <TerminalDemo />
      </section>

      {/* Features */}
      <LandingFeatures />

      {/* Pricing */}
      <section id="pricing" className="relative z-10">
        <PricingSection />
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10">
        <LandingFAQ />
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-balance text-3xl md:text-4xl font-bold tracking-tight text-fg mb-4">
          Stop being your own bookkeeper.
        </h2>
        <p className="text-balance text-fg-muted mb-8 max-w-xl mx-auto">
          Spend the next 60 seconds setting up FinAI. Spend the rest of your week building the business.
        </p>
        <Button size="lg" asChild>
          <Link href="/login">
            Start using FinAI
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 text-[11px] text-fg-subtle">
          <span className="font-mono">© 2026 AdvertOut · FinAI</span>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="hover:text-fg transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-fg transition-colors">FAQ</a>
            <Link href="/login" className="hover:text-fg transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
