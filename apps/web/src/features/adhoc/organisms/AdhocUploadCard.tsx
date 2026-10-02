"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".excalidraw,.json,.png,.svg";
const KNOWN_CODES = ["too_large", "invalid_json", "invalid_board", "too_many_elements", "invalid_file", "rate_limited", "collab_unavailable"];

export class UploadError extends Error {
  constructor(public key: string) {
    super(key);
  }
}

export async function fileToBoardText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".excalidraw") || lower.endsWith(".json")) {
    return file.text();
  }
  if (lower.endsWith(".png") || lower.endsWith(".svg")) {
    const { loadFromBlob } = await import("@excalidraw/excalidraw");
    let scene;
    try {
      scene = await loadFromBlob(file, null, null);
    } catch {
      throw new UploadError("errorNoScene");
    }
    return JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "sketchblock",
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files ?? {},
    });
  }
  throw new UploadError("errorUnsupported");
}

function createEmptyBoard(): string {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "sketchblock",
    elements: [],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  });
}

interface SubmitPayload {
  fileName: string;
  board: string;
}

export function AdhocUploadCard() {
  const t = useTranslations("Adhoc");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const roomNameRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function submitSession(payload: SubmitPayload) {
    setBusy(true);
    try {
      const response = await fetch("/api/adhoc-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string; code?: string };
      if (!response.ok || !data.url) {
        const key = data.code && KNOWN_CODES.includes(data.code) ? `error${data.code}` : "errorgeneric";
        throw new UploadError(key);
      }
      router.push(data.url);
    } catch (caught) {
      setError(t(caught instanceof UploadError ? (caught.key as "errorgeneric") : "errorReadFailed"));
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
    try {
      const board = await fileToBoardText(file);
      await submitSession({ fileName: file.name, board });
    } catch (caught) {
      setError(t(caught instanceof UploadError ? (caught.key as "errorgeneric") : "errorReadFailed"));
      setBusy(false);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleStartEmptyRoom() {
    if (busy) return;
    setError(null);
    const roomName = (roomNameRef.current?.value ?? "").trim();
    const fileName = roomName ? `${roomName}.excalidraw` : "New board.excalidraw";
    await submitSession({ fileName, board: createEmptyBoard() });
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle as="h2" className="text-lg">{t("uploadTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("uploadDescription")}</p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div
          data-testid="adhoc-dropzone"
          className={cn(
            "grid justify-items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors motion-reduce:transition-none",
            dragging ? "border-primary bg-primary/5" : "border-border",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{t("dropZoneLabel")}</p>
          <input
            ref={inputRef}
            accept={ACCEPT}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            className="sr-only"
            data-testid="adhoc-file-input"
            tabIndex={-1}
            type="file"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            disabled={busy}
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t("creating") : t("chooseFile")}
          </Button>
          <p className="text-xs text-muted-foreground" id={hintId}>{t("dropZoneHint")}</p>
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-3 text-sm font-medium">{t("emptyRoomTitle")}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{t("emptyRoomDescription")}</p>
          <div className="grid gap-2">
            <label htmlFor="room-name" className="text-sm font-medium">
              {t("roomNameLabel")}
            </label>
            <Input
              id="room-name"
              ref={roomNameRef}
              placeholder={t("roomNamePlaceholder")}
              maxLength={80}
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleStartEmptyRoom();
                }
              }}
            />
            <Button
              disabled={busy}
              onClick={() => void handleStartEmptyRoom()}
              type="button"
              variant="default"
              data-testid="adhoc-start-room-button"
            >
              {busy ? t("creating") : t("startRoom")}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="text-sm font-medium text-destructive" id={errorId} role="alert">{error}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("retentionHint")}</p>
      </CardContent>
    </Card>
  );
}
