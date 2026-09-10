/**
 * Server-rendered so it paints with the HTML. The `vok` class is added to
 * <html> by a tiny inline script in the root layout <body> that runs before
 * first paint (so a returning visitor never sees a flash or a blocked click);
 * this script only handles the button press. It NEVER removes DOM nodes, so
 * React's hydration of the surrounding tree is untouched (that was #418). CSS
 * hides the gate + unlocks scroll when the class is present.
 */
export function AgeGate() {
  return (
    <>
      <div
        id="lh-vg"
        data-nosnippet
        aria-modal="true"
        role="dialog"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6 backdrop-blur-md"
      >
        <div className="w-full max-w-md animate-rise rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-extrabold">
            Lust<span className="text-accent">Hentai</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            This site contains sexually explicit animated material. By entering you
            confirm you are at least{" "}
            <strong className="text-white">18 years old</strong> (or the age of
            majority where you live) and that viewing this content is legal in your
            location.
          </p>
          <p className="mt-3 text-xs text-white/40">
            All content is animated — no real persons are depicted.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              id="lh-vg-in"
              type="button"
              className="rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
            >
              I am 18 or older — Enter
            </button>
            <a
              href="https://www.google.com"
              className="rounded-xl border border-line py-3 text-sm text-white/55 transition hover:text-white"
            >
              Leave
            </a>
          </div>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var d=document;function ok(){try{var s=location.protocol==='https:'?';secure':'';d.cookie='lh_vok=1;path=/;max-age=34560000;samesite=lax'+s}catch(e){}try{fetch('/api/age',{method:'POST',keepalive:true})}catch(e){}d.documentElement.classList.add('vok')}var b=d.getElementById('lh-vg-in');if(b)b.addEventListener('click',ok);d.addEventListener('click',function(e){var t=e.target;if(t&&t.closest&&t.closest('#lh-vg-in'))ok()})})();",
        }}
      />
    </>
  );
}
