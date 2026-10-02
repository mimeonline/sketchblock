"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { History, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Version = { revision: number; createdAt: string; message: string | null };

/** Version history, restore, rename and delete for an instance workspace board. */
export function WorkspaceVersionsPanel({
  boardId,
  boardTitle,
  onRestored,
  refreshKey,
}: {
  boardId: string;
  boardTitle: string;
  onRestored: () => void;
  refreshKey?: string;
}) {
  const t = useTranslations("InstanceWorkspace");
  const format = useFormatter();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [currentRevision, setCurrentRevision] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRevision, setBusyRevision] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspace/boards/${boardId}/versions`, { cache: "no-store" });
      const payload = (await response.json()) as { versions?: Version[]; currentRevision?: number };
      if (!response.ok || !payload.versions) throw new Error("load");
      setVersions(payload.versions);
      setCurrentRevision(payload.currentRevision ?? null);
      setError(null);
    } catch {
      setError(t("versionsLoadFailed"));
    }
  }, [boardId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  async function restore(revision: number) {
    if (!window.confirm(t("restoreConfirm", { revision }))) return;
    setBusyRevision(revision);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/boards/${boardId}/versions/${revision}/restore`, { method: "POST" });
      if (!response.ok) throw new Error("restore");
      await load();
      onRestored();
    } catch {
      setError(t("restoreFailed"));
    } finally {
      setBusyRevision(null);
    }
  }

  async function rename() {
    const title = window.prompt(t("renamePrompt"), boardTitle)?.trim();
    if (!title || title === boardTitle) return;
    setError(null);
    const response = await fetch(`/api/workspace/boards/${boardId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const payload = (await response.json().catch(() => ({}))) as { board?: { path: string }; error?: string };
    if (!response.ok || !payload.board) {
      setError(payload.error || t("renameFailed"));
      return;
    }
    // Full navigation so the workspace state is reloaded from the server.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/editor?path=${encodeURIComponent(payload.board.path)}`);
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setError(null);
    const response = await fetch(`/api/workspace/boards/${boardId}`, { method: "DELETE" });
    if (!response.ok) {
      setError(t("deleteFailed"));
      return;
    }
    // Full navigation so the workspace state is reloaded from the server.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/drawings");
  }

  return (
    <section className="grid gap-3 rounded-lg border bg-background p-3" aria-label={t("versionsTitle")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4" aria-hidden="true" />
          {t("versionsTitle")}
        </h2>
        <div className="flex gap-2">
          <Button size="sm" type="button" variant="outline" onClick={() => void rename()}>
            <Pencil data-icon="inline-start" />{t("rename")}
          </Button>
          <Button size="sm" type="button" variant="outline" onClick={() => void remove()}>
            <Trash2 data-icon="inline-start" />{t("delete")}
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm font-medium text-destructive" role="alert">{error}</p> : null}
      {versions === null && !error ? <p className="text-sm text-muted-foreground">{t("loadingVersions")}</p> : null}
      {versions?.length === 0 ? <p className="text-sm text-muted-foreground">{t("versionsEmpty")}</p> : null}
      <ul className="grid gap-2">
        {versions?.map((version) => (
          <li className="flex flex-wrap items-center justify-between gap-2 text-sm" key={version.revision}>
            <span className="min-w-0">
              <span className="font-medium">{t("revision", { revision: version.revision })}</span>
              {version.revision === currentRevision ? <span className="ml-2 text-xs text-muted-foreground">{t("current")}</span> : null}
              <span className="block text-xs text-muted-foreground">
                {format.dateTime(new Date(version.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                {version.message ? ` · ${version.message}` : ""}
              </span>
            </span>
            {version.revision !== currentRevision ? (
              <Button
                disabled={busyRevision !== null}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => void restore(version.revision)}
              >
                <RotateCcw data-icon="inline-start" />
                {busyRevision === version.revision ? t("restoring") : t("restore")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
