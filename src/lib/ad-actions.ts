"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  AD_SLOTS,
  AD_FORMATS,
  defaultConfig,
  type AdConfig,
  type AdFormat,
  type AdVariant,
} from "@/lib/ads";

const fmt = (v: FormDataEntryValue | null): AdFormat => {
  const s = String(v ?? "");
  return (AD_FORMATS as readonly string[]).includes(s)
    ? (s as AdFormat)
    : "728x90";
};
const bool = (form: FormData, name: string) => form.get(name) === "on";
const str = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

function variant(form: FormData, prefix: string, fallback: AdVariant): AdVariant {
  const src = String(form.get(`${prefix}.source`) ?? "zone");
  return {
    enabled: bool(form, `${prefix}.enabled`),
    source: src === "code" ? "code" : "zone",
    zoneId: str(form, `${prefix}.zoneId`),
    code: String(form.get(`${prefix}.code`) ?? "").slice(0, 8000),
    format: fmt(form.get(`${prefix}.format`)) || fallback.format,
  };
}

export async function saveAdConfig(form: FormData) {
  await requireRole("ADMIN");

  const base = defaultConfig();
  const slots: AdConfig["slots"] = {};
  for (const s of AD_SLOTS) {
    slots[s.key] = {
      desktop: variant(form, `slot.${s.key}.desktop`, base.slots[s.key].desktop),
      mobile: variant(form, `slot.${s.key}.mobile`, base.slots[s.key].mobile),
    };
  }

  const cfg: AdConfig = {
    enabled: bool(form, "enabled"),
    network: str(form, "network") || "exoclick",
    providerScript: str(form, "providerScript"),
    consentLine: bool(form, "consentLine"),
    popunder: {
      enabled: bool(form, "popunder.enabled"),
      source: String(form.get("popunder.source")) === "code" ? "code" : "zone",
      zoneId: str(form, "popunder.zoneId"),
      code: String(form.get("popunder.code") ?? "").slice(0, 8000),
      cooldownHours: Math.max(
        1,
        Math.min(168, Number(form.get("popunder.cooldownHours")) || 12),
      ),
    },
    vast: {
      enabled: bool(form, "vast.enabled"),
      tagUrl: str(form, "vast.tagUrl"),
    },
    slots,
  };

  await prisma.setting.upsert({
    where: { key: "ads" },
    update: { value: cfg },
    create: { key: "ads", value: cfg },
  });

  revalidateTag("ad-config");
  revalidatePath("/", "layout");
  revalidatePath("/admin/ads");
}
