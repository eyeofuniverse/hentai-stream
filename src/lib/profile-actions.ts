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
    .refine((v) => !v || /^https:\/\//i.test(v), "must be an https URL")
    .optional(),
  bio: z.string().trim().max(300).optional(),
  autoplay: z.coerce.boolean().optional(),
  showContentWarnings: z.coerce.boolean().optional(),
  emailOptIn: z.coerce.boolean().optional(),
});

export async function updateProfile(form: FormData) {
  const me = await requireViewer();
  const d = schema.parse(Object.fromEntries(form));

  const prefs = {
    ...((me.prefs as Record<string, unknown>) ?? {}),
    autoplay: d.autoplay ?? false,
    showContentWarnings: d.showContentWarnings ?? false,
  };

  await prisma.profile.update({
    where: { id: me.id },
    data: {
      displayName: d.displayName || null,
      avatarUrl: d.avatarUrl || null,
      bio: d.bio || null,
      emailOptIn: d.emailOptIn ?? false,
      prefs,
    },
  });

  revalidatePath("/account");
}
