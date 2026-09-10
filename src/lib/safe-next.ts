/** A `?next=` value that's safe to redirect to — a same-site path, never an
 *  absolute URL, protocol-relative URL, or an api/auth route. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    next.includes("\\") ||
    /^\/(api|auth|console)(\/|$)/.test(next)
  ) {
    return fallback;
  }
  return next;
}
