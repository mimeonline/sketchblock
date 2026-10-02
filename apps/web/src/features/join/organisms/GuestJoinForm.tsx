"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_CODES = ["invalid_name", "guests_disabled", "invalid_invite", "session_closed", "rate_limited"] as const;

export function GuestJoinForm({
  sessionId,
  inviteToken,
  boardTitle,
}: {
  sessionId: string;
  inviteToken: string;
  boardTitle?: string;
}) {
  const t = useTranslations("Guest");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const githubHref = `/api/auth/github/start?returnTo=${encodeURIComponent(`/join/${sessionId}?invite=${inviteToken}`)}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    if (displayName.length < 1 || displayName.length > 40) {
      setError(t("errorinvalid_name"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/claim-guest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invite: inviteToken, displayName }),
      });
      const payload = (await response.json().catch(() => ({}))) as { redirect?: string; code?: string };
      if (response.ok && payload.redirect) {
        router.replace(payload.redirect);
        router.refresh();
        return;
      }
      const code = ERROR_CODES.find((candidate) => candidate === payload.code);
      setError(code ? t(`error${code}`) : t("errorgeneric"));
    } catch {
      setError(t("errorgeneric"));
    }
    setPending(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/35 px-4 py-10 text-foreground">
      <section className="grid w-full max-w-md gap-4 rounded-xl border bg-background p-6 shadow-sm">
        <div className="grid gap-1">
          <h1 className="text-lg font-semibold">{t("joinTitle")}</h1>
          {boardTitle ? <p className="text-sm text-muted-foreground">{boardTitle}</p> : null}
        </div>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="grid gap-2">
            <Label htmlFor="guest-display-name">{t("nameLabel")}</Label>
            <Input
              id="guest-display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              required
              autoComplete="nickname"
              placeholder={t("namePlaceholder")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "guest-error guest-privacy" : "guest-privacy"}
            />
            <p id="guest-privacy" className="text-xs leading-5 text-muted-foreground">{t("privacy")}</p>
          </div>
          {error ? <p id="guest-error" className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? t("submitting") : t("submit")}</Button>
        </form>
        <Link className={buttonVariants({ variant: "link" })} href={githubHref}>{t("signIn")}</Link>
      </section>
    </main>
  );
}
