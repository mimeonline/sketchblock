"use client";

import { useMemo, useState } from "react";
import { GitBranch, LoaderCircle, LockKeyhole, Search } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { Input } from "@/components/ui/input";
import type {
  AvailableGitHubRepository,
  DrawingFile,
  RepositoryRecord,
} from "@/types/sketchblock";

type RepositoryPickerDialogProps = {
  onSelected: (repository: RepositoryRecord, drawings: DrawingFile[]) => void;
  connectedRepositoryIds?: number[];
};

export function RepositoryPickerDialog({ onSelected, connectedRepositoryIds = [] }: RepositoryPickerDialogProps) {
  const t = useTranslations("RepositoryPicker");
  const [open, setOpen] = useState(false);
  const [repositories, setRepositories] = useState<AvailableGitHubRepository[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const filteredRepositories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return repositories.filter((repository) => {
      const isConnected = connectedRepositoryIds.includes(repository.githubRepositoryId);
      const matchesQuery = !normalizedQuery || repository.fullName.toLowerCase().includes(normalizedQuery);
      return !isConnected && matchesQuery;
    });
  }, [connectedRepositoryIds, query, repositories]);

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || repositories.length > 0 || loading) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/repositories/available", { cache: "no-store" });
      const payload = (await response.json()) as {
        repositories?: AvailableGitHubRepository[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || t("loadFailed"));
      }
      setRepositories(payload.repositories || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(repository: AvailableGitHubRepository) {
    setSelectingId(repository.githubRepositoryId);
    setError("");
    try {
      const response = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubRepositoryId: repository.githubRepositoryId }),
      });
      const payload = (await response.json()) as {
        repository?: RepositoryRecord;
        drawings?: DrawingFile[];
        error?: string;
      };
      if (!response.ok || !payload.repository) {
        throw new Error(payload.error || t("selectFailed"));
      }
      onSelected(payload.repository, payload.drawings || []);
      setOpen(false);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : t("selectFailed"));
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <GitBranch data-icon="inline-start" />
        {t("add")}
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(720px,calc(100dvh-2rem))] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            className="pl-9"
            aria-label={t("search")}
          />
        </div>

        {error ? (
          <div role="alert" className="shrink-0 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-destructive">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t("loading")}
            </div>
          ) : filteredRepositories.length > 0 ? (
            <div className="divide-y">
              {filteredRepositories.map((repository) => (
                <button
                  type="button"
                  key={repository.githubRepositoryId}
                  onClick={() => handleSelect(repository)}
                  disabled={selectingId !== null}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none disabled:opacity-60"
                >
                  <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{repository.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t("defaultBranch", { branch: repository.branch })}
                    </span>
                  </span>
                  {repository.private ? (
                    <Badge variant="outline" className="gap-1">
                      <LockKeyhole className="size-3" />
                      {t("private")}
                    </Badge>
                  ) : null}
                  {selectingId === repository.githubRepositoryId ? (
                    <LoaderCircle className="size-4 animate-spin" aria-label={t("scanning")} />
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {repositories.length === 0
                ? t("noneWritable")
                : connectedRepositoryIds.length === repositories.length
                  ? t("allConnected")
                  : t("noMatch")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
