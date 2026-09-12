"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Msg = { kind: "error" | "info"; text: string } | null;

function strength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^\w\s]/.test(pw)) s++;
  const label = ["Too short", "Weak", "Okay", "Good", "Strong", "Strong"][s];
  return { score: Math.min(s, 4), label };
}

export function AuthForm({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const pw = strength(password);
  const canSubmit =
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) &&
    (mode === "in" ? password.length >= 1 : password.length >= 8);

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
        if (error) return setMsg({ kind: "error", text: error.message });
        if (data.user && !data.session) {
          setConfirmSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error)
          return setMsg({ kind: "error", text: "Email or password is incorrect." });
      }
      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    setMsg(
      error
        ? { kind: "error", text: error.message }
        : { kind: "info", text: "Sent again — check your inbox and spam folder." },
    );
  }

  if (confirmSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-10 6L2 7" />
          </svg>
        </div>
        <div>
          <p className="font-display text-base font-bold">Confirm your email</p>
          <p className="mt-1 text-sm text-white/55">
            We sent a link to <span className="text-white/80">{email}</span>. Click it
            to finish creating your account.
          </p>
        </div>
        {msg && (
          <p className={`text-xs ${msg.kind === "error" ? "text-red-400" : "text-good"}`}>
            {msg.text}
          </p>
        )}
        <button
          onClick={resend}
          disabled={busy}
          className="text-xs text-accent underline-offset-2 hover:underline disabled:opacity-50"
        >
          Didn&apos;t get it? Resend
        </button>
        <button
          onClick={() => {
            setConfirmSent(false);
            setMode("in");
            setMsg(null);
          }}
          className="block w-full text-xs text-white/50 hover:text-white"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="flex rounded-xl border border-line bg-surface p-1 text-sm">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setMsg(null);
            }}
            className={`flex-1 rounded-lg py-2 font-semibold transition ${
              mode === m
                ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-glow"
                : "text-white/50 hover:text-white"
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
        className="w-full rounded-xl border border-line bg-surface p-3.5 text-sm outline-none transition focus-visible:outline-none focus:border-accent/60"
      />

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          minLength={mode === "up" ? 8 : undefined}
          placeholder={mode === "up" ? "Choose a password (8+ characters)" : "Password"}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface p-3.5 pr-11 text-sm outline-none transition focus-visible:outline-none focus:border-accent/60"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70"
        >
          {show ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {mode === "up" && password.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < pw.score
                    ? pw.score >= 3
                      ? "bg-good"
                      : "bg-warn"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] text-white/50">{pw.label}</span>
        </div>
      )}

      {mode === "in" && (
        <div className="text-right">
          <Link
            href="/reset-password"
            className="text-xs text-white/50 hover:text-accent"
          >
            Forgot password?
          </Link>
        </div>
      )}

      {msg && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            msg.kind === "error"
              ? "border border-red-500/20 bg-red-500/10 text-red-300"
              : "border border-good/20 bg-good/10 text-good"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
      >
        {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-white/50">
        {mode === "up"
          ? "By creating an account you confirm you're 18+ and agree to the "
          : ""}
        {mode === "up" && (
          <>
            <Link href="/terms" className="underline hover:text-white/50">terms</Link>.
          </>
        )}
      </p>
    </form>
  );
}
