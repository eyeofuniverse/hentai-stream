"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
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
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) return setMsg(error.message);
        if (data.user && !data.session) {
          return setMsg("Check your email to confirm your account, then sign in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return setMsg("Invalid email or password.");
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex rounded-full border border-white/10 bg-surface p-1 text-sm">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full py-2 ${
              mode === m ? "bg-accent font-semibold" : "text-white/55"
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
        className="w-full rounded-xl border border-white/10 bg-surface p-3.5 text-sm outline-none focus:border-white/25"
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="Password (min 8 characters)"
        autoComplete={mode === "in" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-surface p-3.5 text-sm outline-none focus:border-white/25"
      />

      {msg && <p className="text-sm text-accent">{msg}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-accent py-3.5 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
