"use client";

import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

export function AdhocSessionMeta({ expiresAt }: { expiresAt?: string | null }) {
  const t = useTranslations("Adhoc");
  const locale = useLocale();
  const date = expiresAt ? new Date(expiresAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge variant="outline">{t("badge")}</Badge>
      {date ? <span className="text-xs text-muted-foreground">{t("expiresShort", { date })}</span> : null}
    </span>
  );
}
