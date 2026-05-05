"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: err } = await signIn.email({ email, password });

    if (err) {
      setError(err.message ?? "Invalid email or password");
      setLoading(false);
      return;
    }

    // Full page reload ensures the fresh session cookie is included
    // in the very first server request — router.push() can race with
    // the cookie being registered in the browser.
    const callbackUrl = searchParams.get("callbackUrl");
    // Avoid looping back to "/" (landing) or "/login" — send to the dashboard
    const dest =
      callbackUrl && callbackUrl !== "/" && callbackUrl !== "/login"
        ? callbackUrl
        : "/contacts";
    window.location.href = dest;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@advertout.in"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-[12px] text-rose-400 font-mono">{error}</p>
      )}

      <Button type="submit" className="w-full" size="default" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
