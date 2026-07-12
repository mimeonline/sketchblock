import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "de"] as const;
export type AppLocale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get("sketchblock_locale")?.value;
  const locale: AppLocale = storedLocale === "de" || storedLocale === "en"
    ? storedLocale
    : "en";

  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
