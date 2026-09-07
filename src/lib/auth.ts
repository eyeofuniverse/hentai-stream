import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
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
    // first login — create the mirror row
    profile = await prisma.profile.create({
      data: {
        id: user.id,
        handle: await freeHandle(user.email ?? user.id),
        displayName: (user.user_metadata?.name as string) ?? null,
      },
    });
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
