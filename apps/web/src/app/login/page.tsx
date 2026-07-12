import Image from "next/image";
import { redirect } from "next/navigation";
import { CircleAlert, GitBranch, LockKeyhole } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { LocalCredentialForm } from "@/features/auth/organisms/LocalCredentialForm";
import { SketchblockLogo } from "@/features/home/atoms/SketchblockLogo";
import { cn } from "@/lib/utils";
import { isDevAuthMode } from "@/lib/server/auth/auth-mode";
import { getCurrentOwner } from "@/lib/server/auth/owner-session";
import {
  getCurrentAuthUser,
  sanitizeReturnTo,
} from "@/lib/server/auth/session";
import { hasInstanceOwner } from "@/lib/server/database/instance-owner-store";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    returnTo?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getTranslations("Auth");
  const params = await searchParams;
  const returnTo = sanitizeReturnTo(params.returnTo);
  const errorMessages: Record<string, string> = {
    github_oauth_failed: t("githubOauthFailed"),
    github_oauth_unavailable: t("githubOauthUnavailable"),
    repository_permission: t("repositoryPermission"),
  };
  const errorMessage = params.error ? errorMessages[params.error] : undefined;
  const participantLogin = returnTo.startsWith("/join/");
  if (!isDevAuthMode() && !(await hasInstanceOwner())) {
    redirect("/setup");
  }

  const [participant, owner] = await Promise.all([
    participantLogin ? getCurrentAuthUser() : Promise.resolve(null),
    participantLogin ? Promise.resolve(null) : getCurrentOwner(),
  ]);

  if ((participant || owner) && !errorMessage) {
    redirect(returnTo);
  }

  const loginHref = `/api/auth/github/start?intent=participant&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="flex min-h-dvh flex-col overflow-x-hidden bg-white text-slate-950 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.92fr)]">
      <section className="relative isolate order-2 overflow-hidden bg-[#10244c] px-5 py-10 text-white sm:px-10 sm:py-12 lg:order-1 lg:flex lg:min-h-dvh lg:px-10 lg:py-8 xl:px-14 xl:py-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_10%,rgba(158,230,205,0.18),transparent_34%),linear-gradient(135deg,transparent_45%,rgba(255,255,255,0.05))]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col">
          <div className="hidden items-center gap-3 text-lg font-semibold tracking-tight lg:flex">
            <SketchblockLogo className="size-9" />
            <span>Sketchblock</span>
          </div>

          <div className="max-w-xl lg:mt-10">
            <p className="text-sm font-medium text-[#9ee6cd]">{t("visualWorkspace")}</p>
            <p className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl lg:text-[clamp(2.25rem,3.8vw,3.6rem)]">
              {t("heroTitle")}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
              {t("heroDescription")}
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/78 sm:text-sm">
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#9ee6cd]" />
                {t("collaborateLive")}
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#9ee6cd]" />
                {t("saveInGitHub")}
              </li>
            </ul>
          </div>

          <figure className="mt-8 rounded-2xl border border-white/15 bg-[#081a3a]/80 p-2 shadow-2xl shadow-black/35 lg:mt-auto">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-white lg:h-[clamp(236px,33vh,356px)] lg:aspect-auto">
              <Image
                src="/sketchblock-login-editor.svg"
                alt={t("editorAlt")}
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 54vw"
                className="object-cover object-top"
              />
            </div>
            <figcaption className="sr-only">
              {t("editorCaption")}
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="order-1 flex items-center justify-center px-5 py-8 sm:px-10 sm:py-12 lg:order-2 lg:min-h-dvh lg:px-12 lg:py-10 xl:px-16">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 flex items-center gap-3 text-lg font-semibold tracking-tight text-[#10244c] lg:hidden">
            <SketchblockLogo className="size-9" variant="onLight" />
            <span>Sketchblock</span>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-[#39735f]">
            {participantLogin ? (
              <GitBranch aria-hidden="true" className="size-4" />
            ) : (
              <LockKeyhole aria-hidden="true" className="size-4" />
            )}
            <p>{participantLogin ? t("personalInvite") : t("protectedAccess")}</p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
            {participantLogin ? t("joinSession") : t("openSketchblock")}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            {participantLogin
              ? t("participantDescription")
              : t("ownerDescription")}
          </p>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          ) : null}

          {participantLogin ? (
            <a
              href={loginHref}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-8 h-11 w-full gap-2.5 px-4",
              )}
            >
              <GitBranch aria-hidden="true" className="size-5" />
              {t("continueGitHub")}
            </a>
          ) : (
            <LocalCredentialForm mode="login" returnTo={returnTo} />
          )}

          <div className="mt-6 flex items-start gap-3 border-t border-slate-200 pt-5">
            <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-semibold text-slate-700">
                {participantLogin ? t("inviteRoleTitle") : t("localAccessTitle")}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {participantLogin
                  ? t("inviteRoleDescription")
                  : t("localAccessDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
