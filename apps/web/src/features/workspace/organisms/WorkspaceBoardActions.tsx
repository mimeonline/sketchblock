"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { FilePlus2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileToBoardText } from "@/features/adhoc/organisms/AdhocUploadCard";

const MAX_BYTES = 10 * 1024 * 1024;

async function createBoard(title: string, board?: string): Promise<string> {
  const response = await fetch("/api/workspace/boards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(board === undefined ? { title } : { title, board }),
  });
  const payload = (await response.json().catch(() => ({}))) as { board?: { path: string }; code?: string };
  if (!response.ok || !payload.board) {
    throw new Error(payload.code ?? "generic");
  }
  return payload.board.path;
}

/** "New board" and "Upload" actions of the instance workspace boards view. */
export function WorkspaceBoardActions() {
  const t = useTranslations("InstanceWorkspace");
  const inputRef = useRef<HTMLInputElement>(null);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(path: string) {
    // Full navigation so the workspace state is reloaded from the server.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/editor?path=${encodeURIComponent(path)}`);
  }

  function messageFor(code: string) {
    if (code === "too_large") return t("errorTooLarge");
    if (["invalid_json", "invalid_board", "too_many_elements", "invalid_file"].includes(code)) return t("errorInvalid");
    return t("errorGeneric");
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      open(await createBoard(title.trim()));
    } catch (caught) {
      setError(messageFor(caught instanceof Error ? caught.message : "generic"));
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("errorTooLarge"));
      return;
    }
    setBusy(true);
    try {
      let board: string;
      try {
        board = await fileToBoardText(file);
      } catch {
        throw new Error("read_failed");
      }
      const name = file.name.replace(/\.[^./\\]*$/, "").trim() || "board";
      open(await createBoard(name, board));
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "generic";
      setError(code === "read_failed" ? t("errorReadFailed") : messageFor(code));
      setBusy(false);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="mb-5 grid gap-3 rounded-lg border bg-background p-4" aria-label={t("newBoard")}>
      <p className="text-sm text-muted-foreground">{t("workspaceHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {naming ? (
          <form className="flex flex-wrap items-center gap-2" onSubmit={handleCreate}>
            <Input
              aria-label={t("newBoardTitle")}
              autoFocus
              className="w-56"
              maxLength={120}
              placeholder={t("newBoardPlaceholder")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Button disabled={busy || !title.trim()} type="submit">
              {busy ? t("creating") : t("create")}
            </Button>
            <Button disabled={busy} type="button" variant="ghost" onClick={() => setNaming(false)}>
              {t("cancel")}
            </Button>
          </form>
        ) : (
          <Button disabled={busy} type="button" onClick={() => setNaming(true)}>
            <FilePlus2 data-icon="inline-start" />
            {t("newBoard")}
          </Button>
        )}
        <input
          ref={inputRef}
          accept=".excalidraw,.json,.png,.svg"
          className="sr-only"
          data-testid="workspace-file-input"
          tabIndex={-1}
          type="file"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <Button disabled={busy} type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload data-icon="inline-start" />
          {busy && !naming ? t("uploading") : t("upload")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("uploadHint")}</p>
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">{error}</p>
      ) : null}
    </section>
  );
}
