"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2, Radio, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BoardGallery } from "@/features/home/organisms/BoardGallery";
import { drawingTitle } from "@/lib/drawing-title";
import { cn } from "@/lib/utils";
import type { CollaborationSession, CollabServerStatus, DrawingFile, RepositoryRecord } from "@/types/sketchblock";

const GITHUB_RECONNECT_HREF = "/api/auth/github/start?intent=owner_connect&returnTo=%2F";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function DashboardView({
  repository,
  drawings,
  sessions,
  collabServerStatus,
  githubConnected,
  loaded,
}: {
  repository: RepositoryRecord | null;
  drawings: DrawingFile[];
  sessions: CollaborationSession[];
  collabServerStatus: CollabServerStatus | null;
  githubConnected: boolean;
  loaded: boolean;
}) {
  const t = useTranslations("Workspace");
  if (!loaded) {
    return (
      <div className="grid gap-8" aria-busy="true">
        <span className="sr-only" role="status" aria-live="polite">{t("loading")}</span>
        <div className="grid min-h-48 gap-5 rounded-2xl border bg-background p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <BoardGallery drawings={[]} loading />
      </div>
    );
  }

  if (!repository) {
    return <WorkspaceOnboarding githubConnected={githubConnected} />;
  }

  const activeSessions = sessions.filter(
    (session) => (session.collab?.sessionStatus || session.status) === "active",
  );
  const activeSession = activeSessions[0] || null;
  const primaryDrawing = activeSession
    ? drawings.find((item) => item.path === activeSession.drawingPath) || drawings[0] || null
    : drawings[0] || null;
  const repositoryReady = repository.provider === "instance" || githubConnected;
  const primaryHref = !repositoryReady
    ? GITHUB_RECONNECT_HREF
    : primaryDrawing
      ? `/editor?path=${encodeURIComponent(primaryDrawing.path)}`
      : "/repositories";

  return (
    <div className="grid gap-8">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-5 py-6 text-primary-foreground shadow-sm sm:px-7 sm:py-7">
        <div className="absolute -right-16 -top-24 size-64 rounded-full bg-white/8" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">
              {activeSession && repositoryReady ? <Radio className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {!repositoryReady ? t("connectionRequired") : activeSession ? t("liveNow") : t("continueWork")}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {!repositoryReady
                ? t("githubReconnectTitle")
                : primaryDrawing ? drawingTitle(primaryDrawing.path) : t("repositoryConnected")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/75">
              {!repositoryReady
                ? t("githubReconnectDescription")
                : primaryDrawing
                  ? activeSession
                  ? t("peopleWorking", { count: activeSession.collab?.presenceCount || 0 })
                  : t("openFirstBoard")
                : t("scanMakesVisible")}
            </p>
          </div>
          <Link
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "h-10 gap-2 bg-background px-4 text-foreground hover:bg-background/90",
            )}
            href={primaryHref}
          >
            {!repositoryReady ? t("reconnectGitHub") : primaryDrawing ? t("openBoard") : t("checkRepository")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </section>

      <WorkspacePulse
        activeSessions={activeSessions.length}
        boardCount={drawings.length}
        collabServerStatus={collabServerStatus}
        repositoryReady={repositoryReady}
        repository={repository}
      />

      {githubConnected || repository?.provider === "instance" ? (
        <BoardGallery drawings={drawings} sessions={sessions} provider={repository?.provider} />
      ) : null}
    </div>
  );
}

function WorkspaceOnboarding({ githubConnected }: { githubConnected: boolean }) {
  const t = useTranslations("Workspace");
  const steps = [
    {
      title: t("connectGitHub"),
      description: t("connectGitHubDescription"),
      complete: githubConnected,
    },
    {
      title: t("chooseRepository"),
      description: t("chooseRepositoryDescription"),
      complete: false,
    },
    {
      title: t("openFirst"),
      description: t("openFirstDescription"),
      complete: false,
    },
  ];
  const activeStepIndex = steps.findIndex((step) => !step.complete);

  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="grid gap-6 px-5 py-7 sm:px-7 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)] lg:items-center lg:py-9">
        <div className="max-w-xl">
          <Badge variant="secondary">{t("firstWorkspace")}</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("onboardingTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("onboardingDescription")}
          </p>
          <Link className={cn(buttonVariants({ size: "lg" }), "mt-6 h-10 gap-2 px-4")} href="/repositories">
            {t("startSetup")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
        <ol className="grid gap-1" aria-label={t("setupSteps")}>
          {steps.map((step, index) => {
            const isActive = index === activeStepIndex;
            return (
              <li
                className="grid grid-cols-[32px_1fr] gap-3 border-b py-3 last:border-b-0"
                aria-current={isActive ? "step" : undefined}
                key={step.title}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-xs font-bold",
                    step.complete
                      ? "bg-success/12 text-success-foreground"
                      : isActive
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.complete ? <CheckCircle2 className="size-4" aria-hidden="true" /> : index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold">{step.title}</div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function WorkspacePulse({
  repository,
  boardCount,
  activeSessions,
  collabServerStatus,
  repositoryReady,
}: {
  repository: RepositoryRecord;
  boardCount: number;
  activeSessions: number;
  collabServerStatus: CollabServerStatus | null;
  repositoryReady: boolean;
}) {
  const t = useTranslations("Workspace");
  const items = [
    { label: "Repository", value: repository.name, note: repository.branch, href: "/repositories" },
    { label: "Boards", value: repositoryReady ? String(boardCount) : "–", note: repositoryReady ? t("activeRepository") : t("connectionRequired"), href: "/drawings" },
    { label: t("liveSessions"), value: String(activeSessions), note: t("currentlyActive"), href: "/sessions" },
    {
      label: t("collaboration"),
      value: collabServerStatus?.reachable ? t("ready") : t("offline"),
      note: collabServerStatus?.reachable ? t("realtimeConnected") : t("checkStatus"),
      href: "/sessions",
    },
  ];

  return (
    <section aria-label={t("workspaceStatus")} className="grid border-y bg-background/65 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          className="group min-w-0 border-b px-4 py-4 transition-colors hover:bg-muted/60 sm:even:border-l lg:border-b-0 lg:border-l lg:first:border-l-0"
          href={item.href}
          key={item.label}
        >
          <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
          <div className="mt-1 flex min-w-0 items-baseline justify-between gap-2">
            <span className="truncate text-xl font-semibold tracking-tight">{item.value}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{item.note}</div>
        </Link>
      ))}
    </section>
  );
}
