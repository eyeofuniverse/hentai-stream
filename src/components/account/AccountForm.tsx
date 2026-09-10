"use client";

import { useActionState, useState } from "react";
import { updateProfile, type ProfileFormState } from "@/lib/profile-actions";

const inputCls =
  "w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none transition focus:border-accent/50 focus-visible:outline-none";

export function AccountForm({
  displayName,
  avatarUrl,
  bio,
  autoplay,
  showContentWarnings,
  emailOptIn,
}: {
  displayName: string;
  avatarUrl: string;
  bio: string;
  autoplay: boolean;
  showContentWarnings: boolean;
  emailOptIn: boolean;
}) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(
    updateProfile,
    null,
  );
  const [avatar, setAvatar] = useState(avatarUrl);
  const [broken, setBroken] = useState(false);

  return (
    <form action={action} className="space-y-6">
      {/* Profile */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">
          Profile
        </h2>
        <div className="flex items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-lg font-bold text-white/40 ring-1 ring-white/10">
            {avatar && !broken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setBroken(true)}
                onLoad={() => setBroken(false)}
              />
            ) : (
              (displayName || "?").slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/35">
                Display name
              </label>
              <input name="displayName" defaultValue={displayName} maxLength={40} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/35">
                Avatar URL
              </label>
              <input
                name="avatarUrl"
                type="url"
                defaultValue={avatarUrl}
                onChange={(e) => {
                  setAvatar(e.target.value);
                  setBroken(false);
                }}
                placeholder="https://…"
                className={inputCls}
              />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/35">
            Bio
          </label>
          <textarea name="bio" defaultValue={bio} rows={3} maxLength={300} className={inputCls} />
        </div>
      </section>

      {/* Playback */}
      <section className="space-y-2 rounded-xl border border-line bg-surface/40 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">
          Playback
        </h2>
        <label className="flex items-center gap-2.5 text-sm text-white/75">
          <input type="checkbox" name="autoplay" defaultChecked={autoplay} className="h-4 w-4 accent-[color:#ff3d7f]" />
          Autoplay the next episode
        </label>
        <label className="flex items-center gap-2.5 text-sm text-white/75">
          <input
            type="checkbox"
            name="showContentWarnings"
            defaultChecked={showContentWarnings}
            className="h-4 w-4 accent-[color:#ff3d7f]"
          />
          Show content warnings before playing
        </label>
      </section>

      {/* Notifications */}
      <section className="space-y-2 rounded-xl border border-line bg-surface/40 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">
          Notifications
        </h2>
        <label className="flex items-center gap-2.5 text-sm text-white/75">
          <input type="checkbox" name="emailOptIn" defaultChecked={emailOptIn} className="h-4 w-4 accent-[color:#ff3d7f]" />
          Email me about new episodes on my watchlist
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-2.5 text-sm font-bold text-white shadow-glow disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state?.ok && <span className="text-sm text-good">Saved ✓</span>}
        {state && !state.ok && (
          <span className="text-sm text-red-400">{state.error}</span>
        )}
      </div>
    </form>
  );
}
