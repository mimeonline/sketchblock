"use client";

import { useEffect, useState } from "react";
import { Switch } from "@base-ui/react/switch";
import { Copy, Eye, Pencil, QrCode, RefreshCw, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ShareRole = "collaborator" | "viewer";

type SessionShareDialogProps = {
  collaboratorHref: string;
  viewerHref: string;
  collaboratorExpiresAt?: string | null;
  viewerExpiresAt?: string | null;
  sessionId?: string;
  allowAnonymousViewers?: boolean;
};

export function SessionShareDialog({
  collaboratorHref,
  viewerHref,
  collaboratorExpiresAt,
  viewerExpiresAt,
  sessionId,
  allowAnonymousViewers = false,
}: SessionShareDialogProps) {
  const t = useTranslations("Share");
  const tGuest = useTranslations("Guest");
  const [guestsAllowed, setGuestsAllowed] = useState(allowAnonymousViewers);
  const [guestError, setGuestError] = useState(false);
  const locale = useLocale();
  const [role, setRole] = useState<ShareRole>("viewer");
  const [rotated, setRotated] = useState<Partial<Record<ShareRole, { href: string; expiresAt: string | null }>>>({});
  const [renewing, setRenewing] = useState<ShareRole | null>(null);
  const [renewState, setRenewState] = useState<ShareRole | "error" | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [copyState, setCopyState] = useState<ShareRole | "error" | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppOrigin(window.location.origin);
  }, []);

  const hrefs: Record<ShareRole, string> = {
    collaborator: rotated.collaborator?.href ?? collaboratorHref,
    viewer: rotated.viewer?.href ?? viewerHref,
  };
  const expiries: Record<ShareRole, string | null | undefined> = {
    collaborator: rotated.collaborator ? rotated.collaborator.expiresAt : collaboratorExpiresAt,
    viewer: rotated.viewer ? rotated.viewer.expiresAt : viewerExpiresAt,
  };
  const urls: Record<ShareRole, string> = {
    collaborator: hrefs.collaborator && appOrigin ? `${appOrigin}${hrefs.collaborator}` : "",
    viewer: hrefs.viewer && appOrigin ? `${appOrigin}${hrefs.viewer}` : "",
  };

  async function handleRenew(shareRole: ShareRole) {
    if (!sessionId) return;
    setRenewing(shareRole);
    setRenewState(null);
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/invites/${shareRole}/rotate`, { method: "POST" });
      const payload = (await response.json()) as { link?: string; expiresAt?: string | null };
      if (!response.ok || !payload.link) throw new Error("rotate_failed");
      setRotated((current) => ({ ...current, [shareRole]: { href: payload.link as string, expiresAt: payload.expiresAt ?? null } }));
      setRenewState(shareRole);
      setCopyState(null);
    } catch {
      setRenewState("error");
    } finally {
      setRenewing(null);
    }
  }

  async function toggleGuests(next: boolean) {
    if (!sessionId) return;
    const previous = guestsAllowed;
    setGuestsAllowed(next);
    setGuestError(false);
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowAnonymousViewers: next }),
      });
      if (!response.ok) throw new Error("settings_failed");
    } catch {
      setGuestsAllowed(previous);
      setGuestError(true);
    }
  }

  function formatExpiry(value: string | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return t("expiresAt", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date) });
  }

  async function handleCopy(shareRole: ShareRole) {
    const copied = await copyText(urls[shareRole]);
    setCopyState(copied ? shareRole : "error");
  }

  function handleRoleChange(value: string | number) {
    if (value === "collaborator" || value === "viewer") {
      setRole(value);
    }
  }

  return (
    <Dialog>
      <DialogTrigger disabled={!collaboratorHref || !viewerHref} render={<Button type="button" variant="outline" />}>
        <QrCode data-icon="inline-start" />
        {t("invite")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogClose
          aria-label={t("close")}
          render={<Button type="button" variant="ghost" size="icon-sm" className="absolute top-2 right-2" />}
        >
          <X aria-hidden="true" />
        </DialogClose>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Tabs value={role} onValueChange={handleRoleChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="viewer">
              <Eye data-icon="inline-start" />
              Viewer
            </TabsTrigger>
            <TabsTrigger value="collaborator">
              <Pencil data-icon="inline-start" />
              Collaborator
            </TabsTrigger>
          </TabsList>
          {(["collaborator", "viewer"] as const).map((shareRole) => (
            <TabsContent key={shareRole} value={shareRole} className="pt-2">
              <div className="mx-auto grid size-52 place-items-center rounded-xl border bg-white p-3">
                <QRCodeSVG
                  bgColor="#ffffff"
                  fgColor="#111827"
                  level="M"
                  size={184}
                  title={t("qrTitle", { role: shareRole === "collaborator" ? "Collaborator" : "Viewer" })}
                  value={urls[shareRole]}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="grid gap-3">
          {(["collaborator", "viewer"] as const).map((shareRole) => {
            const label = shareRole === "collaborator" ? "Collaborator" : "Viewer";
            return (
              <div className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between" key={shareRole}>
                <div className="min-w-0">
                  <Badge variant="secondary">{label}</Badge>
                  <p className="mt-1 text-sm text-muted-foreground">{t(shareRole === "collaborator" ? "collaboratorDescription" : "viewerDescription")}</p>
                  {formatExpiry(expiries[shareRole]) ? (
                    <p className="mt-1 text-xs text-muted-foreground">{formatExpiry(expiries[shareRole])}</p>
                  ) : null}
                  {shareRole === "viewer" && sessionId ? (
                    <div className="mt-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch.Root
                          checked={guestsAllowed}
                          onCheckedChange={(value) => void toggleGuests(value)}
                          className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[checked]:bg-primary motion-reduce:transition-none"
                        >
                          <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-background transition-transform data-[checked]:translate-x-4 motion-reduce:transition-none" />
                        </Switch.Root>
                        <span>{tGuest("allowToggle")}</span>
                      </label>
                      <p className="mt-1 text-xs text-muted-foreground">{tGuest("allowHelp")}</p>
                      {guestError ? <p className="mt-1 text-xs text-destructive" role="alert">{tGuest("settingsFailed")}</p> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sessionId ? (
                    <Button type="button" variant="outline" disabled={renewing !== null} onClick={() => void handleRenew(shareRole)}>
                      <RefreshCw data-icon="inline-start" />
                      {t("renew")}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => void handleCopy(shareRole)}>
                    <Copy data-icon="inline-start" />
                    {copyState === shareRole ? t("copied") : t("copy")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <span className="sr-only" aria-live="polite">
          {renewState === "error" ? t("renewFailed") : renewState ? t("renewed", { role: renewState === "collaborator" ? "Collaborator" : "Viewer" }) : ""}
          {copyState === "error" ? t("copyFailed") : copyState ? t("copyAnnouncement", { role: copyState === "collaborator" ? "Collaborator" : "Viewer" }) : ""}
        </span>
      </DialogContent>
    </Dialog>
  );
}

export async function copyText(value: string) {
  if (!value) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Continue with the browser fallback.
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand?.("copy") ?? false;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
