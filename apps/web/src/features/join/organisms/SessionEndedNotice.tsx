import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CircleStop } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export async function SessionEndedNotice({ showSessionsLink }: { showSessionsLink: boolean }) {
  const t = await getTranslations("Workspace");

  return (
    <main className="grid min-h-screen place-items-center bg-muted/35 px-4 py-10 text-foreground">
      <section className="grid max-w-md justify-items-center gap-3 rounded-xl border bg-background px-6 py-10 text-center shadow-sm" role="status">
        <CircleStop className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold">{t("sessionEnded")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{t("sessionEndedDescription")}</p>
        {showSessionsLink ? (
          <Link className={buttonVariants({ variant: "outline" })} href="/sessions">{t("backToSessions")}</Link>
        ) : null}
      </section>
    </main>
  );
}
