import { KeyRound, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PasswordChangeForm } from "@/features/auth/organisms/PasswordChangeForm";
import { SketchblockLogo } from "@/features/home/atoms/SketchblockLogo";
import { requireOwnerPageAuth } from "@/lib/server/auth/owner-session";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const t = await getTranslations("Common");
  const user = await requireOwnerPageAuth("/change-password");

  return <main className="grid min-h-dvh place-items-center bg-muted/30 px-4 py-10">
    <section className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3"><SketchblockLogo className="size-10" variant="onLight" /><div><div className="text-sm font-medium text-muted-foreground">Sketchblock</div><div className="font-semibold">@{user.username}</div></div></div>
      <div className="mt-8 flex items-center gap-2 text-sm font-medium text-primary"><KeyRound aria-hidden="true" />{t("firstLogin")}</div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("setOwnPassword")}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("replaceStartPassword")}</p>
      <PasswordChangeForm />
      <div className="mt-6 flex items-start gap-2 border-t pt-5 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" />{t("startPasswordRevoked")}</div>
    </section>
  </main>;
}
