"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, FilePenLine, RefreshCcw, UsersRound } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/features/home/atoms/StatusBadge";
import { WorkspaceVersionsPanel } from "@/features/workspace/organisms/WorkspaceVersionsPanel";
import { ExcalidrawEditor } from "@/features/home/organisms/ExcalidrawEditor";
import { drawingTitle } from "@/lib/drawing-title";
import { cn } from "@/lib/utils";
import type { DrawingContent, DrawingFile, EditorSaveState, RepositoryRecord } from "@/types/sketchblock";

export function EditorView({
  demoMode,
  drawing,
  repository,
  selectedDrawing,
  saveState,
  onReload,
  onDirty,
  onSave,
  liveSessionHref,
  onStartSession,
}: {
  demoMode: boolean;
  drawing: DrawingContent | null;
  repository: RepositoryRecord | null;
  selectedDrawing: DrawingFile | null;
  saveState: EditorSaveState;
  onReload: () => void;
  onDirty: () => void;
  onSave: (content: unknown) => Promise<void>;
  liveSessionHref?: string | null;
  onStartSession?: () => Promise<void>;
}) {
  const t = useTranslations("Workspace");
  const tInstance = useTranslations("InstanceWorkspace");
  const [startingSession, setStartingSession] = useState(false);
  const hasUnsavedChanges = saveState.status === "dirty" || saveState.status === "stale" || saveState.status === "conflict";
  if (!selectedDrawing) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-background/70 px-5 py-10 text-center">
        <div className="grid max-w-md justify-items-center gap-3">
          <FilePenLine className="size-9 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">{t("chooseBoardTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("chooseBoardDescription")}
            </p>
          </div>
          <Link className={cn(buttonVariants(), "gap-2")} href="/drawings">
            {t("toBoards")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </div>
    );
  }

  if (!drawing) {
    if (saveState.status === "error" || saveState.status === "conflict") {
      return (
        <div className="grid min-h-64 place-items-center rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-10 text-center">
          <div className="grid max-w-md justify-items-center gap-3" role="alert">
            <RefreshCcw className="size-7 text-destructive" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">{t("boardLoadFailed")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {saveState.message || t("checkConnection")}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={onReload}>
              <RefreshCcw data-icon="inline-start" />
              {t("reload")}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid min-h-64 place-items-center rounded-xl border bg-background px-5 py-10 text-center" aria-busy="true">
        <div className="grid justify-items-center gap-3" role="status" aria-live="polite">
          <RefreshCcw className="size-6 animate-spin text-primary" aria-hidden="true" />
          <div className="font-medium">{t("loadingBoard")}</div>
          <p className="text-sm text-muted-foreground">{t("preparingCanvas")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2" aria-label={t("saveStatus")}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="max-w-full truncate font-semibold" title={selectedDrawing.path}>{selectedDrawing.title ?? drawingTitle(selectedDrawing.path)}</span>
          <Badge variant="outline">{repository?.branch || "–"}</Badge>
          <StatusBadge value={saveState.status} />
          <span className="text-xs text-muted-foreground">{saveState.message}</span>
        </div>
        {liveSessionHref ? (
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")} href={liveSessionHref}>
            <UsersRound data-icon="inline-start" />{t("joinLiveSession")}
          </Link>
        ) : onStartSession ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={startingSession || hasUnsavedChanges}
            title={hasUnsavedChanges ? t("saveBeforeSession") : undefined}
            onClick={async () => {
              setStartingSession(true);
              try {
                await onStartSession();
              } finally {
                setStartingSession(false);
              }
            }}
          >
            <UsersRound data-icon="inline-start" />{startingSession ? t("startingSession") : t("collaborateBoard")}
          </Button>
        ) : (
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")} href={`/sessions?path=${encodeURIComponent(selectedDrawing.path)}`}>
            <UsersRound data-icon="inline-start" />{t("collaborateBoard")}
          </Link>
        )}
      </div>
      <ExcalidrawEditor
        key={`${repository?.id}:${repository?.branch}:${selectedDrawing.path}`}
        demoMode={demoMode}
        initialContent={drawing.content}
        saveDisabled={saveState.status === "stale" || saveState.status === "conflict"}
        onDirty={() => {
          if (saveState.status !== "saving") {
            onDirty();
          }
        }}
        onSave={onSave}
        {...(repository?.provider === "instance" && {
          saveLabel: tInstance("saveButtonLabel"),
          hint: tInstance("saveHint"),
        })}
      />
      {repository?.provider === "instance" && drawing.boardId ? (
        <WorkspaceVersionsPanel boardId={drawing.boardId} boardTitle={drawingTitle(selectedDrawing.path)} onRestored={onReload} refreshKey={drawing.sha} />
      ) : null}
      {repository?.provider !== "instance" ? (
        <aside className="min-w-0" aria-label={t("gitDetails")}>
          <div>
            {saveState.status === "stale" || saveState.status === "conflict" || saveState.status === "error" ? (
              <Button className="mb-3" type="button" variant="outline" onClick={onReload}>
                <RefreshCcw data-icon="inline-start" />
                {t("reloadRemote")}
              </Button>
            ) : null}
          </div>
          <Accordion>
            <AccordionItem value="git-details" className="border-b-0">
              <AccordionTrigger className="border-t pt-4 hover:no-underline">{t("gitDetails")}</AccordionTrigger>
              <AccordionContent className="grid gap-3 pt-2">
                <InfoRow label={t("target")} value={t(demoMode ? "demoSaveTarget" : "commitPush")} />
                {saveState.commitSha && !demoMode ? <InfoRow label={t("lastCommit")} value={saveState.commitSha.slice(0, 7)} mono /> : null}
                <InfoRow label="Board" value={selectedDrawing.path} mono />
                <InfoRow label="Base SHA" value={saveState.baseSha || selectedDrawing.sha} mono />
                <InfoRow label="Remote SHA" value={saveState.remoteSha || selectedDrawing.sha} mono />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs"><span className="text-muted-foreground">{label}</span><span className={cn("break-all", mono && "font-mono")}>{value}</span></div>;
}
