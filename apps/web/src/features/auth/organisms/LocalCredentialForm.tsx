"use client";

import { useId, useState } from "react";
import { CircleAlert, KeyRound, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LocalCredentialFormProps =
  | {
      mode: "login";
      returnTo: string;
    }
  | {
      mode: "setup";
      returnTo?: never;
    };

export function LocalCredentialForm(props: LocalCredentialFormProps) {
  const t = useTranslations("Auth");
  const formId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordsMismatch = error === t("passwordMismatch");

  const bootstrapTokenId = `${formId}-bootstrap-token`;
  const bootstrapTokenHintId = `${bootstrapTokenId}-hint`;
  const usernameId = `${formId}-username`;
  const usernameHintId = `${usernameId}-hint`;
  const passwordId = `${formId}-password`;
  const passwordHintId = `${passwordId}-hint`;
  const confirmationId = `${formId}-password-confirmation`;
  const errorId = `${formId}-error`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (props.mode === "setup" && password !== confirmation) {
      setError(t("passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(props.mode === "setup" ? "/api/setup" : "/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          props.mode === "setup"
            ? { bootstrapToken, username, password }
            : { username, password },
        ),
      });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        setError(payload.error || t("loginFailed"));
        return;
      }

      window.location.assign(
        props.mode === "setup" ? payload.redirectTo || "/repositories" : payload.redirectTo || props.returnTo,
      );
    } catch {
      setError(t("unavailable"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      aria-busy={submitting}
      aria-describedby={error ? errorId : undefined}
      className="mt-8 grid gap-5"
      onSubmit={handleSubmit}
    >
      {props.mode === "setup" ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-900" htmlFor={bootstrapTokenId}>
            {t("setupCode")}
          </label>
          <Input
            aria-describedby={bootstrapTokenHintId}
            autoComplete="one-time-code"
            autoCapitalize="none"
            className="h-11 bg-white px-3"
            disabled={submitting}
            id={bootstrapTokenId}
            name="bootstrapToken"
            onChange={(event) => setBootstrapToken(event.target.value)}
            required
            spellCheck={false}
            type="password"
            value={bootstrapToken}
          />
          <p className="text-xs leading-5 text-slate-500" id={bootstrapTokenHintId}>
            {t("setupCodeHint")}
          </p>
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-900" htmlFor={usernameId}>
          {t("username")}
        </label>
        <Input
          aria-describedby={props.mode === "setup" ? usernameHintId : undefined}
          autoComplete="username"
          autoCapitalize="none"
          className="h-11 bg-white px-3"
          disabled={submitting}
          id={usernameId}
          maxLength={64}
          minLength={3}
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          required
          spellCheck={false}
          value={username}
        />
        {props.mode === "setup" ? (
          <p className="text-xs leading-5 text-slate-500" id={usernameHintId}>
            {t("usernameHint")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-900" htmlFor={passwordId}>
          {t("password")}
        </label>
        <Input
          aria-describedby={props.mode === "setup" ? passwordHintId : undefined}
          autoComplete={props.mode === "setup" ? "new-password" : "current-password"}
          className="h-11 bg-white px-3"
          disabled={submitting}
          id={passwordId}
          maxLength={128}
          minLength={12}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {props.mode === "setup" ? (
          <p className="text-xs leading-5 text-slate-500" id={passwordHintId}>
            {t("passwordHint")}
          </p>
        ) : null}
      </div>

      {props.mode === "setup" ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-900" htmlFor={confirmationId}>
            {t("confirmPassword")}
          </label>
          <Input
            aria-describedby={passwordsMismatch ? errorId : undefined}
            aria-invalid={passwordsMismatch}
            autoComplete="new-password"
            className="h-11 bg-white px-3"
            disabled={submitting}
            id={confirmationId}
            maxLength={128}
            minLength={12}
            name="passwordConfirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            required
            type="password"
            value={confirmation}
          />
        </div>
      ) : null}

      {error ? (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
          id={errorId}
          role="alert"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <Button className="mt-1 h-11 w-full gap-2" disabled={submitting} size="lg" type="submit">
        {submitting ? (
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        ) : (
          <KeyRound aria-hidden="true" className="size-5" />
        )}
        <span aria-live="polite">
          {submitting
            ? props.mode === "setup"
              ? t("creatingOwner")
              : t("signingIn")
            : props.mode === "setup"
              ? t("createOwner")
              : t("openSketchblock")}
        </span>
      </Button>
    </form>
  );
}
