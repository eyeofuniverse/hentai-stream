import "server-only";
import { getSessionUser } from "@/lib/auth";

/** The signed-in viewer's profile, or null. Profile is auto-created on first
 *  call (see getSessionUser). Cached per request. */
export async function viewer() {
  const s = await getSessionUser().catch(() => null);
  return s ? { ...s.profile, id: s.id, email: s.email } : null;
}

export class Unauthorized extends Error {
  constructor() {
    super("Sign in required");
    this.name = "Unauthorized";
  }
}

/** For route handlers: returns the profile or throws Unauthorized. */
export async function requireViewer() {
  const v = await viewer();
  if (!v || v.banned) throw new Unauthorized();
  return v;
}
