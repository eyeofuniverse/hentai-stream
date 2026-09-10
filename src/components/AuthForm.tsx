"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) return setMsg(error.message);
        if (data.user && !data.session) {
          return setMsg("Check your email to confirm your account, then sign in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return setMsg("Invalid email or password.");
      }
      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex rounded-xl border border-line bg-surface p-1 text-sm">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 font-medium transition ${
              mode === m
                ? "bg-gradient-to-r from-accent to-accent-2 text-white"
                : "text-white/55 hover:text-white"
            }`}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <input
        type="email"
        required
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface p-3.5 text-sm outline-none transition focus:border-accent/60"
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="Password (min 8 characters)"
        autoComplete={mode === "in" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface p-3.5 text-sm outline-none transition focus:border-accent/60"
      />

      {msg && <p className="text-sm text-accent">{msg}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
      >
        {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
