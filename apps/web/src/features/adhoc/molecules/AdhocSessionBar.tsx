"use client";

import { Menu } from "@base-ui/react/menu";
import { Switch } from "@base-ui/react/switch";
import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Format = "excalidraw" | "png" | "svg";

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AdhocSessionBar({
  sessionId,
  isOwner,
  title,
  expiresAt,
  participantDownload,
  inviteToken,
  onParticipantDownloadChange,
}: {
  sessionId: string;
  isOwner: boolean;
  title?: string | null;
  expiresAt?: string | null;
  participantDownload?: boolean;
  inviteToken?: string;
  onParticipantDownloadChange?: (value: boolean) => void;
}) {
  const t = useTranslations("Adhoc");
  const locale = useLocale();
  const [allowed, setAllowed] = useState(Boolean(participantDownload));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canDownload = isOwner || Boolean(participantDownload);
  const date = expiresAt ? new Date(expiresAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : null;
  const baseName = (title || "sketchblock").replace(/\.(excalidraw|json)$/i, "") || "sketchblock";

  async function download(format: Format) {
    setError(null);
    setBusy(true);
    try {
      const query = inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : "";
      const response = await fetch(`/api/sessions/${sessionId}/export${query}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { code?: string };
        throw new Error(payload.code === "download_disabled" ? t("downloadDisabled") : t("downloadFailed"));
      }
      if (format === "excalidraw") {
        triggerDownload(await response.blob(), `${baseName}.excalidraw`);
        return;
      }
      const scene = (await response.json()) as { elements?: unknown[]; appState?: Record<string, unknown>; files?: unknown };
      const lib = await import("@excalidraw/excalidraw");
      const elements = (scene.elements ?? []) as never;
      const appState = { ...(scene.appState ?? {}), exportBackground: true } as never;
      const files = (scene.files ?? {}) as never;
      if (format === "png") {
        triggerDownload(await lib.exportToBlob({ elements, appState, files, mimeType: "image/png" }), `${baseName}.png`);
      } else {
        const svg = await lib.exportToSvg({ elements, appState, files });
        triggerDownload(new Blob([svg.outerHTML], { type: "image/svg+xml" }), `${baseName}.svg`);
      }
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : t("downloadFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(next: boolean) {
    setError(null);
    const previous = allowed;
    setAllowed(next);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantDownload: next }),
      });
      if (!response.ok) throw new Error("failed");
      onParticipantDownloadChange?.(next);
    } catch {
      setAllowed(previous);
      setError(t("settingsFailed"));
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-2 text-sm shadow-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="outline">{t("badge")}</Badge>
        {date ? <span className="text-muted-foreground">{t("expires", { date })}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {isOwner ? (
          <label className="flex items-center gap-2">
            <Switch.Root
              aria-label={t("participantDownload")}
              checked={allowed}
              onCheckedChange={(value) => void toggle(value)}
              className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[checked]:bg-primary motion-reduce:transition-none"
            >
              <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-background transition-transform data-[checked]:translate-x-4 motion-reduce:transition-none" />
            </Switch.Root>
            <span>{t("participantDownload")}</span>
          </label>
        ) : null}
        {canDownload ? (
          <Menu.Root>
            <Menu.Trigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))} disabled={busy}>
              <Download data-icon="inline-start" aria-hidden="true" />
              {t("download")}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={4}>
                <Menu.Popup className="z-50 min-w-48 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
                  {(
                    [
                      ["excalidraw", t("downloadExcalidraw")],
                      ["png", t("downloadPng")],
                      ["svg", t("downloadSvg")],
                    ] as const
                  ).map(([format, label]) => (
                    <Menu.Item
                      key={format}
                      className="cursor-default rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      onClick={() => void download(format)}
                    >
                      {label}
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
      </div>
      {error ? <p className="w-full text-xs font-medium text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
