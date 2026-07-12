"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, Pencil, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
};

export function SessionShareDialog({
  collaboratorHref,
  viewerHref,
}: SessionShareDialogProps) {
  const t = useTranslations("Share");
  const [role, setRole] = useState<ShareRole>("collaborator");
  const [appOrigin, setAppOrigin] = useState("");
  const [copyState, setCopyState] = useState<ShareRole | "error" | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppOrigin(window.location.origin);
  }, []);

  const urls: Record<ShareRole, string> = {
    collaborator: collaboratorHref && appOrigin ? `${appOrigin}${collaboratorHref}` : "",
    viewer: viewerHref && appOrigin ? `${appOrigin}${viewerHref}` : "",
  };

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Tabs value={role} onValueChange={handleRoleChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="collaborator">
              <Pencil data-icon="inline-start" />
              Collaborator
            </TabsTrigger>
            <TabsTrigger value="viewer">
              <Eye data-icon="inline-start" />
              Viewer
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
                </div>
                <Button type="button" variant="outline" onClick={() => void handleCopy(shareRole)}>
                  <Copy data-icon="inline-start" />
                  {copyState === shareRole ? t("copied") : t("copy")}
                </Button>
              </div>
            );
          })}
        </div>
        <span className="sr-only" aria-live="polite">
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
