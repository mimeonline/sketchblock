"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  ArrowUpRight,
  FilePenLine,
  FolderOpen,
  ImageOff,
  Layers3,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/features/home/atoms/StatusBadge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  CollaborationSession,
  CollabPresenceClient,
  DrawingContent,
  DrawingFile,
} from "@/types/sketchblock";

const DASHBOARD_BOARD_LIMIT = 6;
const MAX_PREVIEW_ELEMENTS = 600;

type PreviewStatus = "loading" | "ready" | "empty" | "large" | "error";

type BoardGalleryProps = {
  drawings: DrawingFile[];
  loading?: boolean;
  sessions?: CollaborationSession[];
  showAllLink?: boolean;
  title?: string;
  description?: string;
  limit?: number | null;
};

export function BoardGallery({
  drawings,
  loading = false,
  sessions = [],
  showAllLink = true,
  title = "Boards",
  description,
  limit = DASHBOARD_BOARD_LIMIT,
}: BoardGalleryProps) {
  const t = useTranslations("Boards");
  const effectiveDescription = description || t("description");
  const presenceByDrawing = activePresenceByDrawing(sessions);
  const orderedDrawings = [...drawings].sort(
    (left, right) =>
      Number(presenceByDrawing.has(right.path)) - Number(presenceByDrawing.has(left.path)),
  );
  const effectiveLimit = limit === null ? null : Math.max(1, limit);
  const visibleDrawings = effectiveLimit === null
    ? orderedDrawings
    : orderedDrawings.slice(0, effectiveLimit);
  const liveBoardCount = orderedDrawings.filter((drawing) => presenceByDrawing.has(drawing.path)).length;

  return (
    <section aria-labelledby="boards-heading" className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 id="boards-heading" className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {liveBoardCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success-foreground">
                <span
                  className="size-1.5 rounded-full bg-success motion-safe:animate-pulse"
                  aria-hidden="true"
                />
                {liveBoardCount} {liveBoardCount === 1 ? "Live-Board" : "Live-Boards"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{effectiveDescription}</p>
        </div>
        {showAllLink ? (
          <Link
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mr-2 text-primary")}
            href="/drawings"
          >
            {t("all")}
            <ArrowRight aria-hidden="true" data-icon="inline-end" />
          </Link>
        ) : null}
      </div>

      {loading ? (
        <BoardGallerySkeleton />
      ) : visibleDrawings.length === 0 ? (
        <div
          className="grid min-h-64 place-items-center overflow-hidden rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        >
          <div className="grid max-w-md justify-items-center gap-3 rounded-xl bg-background/90 px-6 py-5 shadow-sm backdrop-blur-sm">
            <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <FolderOpen className="size-6" aria-hidden="true" />
            </span>
            <div className="grid gap-1">
              <div className="text-base font-semibold">{t("none")}</div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("scanHint")}
              </p>
            </div>
            <Link
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-1")}
              href="/repositories"
            >
              {t("configureRepository")}
              <ArrowRight aria-hidden="true" data-icon="inline-end" />
            </Link>
            <p className="text-xs text-muted-foreground">
              {t("extensionHint")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleDrawings.map((drawing, index) => (
            <BoardCard
              drawing={drawing}
              index={index}
              key={drawing.path}
              presence={presenceByDrawing.get(drawing.path)}
            />
          ))}
        </div>
      )}

      {!loading && effectiveLimit !== null && drawings.length > effectiveLimit ? (
        <p className="text-xs text-muted-foreground" role="status">
          {t("shown", { visible: effectiveLimit, total: drawings.length })}
          {showAllLink ? t("allHint") : null}
        </p>
      ) : null}
    </section>
  );
}

function BoardGallerySkeleton() {
  const t = useTranslations("Boards");
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label={t("previewsLoading")}
      aria-live="polite"
      role="status"
    >
      {[0, 1, 2].map((index) => (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10" key={index}>
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="grid gap-2 p-4">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-3 w-full" />
            <div className="flex items-center justify-between border-t pt-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BoardCard({
  drawing,
  index,
  presence,
}: {
  drawing: DrawingFile;
  index: number;
  presence?: BoardPresence;
}) {
  const t = useTranslations("Boards");
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("loading");
  const title = drawingTitle(drawing.path);
  const editorHref = `/editor?path=${encodeURIComponent(drawing.path)}`;

  useEffect(() => {
    const controller = new AbortController();
    let idleCallbackId: number | null = null;
    let delayId: number | null = window.setTimeout(() => {
      delayId = null;
      const render = () => {
        void renderPreview(drawing.path, previewRef.current, controller.signal).then((status) => {
          if (!controller.signal.aborted) {
            setPreviewStatus(status);
          }
        });
      };

      if ("requestIdleCallback" in window) {
        idleCallbackId = window.requestIdleCallback(render, { timeout: 1_200 });
      } else {
        render();
      }
    }, index * 90);

    return () => {
      controller.abort();
      if (delayId !== null) {
        window.clearTimeout(delayId);
      }
      if (idleCallbackId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [drawing.path, index]);

  return (
    <Link
      aria-label={t("openEditor", { title })}
      className="group min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      href={editorHref}
    >
      <Card
        className={cn(
          "h-full gap-0 rounded-xl py-0 shadow-sm transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg motion-reduce:transform-none",
          presence
            ? "ring-emerald-300/80 group-hover:ring-emerald-400"
            : "group-hover:ring-primary/35",
        )}
      >
        <div
          className="relative aspect-[16/10] overflow-hidden border-b bg-muted/30"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        >
          <div
            ref={previewRef}
            className="absolute inset-4 grid place-items-center overflow-hidden transition-transform duration-300 group-hover:scale-[1.015] motion-reduce:transform-none"
          />
          {previewStatus !== "ready" ? <PreviewFallback status={previewStatus} /> : null}
          {presence ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-background/95 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur-sm">
              <span
                className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse"
                aria-hidden="true"
              />
              Live
            </span>
          ) : null}
          <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border bg-background/95 text-foreground opacity-90 shadow-sm backdrop-blur-sm transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div className="grid min-w-0 gap-3 p-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight" title={title}>{title}</div>
            <div className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground" title={drawing.path}>
              {drawing.path}
            </div>
          </div>
          <div className="flex min-h-8 min-w-0 items-center justify-between gap-3 border-t pt-3">
            {presence ? (
              <BoardPresenceSummary presence={presence} />
            ) : (
              <>
                <StatusBadge value={drawing.status} />
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground" title={drawing.sha}>
                  SHA {drawing.sha.slice(0, 7)}
                </span>
              </>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

type BoardPresence = {
  count: number;
  clients: CollabPresenceClient[];
};

function BoardPresenceSummary({ presence }: { presence: BoardPresence }) {
  const t = useTranslations("Boards");
  const visibleClients = presence.clients.slice(0, 3);
  const hiddenCount = Math.max(0, presence.count - visibleClients.length);
  const label = presence.count === 1 ? t("oneWorking") : t("manyWorking", { count: presence.count });
  const avatarStyles = [
    "bg-sky-100 text-sky-800",
    "bg-violet-100 text-violet-800",
    "bg-amber-100 text-amber-800",
  ];

  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="truncate text-xs font-medium text-emerald-700">{label}</span>
      <div className="flex shrink-0 -space-x-1.5" aria-label={participantNames(presence, t)}>
        {visibleClients.map((client, index) => (
          <span
            className={cn(
              "grid size-7 place-items-center rounded-full border-2 border-card text-[10px] font-semibold shadow-sm",
              avatarStyles[index % avatarStyles.length],
            )}
            key={client.socketId}
            title={client.displayName || client.userId}
            style={{ zIndex: visibleClients.length - index }}
          >
            {participantInitials(client)}
          </span>
        ))}
        {hiddenCount > 0 ? (
          <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm">
            +{hiddenCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function activePresenceByDrawing(sessions: CollaborationSession[]) {
  const result = new Map<string, BoardPresence>();

  for (const session of sessions) {
    const collab = session.collab;
    const clients = collab?.presence || [];
    const count = Math.max(clients.length, collab?.presenceCount || 0);
    const sessionStatus = collab?.sessionStatus || session.status;

    if (collab?.status !== "registered" || sessionStatus !== "active" || count === 0) {
      continue;
    }

    const current = result.get(session.drawingPath);
    if (!current) {
      result.set(session.drawingPath, { count, clients });
      continue;
    }

    const clientsBySocket = new Map(current.clients.map((client) => [client.socketId, client]));
    clients.forEach((client) => clientsBySocket.set(client.socketId, client));
    const combinedClients = Array.from(clientsBySocket.values());
    result.set(session.drawingPath, {
      clients: combinedClients,
      count: Math.max(combinedClients.length, current.count + count),
    });
  }

  return result;
}

function participantInitials(client: CollabPresenceClient) {
  const name = (client.displayName || client.userId).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function participantNames(presence: BoardPresence, t: ReturnType<typeof useTranslations>) {
  const names = presence.clients.map((client) => client.displayName || client.userId);
  return names.length > 0
    ? t("workingNames", { names: names.join(", ") })
    : t("manyWorking", { count: presence.count });
}

function PreviewFallback({ status }: { status: PreviewStatus }) {
  const t = useTranslations("Boards");
  if (status === "loading") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-muted/90 backdrop-blur-[1px]">
        <div className="grid justify-items-center gap-2">
          <Skeleton className="h-16 w-28 rounded-lg" />
          <span className="text-xs text-muted-foreground">{t("previewLoading")}</span>
        </div>
      </div>
    );
  }

  const large = status === "large";
  const empty = status === "empty";
  const Icon = large ? Layers3 : empty ? FilePenLine : ImageOff;
  const label = large ? t("large") : empty ? t("empty") : t("unavailable");
  const hint = large
    ? t("largeHint")
    : empty
      ? t("emptyHint")
      : t("open");

  return (
    <div className="absolute inset-0 grid place-items-center bg-muted/90 text-muted-foreground backdrop-blur-[1px]">
      <div className="grid justify-items-center gap-2 text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-background text-foreground shadow-sm">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="grid gap-0.5">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-[11px]">{hint}</span>
        </div>
      </div>
    </div>
  );
}

async function renderPreview(path: string, target: HTMLDivElement | null, signal: AbortSignal): Promise<PreviewStatus> {
  if (!target) {
    return "error";
  }

  try {
    const response = await fetch(`/api/drawings/open?path=${encodeURIComponent(path)}`, { signal });
    const payload = (await response.json()) as { drawing?: DrawingContent };
    if (!response.ok || !payload.drawing || signal.aborted) {
      return "error";
    }

    const content = payload.drawing.content;
    const rawElements = sceneElements(content);
    const visibleElementCount = rawElements.filter((element) => !element.isDeleted).length;
    if (visibleElementCount === 0) {
      return "empty";
    }
    if (visibleElementCount > MAX_PREVIEW_ELEMENTS) {
      return "large";
    }

    const { exportToSvg, getNonDeletedElements, restore } = await import("@excalidraw/excalidraw");
    if (signal.aborted) {
      return "error";
    }

    const restored = restore(content as Parameters<typeof restore>[0], null, null);
    const svg = await exportToSvg({
      elements: getNonDeletedElements(restored.elements),
      appState: {
        ...restored.appState,
        exportBackground: true,
        exportWithDarkMode: false,
        viewBackgroundColor: "#ffffff",
      },
      files: restored.files,
      exportPadding: 24,
      renderEmbeddables: false,
      skipInliningFonts: true,
    });
    if (signal.aborted) {
      return "error";
    }

    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-hidden", "true");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.pointerEvents = "none";
    target.replaceChildren(svg);
    return "ready";
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError" ? "loading" : "error";
  }
}

function sceneElements(content: unknown): Array<{ isDeleted?: boolean }> {
  if (!content || typeof content !== "object") {
    return [];
  }

  const elements = (content as { elements?: unknown }).elements;
  return Array.isArray(elements) ? (elements as Array<{ isDeleted?: boolean }>) : [];
}

function drawingTitle(path: string) {
  const fileName = path.split("/").pop() || path;
  const title = fileName.replace(/\.excalidraw$/i, "").replace(/[-_]+/g, " ").trim();
  return title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : "Unbenanntes Board";
}
