"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ResetForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent("/account/password")}`,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-lg border border-good/20 bg-good/10 px-4 py-3 text-center text-sm text-good">
        If an account exists for <span className="font-semibold">{email}</span>,
        a reset link is on its way. Check your inbox and spam.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        required
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface p-3.5 text-sm outline-none transition focus:border-accent/60 focus-visible:outline-none"
      />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3.5 text-sm font-bold text-white shadow-glow disabled:opacity-50"
      >
        {busy ? "…" : "Send reset link"}
      </button>
    </form>
  );
}
