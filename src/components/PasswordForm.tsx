"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ ok: false, text: "At least 8 characters." });
    if (pw !== pw2) return setMsg({ ok: false, text: "Passwords don't match." });
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
    } else {
      setMsg({ ok: true, text: "Password updated." });
      setPw("");
      setPw2("");
      router.refresh();
    }
  }

  const cls =
    "w-full rounded-xl border border-line bg-surface p-3.5 text-sm outline-none transition focus:border-accent/60 focus-visible:outline-none";

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        placeholder="New password"
        autoComplete="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className={cls}
        required
        minLength={8}
      />
      <input
        type="password"
        placeholder="Confirm new password"
        autoComplete="new-password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        className={cls}
        required
      />
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-good" : "text-red-400"}`}>{msg.text}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-2.5 text-sm font-bold text-white shadow-glow disabled:opacity-50"
      >
        {busy ? "…" : "Update password"}
      </button>
    </form>
  );
}
