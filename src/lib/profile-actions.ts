"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireViewer } from "@/lib/user";

const schema = z.object({
  displayName: z.string().trim().max(40).optional(),
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\//i.test(v), "Avatar must be an https URL")
    .optional(),
  bio: z.string().trim().max(300).optional(),
  autoplay: z.coerce.boolean().optional(),
  showContentWarnings: z.coerce.boolean().optional(),
  emailOptIn: z.coerce.boolean().optional(),
});

export type ProfileFormState = { ok: boolean; error?: string } | null;

export async function updateProfile(
  _prev: ProfileFormState,
  form: FormData,
): Promise<ProfileFormState> {
  const me = await requireViewer();

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const base =
    me.prefs && typeof me.prefs === "object" && !Array.isArray(me.prefs)
      ? (me.prefs as Record<string, unknown>)
      : {};

  try {
    await prisma.profile.update({
      where: { id: me.id },
      data: {
        displayName: d.displayName || null,
        avatarUrl: d.avatarUrl || null,
        bio: d.bio || null,
        emailOptIn: d.emailOptIn ?? false,
        prefs: {
          ...base,
          autoplay: d.autoplay ?? false,
          showContentWarnings: d.showContentWarnings ?? false,
        },
      },
    });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }

  revalidatePath("/account");
  return { ok: true };
}
