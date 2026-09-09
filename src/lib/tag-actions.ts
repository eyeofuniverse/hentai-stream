"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type TagCategory } from "@prisma/client";
import { prisma, db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recountTaxonomy } from "@/lib/metadata/importer";

const CATS: TagCategory[] = ["GENRE", "THEME", "FETISH", "FORMAT", "CONTENT_WARNING"];

function bust() {
  revalidatePath("/admin/tags");
  revalidatePath("/tags");
  revalidatePath("/");
}

export async function renameTag(id: string, formData: FormData) {
  await requireRole("ADMIN", "MODERATOR");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (name.length < 2) return;
  await db(() => prisma.tag.update({ where: { id }, data: { name } }));
  bust();
}

export async function setTagCategory(id: string, category: string) {
  await requireRole("ADMIN", "MODERATOR");
  if (!CATS.includes(category as TagCategory)) return;
  await db(() =>
    prisma.tag.update({ where: { id }, data: { category: category as TagCategory } }),
  );
  bust();
}

export async function toggleTagFeatured(id: string, next: boolean) {
  await requireRole("ADMIN", "MODERATOR");
  await db(() => prisma.tag.update({ where: { id }, data: { featured: next } }));
  bust();
}

export async function deleteTag(id: string) {
  await requireRole("ADMIN", "MODERATOR");
  const n = await db(() => prisma.series.count({ where: { tags: { some: { id } } } }));
  if (n > 0) throw new Error(`Tag still has ${n} series — merge it instead.`);
  await db(() => prisma.tag.delete({ where: { id } }));
  bust();
}

/** Move every series from `fromId` onto `intoId`, then delete `fromId`. */
export async function mergeTag(fromId: string, intoId: string) {
  await requireRole("ADMIN", "MODERATOR");
  if (fromId === intoId) return;

  const [from, into] = await db(() =>
    Promise.all([
      prisma.tag.findUnique({ where: { id: fromId }, select: { id: true } }),
      prisma.tag.findUnique({ where: { id: intoId }, select: { id: true } }),
    ]),
  );
  if (!from || !into) throw new Error("Tag not found");

  await db(() =>
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO "_SeriesTags" ("A", "B")
      SELECT "A", ${intoId} FROM "_SeriesTags" WHERE "B" = ${fromId}
      ON CONFLICT ("A", "B") DO NOTHING
    `),
  );
  await db(() =>
    prisma.$executeRaw(Prisma.sql`DELETE FROM "_SeriesTags" WHERE "B" = ${fromId}`),
  );
  await db(() => prisma.tag.delete({ where: { id: fromId } }));
  await recountTaxonomy().catch(() => {});
  bust();
}

/** Typeahead for the merge-target picker. */
export async function searchTagsForPicker(q: string) {
  await requireRole("ADMIN", "MODERATOR");
  const term = q.trim();
  if (term.length < 2) return [];
  return db(() =>
    prisma.tag.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      orderBy: { seriesCount: "desc" },
      take: 10,
      select: { id: true, name: true, slug: true, category: true, seriesCount: true },
    }),
  );
}
