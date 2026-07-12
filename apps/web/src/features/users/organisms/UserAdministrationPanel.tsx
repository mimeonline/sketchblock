"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Copy, KeyRound, LoaderCircle, Plus, RefreshCcw, UserRoundPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AppUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: "instance_owner" | "user";
  status: "active" | "disabled";
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export function UserAdministrationPanel() {
  const t = useTranslations("Users");
  const locale = useLocale();
  const usernameId = useId();
  const displayNameId = useId();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = (await response.json()) as { users?: AppUser[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t("loadFailed"));
      setUsers(payload.users || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName: displayName || undefined }),
      });
      const payload = (await response.json()) as { user?: AppUser; startPassword?: string; error?: string };
      if (!response.ok || !payload.user || !payload.startPassword) {
        throw new Error(payload.error || t("createFailed"));
      }
      setCredential({ username: payload.user.username, password: payload.startPassword });
      setUsername("");
      setDisplayName("");
      setCreateDialogOpen(false);
      setMessage(t("created", { username: payload.user.username }));
      await loadUsers();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(user: AppUser) {
    const nextStatus = user.status === "active" ? "disabled" : "active";
    await mutateUser(`/api/admin/users/${user.id}/status`, "PATCH", { status: nextStatus }, t(nextStatus === "active" ? "enabled" : "disabled", { username: user.username }));
  }

  async function resetPassword(user: AppUser) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
      const payload = (await response.json()) as { startPassword?: string; error?: string };
      if (!response.ok || !payload.startPassword) throw new Error(payload.error || t("resetFailed"));
      setCredential({ username: user.username, password: payload.startPassword });
      setMessage(t("reset", { username: user.username }));
      await loadUsers();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t("resetFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function mutateUser(path: string, method: string, body: unknown, successMessage: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || t("updateFailed"));
      setMessage(successMessage);
      await loadUsers();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : t("updateFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("localAccounts")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCcw data-icon="inline-start" />
            {t("refresh")}
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <UserRoundPlus data-icon="inline-start" />
              {t("create")}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("create")}</DialogTitle>
                <DialogDescription>{t("createDescription")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={createUser}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={usernameId}>{t("username")}</FieldLabel>
                    <Input id={usernameId} minLength={3} maxLength={64} required value={username} onChange={(event) => setUsername(event.target.value)} />
                    <FieldDescription>{t("usernameHint")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={displayNameId}>{t("displayName")}</FieldLabel>
                    <Input id={displayNameId} maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                    <FieldDescription>{t("displayNameHint")}</FieldDescription>
                  </Field>
                  <Button type="submit" disabled={submitting || username.trim().length < 3}>
                    {submitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
                    {t("create")}
                  </Button>
                </FieldGroup>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error ? <Alert variant="destructive"><AlertTitle>{t("actionFailed")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}

      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader><TableRow><TableHead>{t("user")}</TableHead><TableHead>{t("role")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("lastLogin")}</TableHead><TableHead className="text-right">{t("actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="lg"><AvatarFallback>{initials(entry.displayName || entry.username)}</AvatarFallback></Avatar>
                    <div className="min-w-0"><div className="truncate font-medium">{entry.displayName || entry.username}</div><div className="truncate text-xs text-muted-foreground">@{entry.username}</div></div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{entry.role === "instance_owner" ? "Instance Owner" : t("regularUser")}</Badge></TableCell>
                <TableCell><Badge variant={entry.status === "active" ? "outline" : "destructive"}>{entry.status === "active" ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{entry.lastLoginAt ? formatDateTime(entry.lastLoginAt, locale) : t("never")}</TableCell>
                <TableCell><div className="flex justify-end gap-2">
                  {entry.role !== "instance_owner" ? <Button type="button" size="sm" variant="outline" disabled={submitting} onClick={() => void resetPassword(entry)}><KeyRound data-icon="inline-start" />{t("access")}</Button> : null}
                  {entry.role !== "instance_owner" ? <Button type="button" size="sm" variant={entry.status === "active" ? "destructive" : "outline"} disabled={submitting} onClick={() => void updateStatus(entry)}>{entry.status === "active" ? t("disable") : t("enable")}</Button> : null}
                </div></TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">{t("none")}</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(credential)} onOpenChange={(open) => { if (!open) setCredential(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("savePassword")}</DialogTitle>
            <DialogDescription>{t("passwordDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
            <div className="text-sm font-medium">@{credential?.username}</div>
            <code className="break-all rounded-lg bg-background p-3 text-sm">{credential?.password}</code>
            <Button type="button" variant="outline" onClick={() => credential ? void navigator.clipboard.writeText(credential.password) : undefined}>
              <Copy data-icon="inline-start" />{t("copyPassword")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}
