"use client";

import { useId, useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function PasswordChangeForm() {
  const t = useTranslations("Auth");
  const currentId = useId();
  const nextId = useId();
  const confirmationId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) {
      setError(t("newPasswordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/local/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(payload.error || t("passwordChangeFailed"));
      window.location.assign(payload.redirectTo || "/");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : t("passwordChangeFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return <form onSubmit={submit} className="mt-8"><FieldGroup>
    <Field><FieldLabel htmlFor={currentId}>{t("currentPassword")}</FieldLabel><Input id={currentId} type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
    <Field><FieldLabel htmlFor={nextId}>{t("newPassword")}</FieldLabel><Input id={nextId} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><FieldDescription>{t("shortPasswordHint")}</FieldDescription></Field>
    <Field data-invalid={Boolean(error)}><FieldLabel htmlFor={confirmationId}>{t("confirmNewPassword")}</FieldLabel><Input id={confirmationId} type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-invalid={Boolean(error)} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />{error ? <FieldError>{error}</FieldError> : null}</Field>
    <Button type="submit" disabled={submitting}>{submitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <KeyRound data-icon="inline-start" />}{submitting ? t("changingPassword") : t("changePassword")}</Button>
  </FieldGroup></form>;
}
