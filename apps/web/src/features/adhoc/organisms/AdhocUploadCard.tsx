"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".excalidraw,.json,.png,.svg";
const KNOWN_CODES = ["too_large", "invalid_json", "invalid_board", "too_many_elements", "invalid_file", "rate_limited", "collab_unavailable"];

class UploadError extends Error {
  constructor(public key: string) {
    super(key);
  }
}

async function fileToBoardText(file: File): Promise<string> {
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

export function AdhocUploadCard() {
  const t = useTranslations("Adhoc");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("errorTooLarge"));
      return;
    }
    setBusy(true);
    try {
      const board = await fileToBoardText(file);
      const response = await fetch("/api/adhoc-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, board }),
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; code?: string };
      if (!response.ok || !payload.url) {
        const key = payload.code && KNOWN_CODES.includes(payload.code) ? `error${payload.code}` : "errorgeneric";
        throw new UploadError(key);
      }
      router.push(payload.url);
    } catch (caught) {
      setError(t(caught instanceof UploadError ? (caught.key as "errorgeneric") : "errorReadFailed"));
      setBusy(false);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle as="h2" className="text-lg">{t("uploadTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("uploadDescription")}</p>
      </CardHeader>
      <CardContent className="grid gap-3">
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
        {error ? (
          <p className="text-sm font-medium text-destructive" id={errorId} role="alert">{error}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("retentionHint")}</p>
      </CardContent>
    </Card>
  );
}
