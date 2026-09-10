import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { Profile } from "@prisma/client";

/**
 * Current signed-in user + their Prisma profile row, or null.
 * Cached per request.
 */
export const getSessionUser = cache(async (): Promise<{
  id: string;
  email: string | null;
  profile: Profile;
} | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) {
    // first login — create the mirror row. Two concurrent first requests can
    // both reach here, so tolerate the unique-constraint loser and re-read.
    const displayName = (user.user_metadata?.name as string) ?? null;
    for (let attempt = 0; attempt < 3 && !profile; attempt++) {
      const handle =
        attempt === 0
          ? await freeHandle(user.email ?? user.id)
          : `u${user.id.replace(/-/g, "").slice(0, 8)}${attempt}`;
      try {
        profile = await prisma.profile.create({
          data: { id: user.id, handle, displayName },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          // lost a race on `id` (row now exists) or hit a handle collision
          profile = await prisma.profile.findUnique({ where: { id: user.id } });
        } else {
          throw e;
        }
      }
    }
    if (!profile) throw new Error("could not create profile");
  }

  return { id: user.id, email: user.email ?? null, profile };
});

export async function requireRole(
  ...roles: Profile["role"][]
): Promise<{ id: string; profile: Profile }> {
  const u = await getSessionUser();
  if (!u || u.profile.banned || !roles.includes(u.profile.role)) {
    throw new Error("Forbidden");
  }
  return u;
}

async function freeHandle(seed: string): Promise<string> {
  const base =
    seed
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "user";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const taken = await prisma.profile.findUnique({ where: { handle: candidate } });
    if (!taken) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}
