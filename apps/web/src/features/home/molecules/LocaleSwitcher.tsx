"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("Settings");
  const [pending, setPending] = useState(false);

  async function changeLocale(value: string | null) {
    if (value !== "en" && value !== "de") return;
    setPending(true);
    try {
      const response = await fetch("/api/preferences/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: value }),
      });
      if (!response.ok) throw new Error("Could not persist locale.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor="locale-switcher">{t("language")}</label>
      <p className="text-sm text-muted-foreground">{t("languageDescription")}</p>
      <Select value={locale} onValueChange={changeLocale} disabled={pending}>
        <SelectTrigger id="locale-switcher" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t("english")}</SelectItem>
          <SelectItem value="de">{t("german")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
