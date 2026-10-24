/**
 * Cheap client-side signal for "is there any chance this visitor is signed
 * in" — checks for Supabase's own session cookie (sb-<project-ref>-auth-token,
 * possibly chunked .0/.1) without a network round trip. Several components
 * render on every/most pageviews and used to call an API route just to learn
 * "not signed in" for the overwhelming majority of (anonymous) visitors —
 * each one a Vercel Function Invocation for nothing. A false negative isn't
 * possible (no cookie really does mean no session); a false positive just
 * falls through to the real server check, same as before this existed.
 */
export function hasSessionCookie(): boolean {
  return /(?:^|; )sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}
