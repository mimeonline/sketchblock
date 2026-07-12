import { redirect } from "next/navigation";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SketchblockLogo } from "@/features/home/atoms/SketchblockLogo";
import { LocalCredentialForm } from "@/features/auth/organisms/LocalCredentialForm";
import { getBootstrapTokenStatus } from "@/lib/server/auth/bootstrap";
import { isDevAuthMode } from "@/lib/server/auth/auth-mode";
import { hasInstanceOwner } from "@/lib/server/database/instance-owner-store";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const t = await getTranslations("Auth");
  if (isDevAuthMode()) {
    redirect("/");
  }
  if (await hasInstanceOwner()) {
    redirect("/login");
  }

  const bootstrap = getBootstrapTokenStatus();

  return (
    <main className="flex min-h-dvh flex-col overflow-x-hidden bg-white text-slate-950 lg:grid lg:grid-cols-[minmax(360px,0.86fr)_minmax(0,1.14fr)]">
      <section className="relative isolate order-2 overflow-hidden bg-[#10244c] px-5 py-8 text-white sm:px-10 sm:py-10 lg:order-1 lg:flex lg:min-h-dvh lg:px-10 lg:py-8 xl:px-14 xl:py-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_10%,rgba(158,230,205,0.18),transparent_34%),linear-gradient(135deg,transparent_45%,rgba(255,255,255,0.05))]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col">
          <div className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <SketchblockLogo className="size-9" />
            <span>Sketchblock</span>
          </div>

          <div className="mt-10 lg:mt-12">
            <p className="text-sm font-medium text-[#9ee6cd]">{t("firstSetup")}</p>
            <p className="mt-3 text-3xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-4xl lg:text-[clamp(2.25rem,3.4vw,3.25rem)]">
              {t("setupHeroTitle")}
            </p>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
              {t("setupHeroDescription")}
            </p>
          </div>

          <ol className="mt-8 hidden gap-5 sm:grid" aria-label={t("setupSteps")}>
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#9ee6cd] text-xs font-bold text-[#10244c]">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{t("ownerStep")}</p>
                <p className="mt-1 text-xs leading-5 text-white/62">
                  {t("ownerStepDescription")}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 text-white/65">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/25 text-xs font-semibold">
                2
              </span>
              <div>
                <p className="text-sm font-medium">{t("githubStep")}</p>
                <p className="mt-1 text-xs leading-5 text-white/52">
                  {t("githubStepDescription")}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 text-white/65">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/25 text-xs font-semibold">
                3
              </span>
              <div>
                <p className="text-sm font-medium">{t("boardStep")}</p>
                <p className="mt-1 text-xs leading-5 text-white/52">
                  {t("boardStepDescription")}
                </p>
              </div>
            </li>
          </ol>

          <div className="mt-8 flex items-start gap-3 border-t border-white/15 pt-5 text-sm text-white/76 lg:mt-auto">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#9ee6cd]" />
            <div>
              <p className="font-semibold text-white">{t("secureFirstStart")}</p>
              <p className="mt-1 text-xs leading-5 text-white/62">
                {t("secureFirstStartDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="order-1 flex justify-center px-5 py-9 sm:px-10 sm:py-12 lg:order-2 lg:min-h-dvh lg:items-center lg:px-12 lg:py-10 xl:px-16">
        <div className="w-full max-w-[470px]">
          <div className="mb-9 flex items-center gap-3 text-lg font-semibold tracking-tight text-[#10244c] lg:hidden">
            <SketchblockLogo className="size-9" variant="onLight" />
            <span>Sketchblock</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-[#39735f]">
            <KeyRound aria-hidden="true" className="size-4" />
            <p>{t("stepOne")}</p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
            {t("createLocalOwner")}
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            {bootstrap.generated
              ? t("generatedTokenDescription")
              : (
                  <>
                    {t("configuredTokenBefore")} {" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                      SKETCHBLOCK_BOOTSTRAP_TOKEN
                    </code>{" "}
                    {t("configuredTokenAfter")}
                  </>
                )}
          </p>

          {bootstrap.configured ? (
            <LocalCredentialForm mode="setup" />
          ) : (
            <div
              className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
              role="alert"
            >
              <div className="flex items-center gap-2 font-semibold">
                <KeyRound aria-hidden="true" className="size-4" />
                {t("setupCodeTooShort")}
              </div>
              <p className="mt-2 leading-6 text-amber-900">
                {t("setupCodeTooShortBefore")} {" "}
                <code className="break-all rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                  SKETCHBLOCK_BOOTSTRAP_TOKEN
                </code>{" "}
                {t("setupCodeTooShortAfter", { minimumLength: bootstrap.minimumLength })}
              </p>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 border-t border-slate-200 pt-5">
            <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <p className="text-xs leading-5 text-slate-500">
              {t("passwordStorage")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
