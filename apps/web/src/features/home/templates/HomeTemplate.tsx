"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleStop,
  FilePenLine,
  FolderGit2,
  GitBranch,
  List,
  Play,
  Radio,
  RefreshCcw,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/features/home/atoms/StatusBadge";
import { useCollabPresence } from "@/features/home/hooks/useCollabPresence";
import { AppSidebar } from "@/features/home/molecules/AppSidebar";
import { RepositorySwitcher } from "@/features/home/molecules/RepositorySwitcher";
import { LocaleSwitcher } from "@/features/home/molecules/LocaleSwitcher";
import { BoardGallery } from "@/features/home/organisms/BoardGallery";
import { ExcalidrawEditor } from "@/features/home/organisms/ExcalidrawEditor";
import { RepositoryPickerDialog } from "@/features/home/organisms/RepositoryPickerDialog";
import { SessionShareDialog } from "@/features/home/organisms/SessionShareDialog";
import type { HomeView } from "@/features/home/types/home-view";
import { UserAdministrationPanel } from "@/features/users/organisms/UserAdministrationPanel";
import { SystemStatusPanel } from "@/features/system/organisms/SystemStatusPanel";
import { cn } from "@/lib/utils";
import type {
  CollaborationSession,
  CollaborationSessionSnapshot,
  CollabServerStatus,
  DrawingContent,
  DrawingFile,
  EditorSaveState,
  RepositoryRecord,
  SessionAuditEvent,
  SessionLifecycleStatus,
  SessionRole,
  SessionSaveResult,
} from "@/types/sketchblock";

const initialSaveState: EditorSaveState = {
  status: "loading",
};

const DASHBOARD_PRESENCE_REFRESH_MS = 3_000;

type NoticeTone = "info" | "success" | "warning" | "error";
type Notice = { tone: NoticeTone; message: string };

const noticeToneClasses: Record<NoticeTone, string> = {
  info: "border-info/20 bg-info/8 text-info-foreground",
  success: "border-success/25 bg-success/8 text-success-foreground",
  warning: "border-warning/25 bg-warning/10 text-warning-foreground",
  error: "border-destructive/25 bg-destructive/8 text-destructive",
};

export type SessionUser = {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: "instance_owner" | "user";
};

type HomeTemplateProps = {
  view: HomeView;
  initialPath?: string;
  user: SessionUser;
};

export function HomeTemplate({ view, initialPath = "", user }: HomeTemplateProps) {
  const tView = useTranslations("Views");
  const t = useTranslations("Workspace");
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [activeRepositoryId, setActiveRepositoryId] = useState("");
  const [switchingRepository, setSwitchingRepository] = useState(false);
  const [drawings, setDrawings] = useState<DrawingFile[]>([]);
  const [sessions, setSessions] = useState<CollaborationSession[]>([]);
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [drawing, setDrawing] = useState<DrawingContent | null>(null);
  const [notice, setNotice] = useState<Notice>({
    tone: "info",
    message: t("connectRepository"),
  });
  const [saveState, setSaveState] = useState<EditorSaveState>(initialSaveState);
  const [collabServerStatus, setCollabServerStatus] = useState<CollabServerStatus | null>(null);
  const [githubConnected, setGitHubConnected] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editorReloadKey, setEditorReloadKey] = useState(0);

  const activeRepository = repositories.find((repository) => repository.id === activeRepositoryId) || repositories[0] || null;
  const selectedDrawing = useMemo(
    () => drawings.find((item) => item.path === selectedPath) || drawings[0] || null,
    [drawings, selectedPath],
  );
  const selectedDrawingPath = selectedDrawing?.path || "";
  const selectedDrawingSha = selectedDrawing?.sha || "";
  const effectiveSaveState = useMemo<EditorSaveState>(() => {
    if (
      view === "editor" &&
      selectedDrawingSha &&
      saveState.baseSha &&
      selectedDrawingSha !== saveState.baseSha &&
      saveState.status !== "loading" &&
      saveState.status !== "saving" &&
      saveState.status !== "conflict"
    ) {
      return {
        ...saveState,
        status: "stale",
        remoteSha: selectedDrawingSha,
        message: t("boardStale"),
      };
    }

    return saveState;
  }, [saveState, selectedDrawingSha, t, view]);
  const labels = {
    title: tView(`${view}.title`),
    subtitle: tView(`${view}.subtitle`),
  };

  async function refreshState() {
    try {
      const [repositoryResponse, drawingsResponse, sessionsResponse] = await Promise.all([
        fetch("/api/repositories"),
        fetch("/api/drawings"),
        fetch("/api/sessions"),
      ]);
      const repositoryPayload = (await repositoryResponse.json()) as {
        repositories?: RepositoryRecord[];
        activeRepository?: RepositoryRecord | null;
        githubConnected?: boolean;
        demoMode?: boolean;
        error?: string;
      };
      const drawingPayload = (await drawingsResponse.json()) as {
        repository?: RepositoryRecord;
        drawings?: DrawingFile[];
        error?: string;
      };
      const sessionPayload = (await sessionsResponse.json()) as {
        sessions?: CollaborationSession[];
        collabServer?: CollabServerStatus;
        error?: string;
      };

      const nextRepositories = repositoryPayload.repositories || [];
      setRepositories(nextRepositories);
      setActiveRepositoryId(repositoryPayload.activeRepository?.id || drawingPayload.repository?.id || "");
      setDrawings(drawingPayload.drawings || []);
      setSessions(sessionPayload.sessions || []);
      setCollabServerStatus(sessionPayload.collabServer || null);
      setGitHubConnected(Boolean(repositoryPayload.githubConnected));
      setDemoMode(Boolean(repositoryPayload.demoMode));

      const nextDrawings = drawingPayload.drawings || [];
      if (!selectedPath && nextDrawings[0]) {
        setSelectedPath(nextDrawings[0].path);
      }

      const refreshError = repositoryPayload.error || drawingPayload.error || sessionPayload.error;
      setNotice(
        refreshError
          ? { tone: "error", message: refreshError }
          : { tone: "info", message: t("synchronized") },
      );
    } catch {
      setNotice({
        tone: "error",
        message: t("loadFailed"),
      });
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view !== "dashboard" && view !== "sessions") {
      return;
    }

    let active = true;
    let refreshInFlight = false;

    async function refreshDashboardPresence() {
      if (refreshInFlight) {
        return;
      }

      refreshInFlight = true;
      try {
        const response = await fetch("/api/sessions", { cache: "no-store" });
        const payload = (await response.json()) as {
          sessions?: CollaborationSession[];
          collabServer?: CollabServerStatus;
        };

        if (active && response.ok) {
          setSessions(payload.sessions || []);
          setCollabServerStatus(payload.collabServer || null);
        }
      } catch {
        // Keep the last known collaboration state during a transient refresh failure.
      } finally {
        refreshInFlight = false;
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshDashboardPresence();
      }
    }, DASHBOARD_PRESENCE_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshDashboardPresence();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [view]);

  useEffect(() => {
    async function loadDrawing() {
      if (view !== "editor" || !selectedDrawingPath) {
        return;
      }

      setDrawing(null);
      setSaveState({
        status: "loading",
        message: t("boardLoading"),
      });
      try {
        const response = await fetch(`/api/drawings/open?path=${encodeURIComponent(selectedDrawingPath)}`);
        const payload = (await response.json()) as { drawing?: DrawingContent; error?: string };

        if (!response.ok || !payload.drawing) {
          throw new Error(payload.error || t("boardOpenFailed"));
        }

        setDrawing(payload.drawing);
        setSaveState({
          status: "saved",
          baseSha: payload.drawing.sha,
          remoteSha: payload.drawing.sha,
          message: t("boardLoaded"),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : t("boardOpenFailed");
        setNotice({ tone: "error", message });
        setDrawing(null);
        setSaveState({
          status: "error",
          message,
        });
      }
    }

    void loadDrawing();
  }, [editorReloadKey, selectedDrawingPath, t, view]);

  async function handleRepositoryConfigured(repository: RepositoryRecord, nextDrawings: DrawingFile[]) {
    setRepositories((current) => [repository, ...current.filter((item) => item.id !== repository.id)]);
    setActiveRepositoryId(repository.id);
    setDrawings(nextDrawings);
    setSelectedPath(nextDrawings[0]?.path || "");
    if (repository.status === "error") {
      setNotice({
        tone: "error",
        message: repository.error || t("repositoryScanFailed"),
      });
      return;
    }

    setNotice(
      nextDrawings.length > 0
        ? { tone: "success", message: t("repositoryReady", { repository: `${repository.owner}/${repository.name}` }) }
        : {
            tone: "warning",
            message: t("repositoryEmpty", { repository: `${repository.owner}/${repository.name}` }),
          },
    );
  }

  function handleRepositoryScanned(repository: RepositoryRecord, nextDrawings: DrawingFile[]) {
    setRepositories((current) => current.map((item) => item.id === repository.id ? repository : item));
    if (repository.id === activeRepository?.id) {
      setDrawings(nextDrawings);
      setSelectedPath((current) => nextDrawings.some((drawingFile) => drawingFile.path === current) ? current : nextDrawings[0]?.path || "");
    }
    setNotice({ tone: "success", message: t("repositoryScanned", { repository: `${repository.owner}/${repository.name}`, count: nextDrawings.length }) });
  }

  async function handleRepositorySwitch(repositoryId: string) {
    if (repositoryId === activeRepository?.id) {
      return;
    }
    if (view === "editor" && ["dirty", "saving", "stale", "conflict"].includes(effectiveSaveState.status)) {
      const confirmed = window.confirm(t("repositorySwitchConfirm"));
      if (!confirmed) {
        return;
      }
    }

    setSwitchingRepository(true);
    try {
      const response = await fetch(`/api/repositories/${encodeURIComponent(repositoryId)}`, { method: "PATCH" });
      const payload = (await response.json()) as { repository?: RepositoryRecord; error?: string };
      if (!response.ok || !payload.repository) {
        throw new Error(payload.error || t("repositoryActivateFailed"));
      }
      setActiveRepositoryId(payload.repository.id);
      setSelectedPath("");
      setDrawing(null);
      await refreshState();
      setNotice({ tone: "success", message: t("repositorySwitched", { repository: `${payload.repository.owner}/${payload.repository.name}` }) });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : t("repositoryActivateFailed") });
    } finally {
      setSwitchingRepository(false);
    }
  }

  async function handleRepositoryDisconnect(repositoryId: string) {
    const repository = repositories.find((item) => item.id === repositoryId);
    if (!repository || !window.confirm(t("repositoryDisconnectConfirm", { repository: `${repository.owner}/${repository.name}` }))) {
      return;
    }
    try {
      const response = await fetch(`/api/repositories/${encodeURIComponent(repositoryId)}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || t("repositoryDisconnectFailed"));
      }
      await refreshState();
      setNotice({ tone: "success", message: t("repositoryDisconnected", { repository: `${repository.owner}/${repository.name}` }) });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : t("repositoryDisconnectFailed") });
    }
  }

  async function handleStartSession(filePath: string) {
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      const payload = (await response.json()) as {
        session?: CollaborationSession;
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.session) {
        throw new Error(payload.error || t("sessionStartFailed"));
      }

      setSessions((current) => [payload.session as CollaborationSession, ...current]);
      setNotice({ tone: "success", message: t("sessionStarted") });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : t("sessionStartFailed"),
      });
    }
  }

  async function handleDeleteSession(sessionId: string) {
    const confirmed = window.confirm(
      t("sessionDeleteConfirm"),
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || t("sessionDeleteFailed"));
      }

      setSessions((current) => current.filter((session) => session.id !== sessionId));
      setNotice({ tone: "success", message: t("sessionDeleted") });
      await refreshState();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : t("sessionDeleteFailed"),
      });
    }
  }

  async function handleUpdateSessionStatus(sessionId: string, status: SessionLifecycleStatus) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || t("sessionStatusFailed"));
      }

      setNotice({ tone: "success", message: t("sessionStatusChanged", { status: sessionLifecycleLabel(status) }) });
      await refreshState();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : t("sessionStatusFailed"),
      });
    }
  }

  async function handleSave(content: unknown) {
    if (!selectedDrawing || !drawing) {
      setNotice({ tone: "warning", message: t("boardChooseFirst") });
      return;
    }

    if (effectiveSaveState.status === "stale") {
      setNotice({
        tone: "warning",
        message: t("boardStale"),
      });
      return;
    }

    const baseSha = effectiveSaveState.baseSha || drawing.sha || selectedDrawing.sha;
    setSaveState((current) => ({
      ...current,
      status: "saving",
      message: t("boardSaving"),
    }));
    try {
      const response = await fetch("/api/drawings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedDrawing.path,
          sha: baseSha,
          content,
          message: `Update ${selectedDrawing.path} from Sketchblock`,
        }),
      });
      const payload = (await response.json()) as {
        result?: { commitSha: string; contentSha: string };
        error?: string;
      };

      if (!response.ok || !payload.result) {
        const message = payload.error || t("boardSaveFailed");
        setNotice({ tone: "error", message });
        setSaveState((current) => ({
          ...current,
          status: response.status === 409 ? "stale" : "conflict",
          message,
        }));
        return;
      }

      setNotice({ tone: "success", message: t("boardSavedCommit", { commit: payload.result.commitSha.slice(0, 7) }) });
      setDrawing({
        path: drawing.path,
        sha: payload.result.contentSha,
        content,
      });
      setDrawings((current) =>
        current.map((item) =>
          item.path === selectedDrawing.path
            ? { ...item, sha: payload.result?.contentSha || item.sha, status: "saved" }
            : item,
        ),
      );
      setSaveState({
        status: "saved",
        baseSha: payload.result.contentSha,
        remoteSha: payload.result.contentSha,
        commitSha: payload.result.commitSha,
        message: t("boardSaved"),
      });
      await refreshState();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("boardSaveFailed");
      setNotice({ tone: "error", message });
      setSaveState((current) => ({
        ...current,
        status: "conflict",
        message,
      }));
    }
  }

  return (
    <div className="min-h-screen bg-muted/35 text-foreground">
      <div className="flex min-h-screen">
        <AppSidebar role={user.role} />

        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-5 md:pb-7 md:pt-6 lg:px-8">
          <Header
            title={labels.title}
            subtitle={labels.subtitle}
            activeRepository={activeRepository}
            repositories={repositories}
            switchingRepository={switchingRepository}
            onRepositorySwitch={handleRepositorySwitch}
            user={user}
            realtimeReachable={view === "sessions" ? collabServerStatus?.reachable : undefined}
          />
          {demoMode ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info/25 bg-info/8 px-4 py-3 text-sm text-info-foreground">
              <div>
                <p className="font-medium">{t("demoWorkspace")}</p>
                <p className="mt-0.5 text-xs opacity-80">{t("demoDescription")}</p>
              </div>
              <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background")} href="/settings">{t("openSettings")}</Link>
            </div>
          ) : null}
          <ScopeBanner
            repository={activeRepository}
            selectedPath={
              view === "dashboard" || view === "drawings" || view === "sessions" || view === "editor"
                ? selectedDrawing?.path || selectedPath
                : ""
            }
          />

          {notice.tone !== "info" ? (
            <div
              aria-live="polite"
              className={cn("mb-5 rounded-lg border px-4 py-3 text-sm font-medium", noticeToneClasses[notice.tone])}
            >
              {notice.message}
            </div>
          ) : null}

          {view === "dashboard" && (
            <DashboardView
              repository={activeRepository}
              drawings={drawings}
              sessions={sessions}
              collabServerStatus={collabServerStatus}
              githubConnected={githubConnected}
              loaded={loaded}
            />
          )}
          {view === "repositories" && (
            <RepositoryView
              repository={activeRepository}
              repositories={repositories}
              drawings={drawings}
              githubConnected={githubConnected}
              onRepositoryConfigured={handleRepositoryConfigured}
              onRepositoryScanned={handleRepositoryScanned}
              onRepositorySwitch={handleRepositorySwitch}
              onRepositoryDisconnect={handleRepositoryDisconnect}
            />
          )}
          {view === "drawings" && (
            <DrawingsView drawings={drawings} sessions={sessions} selectedPath={selectedDrawing?.path || ""} />
          )}
          {view === "sessions" && (
            <SessionsView
              drawings={drawings}
              sessions={sessions}
              collabServerStatus={collabServerStatus}
              selectedPath={selectedDrawing?.path || ""}
              onStartSession={handleStartSession}
              onDeleteSession={handleDeleteSession}
              onUpdateSessionStatus={handleUpdateSessionStatus}
              onRefreshSessions={refreshState}
            />
          )}
          {view === "users" && <UsersView />}
          {view === "system" && <SystemStatusPanel />}
          {view === "settings" && <SettingsView githubConnected={githubConnected} repository={activeRepository} collabServerStatus={collabServerStatus} demoMode={demoMode} />}
          {view === "editor" && (
            <EditorView
              drawing={drawing}
              repository={activeRepository}
              selectedDrawing={selectedDrawing}
              saveState={effectiveSaveState}
              onReload={() => setEditorReloadKey((current) => current + 1)}
              onDirty={() =>
                setSaveState((current) => {
                  if (current.status === "loading" || current.status === "saving") {
                    return current;
                  }

                  if (current.baseSha && selectedDrawingSha && current.baseSha !== selectedDrawingSha) {
                    return {
                      ...current,
                      status: "stale",
                      remoteSha: selectedDrawingSha,
                      message: t("boardStale"),
                    };
                  }

                  if (current.status === "dirty" && current.message === t("boardDirty")) {
                    return current;
                  }

                  return {
                    ...current,
                    status: "dirty",
                    message: t("boardDirty"),
                  };
                })
              }
              onSave={handleSave}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Header({
  title,
  subtitle,
  activeRepository,
  repositories,
  switchingRepository,
  onRepositorySwitch,
  user,
  realtimeReachable,
}: {
  title: string;
  subtitle: string;
  activeRepository: RepositoryRecord | null;
  repositories: RepositoryRecord[];
  switchingRepository: boolean;
  onRepositorySwitch: (repositoryId: string) => void;
  user: SessionUser;
  realtimeReachable?: boolean;
}) {
  const t = useTranslations("Workspace");
  const repositoryLabel = activeRepository
    ? `${activeRepository.owner}/${activeRepository.name}`
    : t("configureRepository");

  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto">
        {realtimeReachable !== undefined ? (
          <span className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground sm:w-auto">
            <span
              className={cn("size-2 rounded-full", realtimeReachable ? "bg-success" : "bg-muted-foreground")}
              aria-hidden="true"
            />
            {realtimeReachable ? t("realtimeConnected") : t("realtimeUnavailable")}
          </span>
        ) : null}
        {activeRepository ? (
          <RepositorySwitcher
            repositories={repositories}
            activeRepository={activeRepository}
            switching={switchingRepository}
            onSwitch={onRepositorySwitch}
          />
        ) : (
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-full bg-background/80 px-3")}
            href="/repositories"
          >
            <Wifi data-icon="inline-start" />
            {repositoryLabel}
          </Link>
        )}
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.name || user.login}
            title={user.name || user.login}
            className="size-9 rounded-full border-2 border-background object-cover shadow-sm ring-1 ring-border"
          />
        ) : (
          <div
            className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm ring-2 ring-background"
            aria-label={user.name || user.login}
            title={user.name || user.login}
          >
            {getUserInitials(user)}
          </div>
        )}
      </div>
    </header>
  );
}

function getUserInitials(user: SessionUser) {
  const source = (user.name || user.login || "").trim();
  if (!source) {
    return "?";
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function ScopeBanner({
  repository,
  selectedPath,
}: {
  repository: RepositoryRecord | null;
  selectedPath: string;
}) {
  const t = useTranslations("Workspace");
  if (!repository && !selectedPath) {
    return null;
  }

  return (
    <section
      aria-label={t("activeContext")}
      className="mb-6 flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-border/70 pb-4 text-xs"
    >
      <div className="flex min-w-0 items-center gap-2">
        <FolderGit2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-muted-foreground">Repository</span>
        <span className="truncate font-mono font-medium text-foreground">
          {repository ? `${repository.owner}/${repository.name}` : t("notSelected")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Branch</span>
        <span className="font-mono font-medium text-foreground">{repository?.branch || "–"}</span>
      </div>
      {selectedPath ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">Board</span>
          <span className="truncate font-mono font-medium text-foreground">{selectedPath}</span>
        </div>
      ) : null}
    </section>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

function DashboardView({
  repository,
  drawings,
  sessions,
  collabServerStatus,
  githubConnected,
  loaded,
}: {
  repository: RepositoryRecord | null;
  drawings: DrawingFile[];
  sessions: CollaborationSession[];
  collabServerStatus: CollabServerStatus | null;
  githubConnected: boolean;
  loaded: boolean;
}) {
  const t = useTranslations("Workspace");
  if (!loaded) {
    return (
      <div className="grid gap-8" aria-busy="true">
        <span className="sr-only" role="status" aria-live="polite">{t("loading")}</span>
        <div className="grid min-h-48 gap-5 rounded-2xl border bg-background p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <BoardGallery drawings={[]} loading />
      </div>
    );
  }

  if (!repository) {
    return <WorkspaceOnboarding githubConnected={githubConnected} />;
  }

  const activeSessions = sessions.filter(
    (session) => (session.collab?.sessionStatus || session.status) === "active",
  );
  const activeSession = activeSessions[0] || null;
  const primaryDrawing = activeSession
    ? drawings.find((item) => item.path === activeSession.drawingPath) || drawings[0] || null
    : drawings[0] || null;
  const primaryHref = primaryDrawing
    ? `/editor?path=${encodeURIComponent(primaryDrawing.path)}`
    : "/repositories";

  return (
    <div className="grid gap-8">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-5 py-6 text-primary-foreground shadow-sm sm:px-7 sm:py-7">
        <div className="absolute -right-16 -top-24 size-64 rounded-full bg-white/8" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">
              {activeSession ? <Radio className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {activeSession ? t("liveNow") : t("continueWork")}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {primaryDrawing ? drawingDisplayName(primaryDrawing.path) : t("repositoryConnected")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/75">
              {primaryDrawing
                ? activeSession
                  ? t("peopleWorking", { count: activeSession.collab?.presenceCount || 0 })
                  : t("openFirstBoard")
                : t("scanMakesVisible")}
            </p>
          </div>
          <Link
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "h-10 gap-2 bg-background px-4 text-foreground hover:bg-background/90",
            )}
            href={primaryHref}
          >
            {primaryDrawing ? t("openBoard") : t("checkRepository")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </section>

      <WorkspacePulse
        activeSessions={activeSessions.length}
        boardCount={drawings.length}
        collabServerStatus={collabServerStatus}
        repository={repository}
      />

      <BoardGallery drawings={drawings} sessions={sessions} />
    </div>
  );
}

function WorkspaceOnboarding({ githubConnected }: { githubConnected: boolean }) {
  const t = useTranslations("Workspace");
  const steps = [
    {
      title: t("connectGitHub"),
      description: t("connectGitHubDescription"),
      complete: githubConnected,
    },
    {
      title: t("chooseRepository"),
      description: t("chooseRepositoryDescription"),
      complete: false,
    },
    {
      title: t("openFirst"),
      description: t("openFirstDescription"),
      complete: false,
    },
  ];
  const activeStepIndex = steps.findIndex((step) => !step.complete);

  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="grid gap-6 px-5 py-7 sm:px-7 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)] lg:items-center lg:py-9">
        <div className="max-w-xl">
          <Badge variant="secondary">{t("firstWorkspace")}</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("onboardingTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("onboardingDescription")}
          </p>
          <Link className={cn(buttonVariants({ size: "lg" }), "mt-6 h-10 gap-2 px-4")} href="/repositories">
            {t("startSetup")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
        <ol className="grid gap-1" aria-label={t("setupSteps")}>
          {steps.map((step, index) => {
            const isActive = index === activeStepIndex;
            return (
              <li
                className="grid grid-cols-[32px_1fr] gap-3 border-b py-3 last:border-b-0"
                aria-current={isActive ? "step" : undefined}
                key={step.title}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-xs font-bold",
                    step.complete
                      ? "bg-success/12 text-success-foreground"
                      : isActive
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.complete ? <CheckCircle2 className="size-4" aria-hidden="true" /> : index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold">{step.title}</div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function WorkspacePulse({
  repository,
  boardCount,
  activeSessions,
  collabServerStatus,
}: {
  repository: RepositoryRecord;
  boardCount: number;
  activeSessions: number;
  collabServerStatus: CollabServerStatus | null;
}) {
  const t = useTranslations("Workspace");
  const items = [
    { label: "Repository", value: repository.name, note: repository.branch, href: "/repositories" },
    { label: "Boards", value: String(boardCount), note: t("activeRepository"), href: "/drawings" },
    { label: t("liveSessions"), value: String(activeSessions), note: t("currentlyActive"), href: "/sessions" },
    {
      label: t("collaboration"),
      value: collabServerStatus?.reachable ? t("ready") : t("offline"),
      note: collabServerStatus?.reachable ? t("realtimeConnected") : t("checkStatus"),
      href: "/sessions",
    },
  ];

  return (
    <section aria-label={t("workspaceStatus")} className="grid border-y bg-background/65 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          className="group min-w-0 border-b px-4 py-4 transition-colors hover:bg-muted/60 sm:even:border-l lg:border-b-0 lg:border-l lg:first:border-l-0"
          href={item.href}
          key={item.label}
        >
          <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
          <div className="mt-1 flex min-w-0 items-baseline justify-between gap-2">
            <span className="truncate text-xl font-semibold tracking-tight">{item.value}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{item.note}</div>
        </Link>
      ))}
    </section>
  );
}

function RepositoryView({
  repository,
  repositories,
  drawings,
  githubConnected,
  onRepositoryConfigured,
  onRepositoryScanned,
  onRepositorySwitch,
  onRepositoryDisconnect,
}: {
  repository: RepositoryRecord | null;
  repositories: RepositoryRecord[];
  drawings: DrawingFile[];
  githubConnected: boolean;
  onRepositoryConfigured: (repository: RepositoryRecord, drawings: DrawingFile[]) => void;
  onRepositoryScanned: (repository: RepositoryRecord, drawings: DrawingFile[]) => void;
  onRepositorySwitch: (repositoryId: string) => void;
  onRepositoryDisconnect: (repositoryId: string) => void;
}) {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  const [scanningId, setScanningId] = useState("");

  async function handleScanRepository(repositoryToScan: RepositoryRecord) {
    setScanningId(repositoryToScan.id);
    try {
      const response = await fetch(`/api/repositories/${encodeURIComponent(repositoryToScan.id)}/scan`, { method: "POST" });
      const payload = (await response.json()) as {
        repository?: RepositoryRecord;
        drawings?: DrawingFile[];
        error?: string;
      };

      if (!response.ok || !payload.repository) {
        throw new Error(payload.error || t("scanRepositoryFailed"));
      }

      onRepositoryScanned(payload.repository, payload.drawings || []);
    } catch (error) {
      if (repositoryToScan.id === repository?.id) {
        onRepositoryConfigured(
          { ...repositoryToScan, status: "error", error: error instanceof Error ? error.message : t("scanRepositoryFailed") },
          drawings,
        );
      }
    } finally {
      setScanningId("");
    }
  }

  const steps = [
    { label: t("connectGitHub"), complete: githubConnected },
    { label: t("chooseRepository"), complete: Boolean(repository) },
    { label: t("scanBoards"), complete: Boolean(repository && repository.status !== "error") },
  ];
  const activeStepIndex = steps.findIndex((step) => !step.complete);

  return (
    <div className="grid gap-8">
      <ol className="grid border-y bg-background/60 sm:grid-cols-3" aria-label={t("setupRepository")}>
        {steps.map((step, index) => {
          const isActive = index === activeStepIndex;
          return (
            <li
              className={cn(
                "flex items-center gap-3 border-b px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-l sm:first:border-l-0",
                isActive && "bg-primary/[0.04]",
              )}
              aria-current={isActive ? "step" : undefined}
              key={step.label}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                  step.complete
                    ? "bg-success/12 text-success-foreground"
                    : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step.complete ? <CheckCircle2 className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <div>
                <div className="text-xs text-muted-foreground">{t("step", { number: index + 1 })}</div>
                <div className={cn("text-sm font-semibold", !step.complete && !isActive && "text-muted-foreground")}>
                  {step.label}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="connected-repositories-title" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="connected-repositories-title" className="text-lg font-semibold">{t("connectedRepositories")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("connectedRepositoriesDescription")}
            </p>
          </div>
          {githubConnected ? (
            <RepositoryPickerDialog
              connectedRepositoryIds={repositories.map((item) => item.githubRepositoryId)}
              onSelected={onRepositoryConfigured}
            />
          ) : null}
        </div>
        {repositories.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {repositories.map((item) => {
              const isActive = item.id === repository?.id;
              return (
                <Card key={item.id} className={cn("rounded-xl", isActive && "ring-2 ring-primary/20")}>
                  <CardHeader className="gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle as="h3" className="truncate">{item.owner}/{item.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">Branch {item.branch}</p>
                      </div>
                      <Badge variant={isActive ? "default" : "outline"}>{isActive ? t("active") : t("connected")}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    {!isActive ? (
                      <Button size="sm" onClick={() => onRepositorySwitch(item.id)}>{t("activate")}</Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => handleScanRepository(item)} disabled={Boolean(scanningId)}>
                      <RefreshCcw className={cn(scanningId === item.id && "animate-spin")} data-icon="inline-start" />
                      {t("scan")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onRepositoryDisconnect(item.id)} disabled={Boolean(scanningId)}>
                      <Trash2 data-icon="inline-start" />
                      {t("disconnect")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle as="h2">{t("boardRepository")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("boardRepositoryDescription")}
          </p>
        </CardHeader>
        <CardContent className="grid gap-5">
          {repository ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <ReadonlyField label={t("owner")} value={repository.owner} />
                <ReadonlyField label="Repository" value={repository.name} />
                <ReadonlyField label={t("defaultBranch")} value={repository.branch} />
              </div>
              {repository.status === "empty" ? (
                <div className={cn("rounded-lg border px-4 py-3 text-sm", noticeToneClasses.warning)}>
                  {t("emptyRepositoryHint")}
                </div>
              ) : null}
              {repository.status === "error" ? (
                <div className={cn("rounded-lg border px-4 py-3 text-sm", noticeToneClasses.error)}>
                  {repository.error || t("scanRepositoryFailed")}
                </div>
              ) : null}
            </>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-muted/25 px-5 py-8 text-center">
              <div className="grid max-w-md justify-items-center gap-2">
                <FolderGit2 className="size-8 text-muted-foreground" aria-hidden="true" />
                <div className="font-semibold">{t("noRepositorySelected")}</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("selectWritableRepository")}
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {githubConnected ? (
              <RepositoryPickerDialog connectedRepositoryIds={repositories.map((item) => item.githubRepositoryId)} onSelected={onRepositoryConfigured} />
            ) : (
              <a
                className={cn(buttonVariants(), "gap-2")}
                href="/api/auth/github/start?intent=owner_connect&returnTo=%2Frepositories"
              >
                <GitBranch data-icon="inline-start" />
                {t("connectGitHub")}
              </a>
            )}
            {repository ? (
              <Button type="button" variant="outline" onClick={() => handleScanRepository(repository)} disabled={Boolean(scanningId)}>
                <RefreshCcw className={cn(scanningId === repository.id && "animate-spin")} data-icon="inline-start" />
                {scanningId === repository.id ? t("scanRunning") : t("scanAgain")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <aside className="grid gap-4 border-t pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-label={t("connectionStatus")}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("connectionStatus")}</div>
          <h2 className="mt-2 text-lg font-semibold">{repository ? t("repositoryReadyStatus") : t("setupOpen")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {repository
              ? t("boardsFound", { count: drawings.length })
              : t("connectThenChoose")}
          </p>
        </div>
        <div className="grid gap-3 text-sm">
          <InfoRow label="GitHub" value={githubConnected ? t("connected") : t("notConnected")} />
          <InfoRow label="Repository" value={repository ? <StatusBadge value={repository.status} /> : t("notSelected")} />
          <InfoRow label={t("visibility")} value={repository ? (repository.private ? t("private") : t("public")) : "–"} />
          <InfoRow label={t("foundBoards")} value={String(drawings.length)} />
        </div>
        <Accordion>
          <AccordionItem value="repository-diagnostics" className="border-b-0">
            <AccordionTrigger className="border-t pt-4 hover:no-underline">{t("technicalDetails")}</AccordionTrigger>
            <AccordionContent className="grid gap-3 pt-2">
              <InfoRow label="API-URL" value={repository?.apiUrl || "–"} mono />
              <InfoRow label="Scan-Scope" value=".excalidraw" mono />
              <InfoRow label={t("lastScan")} value={repository?.lastScanAt ? formatTime(repository.lastScanAt, locale) : "–"} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>
      </div>
    </div>
  );
}

function DrawingsView({
  drawings,
  sessions,
  selectedPath,
}: {
  drawings: DrawingFile[];
  sessions: CollaborationSession[];
  selectedPath: string;
}) {
  const t = useTranslations("Workspace");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const statuses = useMemo(
    () => Array.from(new Set(drawings.map((drawing) => drawing.status))),
    [drawings],
  );
  const filteredDrawings = useMemo(
    () =>
      drawings.filter((drawing) => {
        const matchesQuery = drawing.path.toLowerCase().includes(query.trim().toLowerCase());
        const matchesStatus = statusFilter === "all" || drawing.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [drawings, query, statusFilter],
  );
  const hasActiveFilter = Boolean(query.trim()) || statusFilter !== "all";
  const noFilterResults = hasActiveFilter && filteredDrawings.length === 0;
  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
  };

  if (drawings.length === 0) {
    return (
      <BoardGallery
        description={t("boardEmptyDescription")}
        drawings={[]}
        limit={null}
        sessions={sessions}
        showAllLink={false}
        title={t("allBoards")}
      />
    );
  }

  return (
    <Tabs className="grid gap-5" defaultValue="gallery">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList variant="line">
          <TabsTrigger value="gallery">
            <FilePenLine data-icon="inline-start" />
            {t("gallery")}
          </TabsTrigger>
          <TabsTrigger value="list">
            <List data-icon="inline-start" />
            {t("fileList")}
          </TabsTrigger>
        </TabsList>
        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2 sm:flex-nowrap">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <label className="sr-only" htmlFor="board-search">{t("searchBoards")}</label>
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="board-search"
            className="pl-9"
            placeholder={t("searchBoards")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-44" aria-label={t("allStatuses")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {drawingStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      </div>

      <TabsContent value="gallery">
        {noFilterResults ? (
          <BoardFilterEmptyState onReset={resetFilters} />
        ) : (
          <BoardGallery
            description={t("boardsCount", { visible: filteredDrawings.length, total: drawings.length })}
            drawings={filteredDrawings}
            limit={null}
            sessions={sessions}
            showAllLink={false}
            title={t("allBoards")}
          />
        )}
      </TabsContent>
      <TabsContent value="list">
        {noFilterResults ? (
          <BoardFilterEmptyState onReset={resetFilters} />
        ) : (
          <div className="grid gap-3">
            <div className="text-xs text-muted-foreground">
              {t("technicalFileView")}
            </div>
            <DrawingTable drawings={filteredDrawings} selectedPath={selectedPath} showActions />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function BoardFilterEmptyState({ onReset }: { onReset: () => void }) {
  const t = useTranslations("Workspace");
  return (
    <div className="grid min-h-56 place-items-center rounded-xl border border-dashed bg-background/70 px-5 py-10 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <Search className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{t("noMatchingBoards")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("adjustFilters")}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onReset}>
          {t("resetFilters")}
        </Button>
      </div>
    </div>
  );
}

function SessionsView({
  drawings,
  sessions,
  collabServerStatus,
  selectedPath,
  onStartSession,
  onDeleteSession,
  onUpdateSessionStatus,
  onRefreshSessions,
}: {
  drawings: DrawingFile[];
  sessions: CollaborationSession[];
  collabServerStatus: CollabServerStatus | null;
  selectedPath: string;
  onStartSession: (path: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onUpdateSessionStatus: (sessionId: string, status: SessionLifecycleStatus) => Promise<void>;
  onRefreshSessions: () => Promise<void>;
}) {
  const t = useTranslations("Workspace");
  const [path, setPath] = useState(selectedPath || drawings[0]?.path || "");
  const activeSession = sessions.find(
    (session) => (session.collab?.sessionStatus || session.status) === "active",
  );
  const earlierSessions = sessions.filter((session) => session.id !== activeSession?.id);

  useEffect(() => {
    if (!path && drawings[0]?.path) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPath(drawings[0].path);
    }
  }, [drawings, path]);

  return (
    <div className="grid min-w-0 gap-8">
      {activeSession ? (
        <LiveSessionHero session={activeSession} onEndSession={onUpdateSessionStatus} />
      ) : (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle as="h2" className="text-xl">{t("startLiveSession")}</CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("startLiveDescription")}
            </p>
          </CardHeader>
          <CardContent>
            {drawings.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{t("scanBoardFirst")}</p>
                <Link className={buttonVariants({ variant: "outline" })} href="/drawings">{t("toBoards")}</Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid min-w-0 gap-2 text-sm font-medium" htmlFor="session-board">
                  {t("selectBoard")}
                  <Select value={path} onValueChange={(value) => setPath(String(value))}>
                    <SelectTrigger id="session-board" className="w-full">
                      <SelectValue placeholder={t("selectBoard")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {drawings.map((drawing) => (
                          <SelectItem key={drawing.path} value={drawing.path}>
                            {drawingDisplayName(drawing.path)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>
                <Button type="button" onClick={() => void onStartSession(path)} disabled={!path}>
                  <Play data-icon="inline-start" />
                  {t("startSession")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <EarlierSessions sessions={earlierSessions} onDeleteSession={onDeleteSession} />

      <Accordion className="min-w-0 rounded-xl border bg-background px-4">
        <AccordionItem value="details-history" className="border-b-0">
          <AccordionTrigger className="py-4 hover:no-underline">
            <span className="flex items-center gap-2">
              <Settings2 aria-hidden="true" />
              {t("detailsHistory")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="grid min-w-0 gap-6 pb-4">
            <div className="grid gap-4 border-b pb-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label="URL" value={collabServerStatus?.url || "http://localhost:4513"} mono />
              <InfoRow label="Transport" value={collabServerStatus?.transport || "–"} mono />
              <InfoRow label={t("mode")} value="Socket.IO + Yjs" />
              {collabServerStatus?.error ? <InfoRow label={t("error")} value={collabServerStatus.error} /> : <InfoRow label="Status" value={t("noErrors")} />}
            </div>
            <Button className="w-fit" type="button" variant="outline" onClick={() => void onRefreshSessions()}>
              <RefreshCcw data-icon="inline-start" />
              {t("refreshStatus")}
            </Button>
            <SessionRuntimeTable sessions={sessions} />
            <SessionAuditTable events={sessionAuditEvents(sessions)} showSession />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function LiveSessionHero({
  session,
  onEndSession,
}: {
  session: CollaborationSession;
  onEndSession: (sessionId: string, status: SessionLifecycleStatus) => Promise<void>;
}) {
  const t = useTranslations("Workspace");
  const presence = session.collab?.presence || [];

  return (
    <Card className="overflow-hidden rounded-2xl border-success/25 shadow-sm">
      <CardHeader className="gap-5 bg-success/5 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="gap-2">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              {t("liveSession")}
            </Badge>
          </div>
          <CardTitle as="h2" className="break-words text-2xl sm:text-3xl">
            {drawingDisplayName(session.drawingPath)}
          </CardTitle>
        </div>
        <PresenceAvatars presence={presence} count={session.collab?.presenceCount} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
        <Link className={cn(buttonVariants(), "justify-center")} href={`/join/${session.id}?owner=1`}>
          {t("openBoard")}
          <ArrowRight data-icon="inline-end" />
        </Link>
        <SessionShareDialog
          collaboratorHref={session.shareLinks?.collaborator || ""}
          viewerHref={session.shareLinks?.viewer || ""}
        />
        <EndSessionDialog session={session} onEndSession={onEndSession} />
      </CardContent>
    </Card>
  );
}

function PresenceAvatars({
  presence,
  count,
}: {
  presence: NonNullable<CollaborationSession["collab"]>["presence"];
  count?: number;
}) {
  const t = useTranslations("Workspace");
  const participants = presence || [];
  const participantCount = count ?? participants.length;

  return (
    <div className="flex items-center gap-3" aria-label={t("participantsLive", { count: participantCount })}>
      <div className="flex -space-x-2">
        {participants.slice(0, 4).map((participant) => (
          <Avatar className="size-9 border-2 border-background" key={participant.socketId}>
            {participant.avatarUrl ? <AvatarImage src={participant.avatarUrl} alt={participant.displayName} /> : null}
            <AvatarFallback>{participantInitials(participant.displayName)}</AvatarFallback>
          </Avatar>
        ))}
        {participants.length === 0 ? (
          <Avatar className="size-9 border-2 border-background">
            <AvatarFallback><UsersRound aria-hidden="true" /></AvatarFallback>
          </Avatar>
        ) : null}
      </div>
      <span className="text-sm font-medium">{t("participants", { count: participantCount })}</span>
    </div>
  );
}

function EndSessionDialog({
  session,
  onEndSession,
}: {
  session: CollaborationSession;
  onEndSession: (sessionId: string, status: SessionLifecycleStatus) => Promise<void>;
}) {
  const t = useTranslations("Workspace");
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" />}>
        <CircleStop data-icon="inline-start" />
        {t("end")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("endSessionTitle")}</DialogTitle>
          <DialogDescription>
            {t("endSessionDescription", { board: drawingDisplayName(session.drawingPath) })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
          <DialogClose
            render={<Button type="button" variant="destructive" onClick={() => void onEndSession(session.id, "closed")} />}
          >
            {t("endSession")}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EarlierSessions({
  sessions,
  onDeleteSession,
}: {
  sessions: CollaborationSession[];
  onDeleteSession: (sessionId: string) => Promise<void>;
}) {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  if (sessions.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="earlier-sessions-heading" className="grid gap-3">
      <div>
        <h2 className="text-lg font-semibold" id="earlier-sessions-heading">{t("earlierSessions")}</h2>
        <p className="text-sm text-muted-foreground">{t("earlierDescription")}</p>
      </div>
      <div className="divide-y rounded-xl border bg-background">
        {sessions.map((session) => {
          const status = session.collab?.sessionStatus || session.status;
          return (
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={session.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words font-semibold">{drawingDisplayName(session.drawingPath)}</span>
                  <StatusBadge value={status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("closedAgo", { time: formatRelativeTime(session.collab?.lastCheckedAt || session.updatedAt, locale) })}
                </p>
              </div>
              {status !== "active" ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void onDeleteSession(session.id)}
                >
                  <Trash2 data-icon="inline-start" />
                  {t("delete")}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function participantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : (parts[0] || "?").slice(0, 2).toUpperCase();
}

function SessionRuntimeTable({ sessions }: { sessions: CollaborationSession[] }) {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/35 px-4 py-3">
        <h3 className="text-sm font-semibold">{t("runtime")}</h3>
      </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden lg:table-cell">Session</TableHead>
              <TableHead>Board</TableHead>
              <TableHead>{t("lifecycle")}</TableHead>
              <TableHead>Realtime</TableHead>
              <TableHead>{t("participantsColumn")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("snapshot")}</TableHead>
              <TableHead className="hidden md:table-cell">Yjs</TableHead>
              <TableHead className="hidden xl:table-cell">{t("updated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  {t("noSessionData")}
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="hidden max-w-40 truncate font-mono text-xs lg:table-cell">{session.id}</TableCell>
                  <TableCell className="max-w-[420px] truncate font-mono text-xs">{session.drawingPath}</TableCell>
                  <TableCell><StatusBadge value={session.collab?.sessionStatus || session.status} /></TableCell>
                  <TableCell><StatusBadge value={session.collab?.status || "unknown"} /></TableCell>
                  <TableCell className="whitespace-normal">
                    <SessionClientList
                      count={session.collab?.presenceCount}
                      clients={session.collab?.presence}
                    />
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{session.collab?.snapshotRevision ?? "-"}</TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{formatBytes(session.collab?.yjsStateBytes)}</TableCell>
                  <TableCell className="hidden font-mono text-xs xl:table-cell">{formatTime(session.collab?.lastCheckedAt || session.updatedAt, locale)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
    </div>
  );
}

function sessionAuditEvents(sessions: CollaborationSession[]) {
  return sessions
    .flatMap((session) =>
      (session.collab?.audit || []).map((event) => ({
        ...event,
        sessionId: session.id,
      })),
    )
    .sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime())
    .slice(0, 12);
}

type SessionAuditListItem = SessionAuditEvent & {
  sessionId?: string;
};

function SessionAuditTable({
  events,
  showSession = false,
}: {
  events: SessionAuditListItem[];
  showSession?: boolean;
}) {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  if (events.length === 0) {
    return (
      <div className="px-6 pb-6 text-sm text-muted-foreground">
        {t("noEvents")}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="hidden sm:table-cell">{t("time")}</TableHead>
          {showSession ? <TableHead className="hidden lg:table-cell">Session</TableHead> : null}
          <TableHead>{t("type")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("actor")}</TableHead>
          <TableHead>{t("event")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={`${event.sessionId || "session"}-${event.id}`}>
            <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{formatTime(event.at, locale)}</TableCell>
            {showSession ? (
              <TableCell className="hidden max-w-40 font-mono text-xs text-muted-foreground lg:table-cell">
                <TruncatedValue text={event.sessionId || "-"} />
              </TableCell>
            ) : null}
            <TableCell className="text-xs font-medium">{sessionAuditTypeLabel(event.type)}</TableCell>
            <TableCell className="hidden max-w-44 font-medium md:table-cell">
              <TruncatedValue className="font-sans" text={event.actor} />
            </TableCell>
            <TableCell className="max-w-[520px] whitespace-normal text-muted-foreground">{sessionAuditMessage(event)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SessionClientList({
  count,
  clients = [],
}: {
  count?: number;
  clients?: NonNullable<CollaborationSession["collab"]>["presence"];
}) {
  const t = useTranslations("Workspace");
  if (count === undefined) {
    return "-";
  }

  if (!clients || clients.length === 0) {
    return t("connectedCount", { count });
  }

  return (
    <div className="grid min-w-32 max-w-48 gap-1">
      <span className="text-xs text-muted-foreground">{t("connectedCount", { count })}</span>
      {clients.map((client) => (
        <span
          key={client.socketId}
          className="truncate"
          title={client.displayName || client.userId}
        >
          {client.displayName || client.userId}
        </span>
      ))}
    </div>
  );
}

function EditorView({
  drawing,
  repository,
  selectedDrawing,
  saveState,
  onReload,
  onDirty,
  onSave,
}: {
  drawing: DrawingContent | null;
  repository: RepositoryRecord | null;
  selectedDrawing: DrawingFile | null;
  saveState: EditorSaveState;
  onReload: () => void;
  onDirty: () => void;
  onSave: (content: unknown) => Promise<void>;
}) {
  const t = useTranslations("Workspace");
  if (!selectedDrawing) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-background/70 px-5 py-10 text-center">
        <div className="grid max-w-md justify-items-center gap-3">
          <FilePenLine className="size-9 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">{t("chooseBoardTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("chooseBoardDescription")}
            </p>
          </div>
          <Link className={cn(buttonVariants(), "gap-2")} href="/drawings">
            {t("toBoards")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </div>
    );
  }

  if (!drawing) {
    if (saveState.status === "error" || saveState.status === "conflict") {
      return (
        <div className="grid min-h-64 place-items-center rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-10 text-center">
          <div className="grid max-w-md justify-items-center gap-3" role="alert">
            <RefreshCcw className="size-7 text-destructive" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">{t("boardLoadFailed")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {translateSaveMessage(saveState.message || t("checkConnection"))}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={onReload}>
              <RefreshCcw data-icon="inline-start" />
              {t("reload")}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid min-h-64 place-items-center rounded-xl border bg-background px-5 py-10 text-center" aria-busy="true">
        <div className="grid justify-items-center gap-3" role="status" aria-live="polite">
          <RefreshCcw className="size-6 animate-spin text-primary" aria-hidden="true" />
          <div className="font-medium">{t("loadingBoard")}</div>
          <p className="text-sm text-muted-foreground">{t("preparingCanvas")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <ExcalidrawEditor
        key={selectedDrawing.path}
        initialContent={drawing.content}
        saveDisabled={saveState.status === "stale" || saveState.status === "conflict" || saveState.status === "error"}
        onDirty={() => {
          if (saveState.status !== "saving") {
            onDirty();
          }
        }}
        onSave={onSave}
      />
      <aside className="grid content-start gap-5 border-t pt-5 2xl:border-l 2xl:border-t-0 2xl:pl-5 2xl:pt-0" aria-label={t("saveStatus")}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("saveVersion")}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge value={saveState.status} />
            {saveState.status === "saved" ? <span className="text-xs text-success-foreground">{t("githubCurrent")}</span> : null}
          </div>
          {saveState.message ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{translateSaveMessage(saveState.message)}</p> : null}
          {saveState.status === "stale" || saveState.status === "conflict" || saveState.status === "error" ? (
            <Button className="mt-4" type="button" variant="outline" onClick={onReload}>
              <RefreshCcw data-icon="inline-start" />
              {t("reloadRemote")}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 text-sm">
          <InfoRow label="Branch" value={repository?.branch || "–"} mono />
          <InfoRow label={t("target")} value={t("commitPush")} />
          {saveState.commitSha ? <InfoRow label={t("lastCommit")} value={saveState.commitSha.slice(0, 7)} mono /> : null}
        </div>
        <Accordion>
          <AccordionItem value="git-details" className="border-b-0">
            <AccordionTrigger className="border-t pt-4 hover:no-underline">{t("gitDetails")}</AccordionTrigger>
            <AccordionContent className="grid gap-3 pt-2">
              <InfoRow label="Board" value={selectedDrawing.path} mono />
              <InfoRow label="Base SHA" value={saveState.baseSha || selectedDrawing.sha} mono />
              <InfoRow label="Remote SHA" value={saveState.remoteSha || selectedDrawing.sha} mono />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>
    </div>
  );
}

function UsersView() {
  return <UserAdministrationPanel />;
}

function SettingsView({
  githubConnected,
  repository,
  collabServerStatus,
  demoMode,
}: {
  githubConnected: boolean;
  repository: RepositoryRecord | null;
  collabServerStatus: CollabServerStatus | null;
  demoMode: boolean;
}) {
  const t = useTranslations("Settings");
  const [resettingDemo, setResettingDemo] = useState(false);

  async function resetDemo() {
    setResettingDemo(true);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      if (!response.ok) throw new Error("The demo workspace could not be reset.");
      window.location.assign("/");
    } finally {
      setResettingDemo(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-4">
        <section className="border-t pt-5" aria-labelledby="language-settings-heading">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Settings2 className="size-4" aria-hidden="true" />
            {t("interface")}
          </div>
          <h2 className="mt-2 text-lg font-semibold" id="language-settings-heading">{t("language")}</h2>
          <div className="mt-4"><LocaleSwitcher /></div>
        </section>
        <section className="border-t pt-5" aria-labelledby="github-settings-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <GitBranch className="size-4" aria-hidden="true" />
                {t("connection")}
              </div>
              <h2 className="mt-2 text-lg font-semibold" id="github-settings-heading">GitHub</h2>
            </div>
            <StatusBadge value={githubConnected ? "online" : "offline"} />
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("githubDescription")}
          </p>
          <Link className={cn(buttonVariants({ variant: "outline" }), "mt-5 gap-2")} href="/repositories">
            {githubConnected ? t("manageConnection") : t("connectGitHub")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </section>

        <section className="border-t pt-5" aria-labelledby="save-policy-heading">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t("security")}
          </div>
          <h2 className="mt-2 text-lg font-semibold" id="save-policy-heading">{t("storageRules")}</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <InfoRow label={t("save")} value={t("ownerOnly")} />
            <InfoRow label={t("target")} value={repository ? `${repository.owner}/${repository.name}` : t("noRepository")} mono={Boolean(repository)} />
            <InfoRow label="Branch" value={repository?.branch || "–"} mono />
          </div>
        </section>

        <section className="border-t pt-5" aria-labelledby="runtime-settings-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <ServerCog className="size-4" aria-hidden="true" />
                {t("operations")}
              </div>
              <h2 className="mt-2 text-lg font-semibold" id="runtime-settings-heading">Collab-Server</h2>
            </div>
            <StatusBadge value={collabServerStatus?.reachable ? "online" : "offline"} />
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("collabDescription")}
          </p>
          <div className="mt-4 grid gap-3 text-sm">
            <InfoRow label={t("configurationSource")} value={t("runtimeEnvironment")} />
            <InfoRow label={t("diagnosticPath")} value={t("throughCollab")} />
          </div>
          <Link className={cn(buttonVariants({ variant: "outline" }), "mt-5 gap-2")} href="/system">
            {t("openSystem")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </section>
        {demoMode ? (
          <section className="border-t pt-5" aria-labelledby="demo-settings-heading">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
              Demo
            </div>
            <h2 className="mt-2 text-lg font-semibold" id="demo-settings-heading">{t("demoWorkspace")}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("demoDescription")}</p>
            <Button className="mt-5" variant="outline" type="button" disabled={resettingDemo} onClick={resetDemo}>
              <RefreshCcw data-icon="inline-start" className={cn(resettingDemo && "animate-spin")} />
              {resettingDemo ? t("resetting") : t("resetDemo")}
            </Button>
          </section>
        ) : null}
    </div>
  );
}

function DrawingTable({
  drawings,
  selectedPath,
  showActions,
}: {
  drawings: DrawingFile[];
  selectedPath?: string;
  showActions: boolean;
}) {
  const t = useTranslations("Workspace");
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("path")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("lastCommit")}</TableHead>
              <TableHead className="hidden lg:table-cell">Base SHA</TableHead>
              <TableHead>Status</TableHead>
              {showActions && <TableHead className="text-right">{t("actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {drawings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  {t("noMatchingBoards")}
                </TableCell>
              </TableRow>
            ) : (
              drawings.map((drawingItem) => (
                <TableRow key={drawingItem.path} className={selectedPath === drawingItem.path ? "bg-primary/5" : ""}>
                  <TableCell className="max-w-[420px] truncate font-mono text-xs">{drawingItem.path}</TableCell>
                  <TableCell className="hidden md:table-cell">{drawingItem.lastCommit}</TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">{drawingItem.sha.slice(0, 7)}</TableCell>
                  <TableCell><StatusBadge value={drawingItem.status} /></TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")} href={`/editor?path=${encodeURIComponent(drawingItem.path)}`}>{t("edit")}</Link>
                        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")} href={`/sessions?path=${encodeURIComponent(drawingItem.path)}`}>Session</Link>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="min-h-9 rounded-md border bg-background px-3 py-2 font-mono text-sm">
        {value}
      </div>
    </div>
  );
}

export function JoinSessionTemplate({
  sessionId,
  role,
  inviteToken,
  identity,
}: {
  sessionId: string;
  role?: string;
  inviteToken?: string;
  identity: { login: string; displayName: string };
}) {
  const t = useTranslations("Workspace");
  const tJoin = useTranslations("Join");
  const sessionRole = normalizeSessionRole(role);
  const clientId = useSyncExternalStore(subscribeToClientId, getClientIdSnapshot, getServerClientIdSnapshot);
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [drawing, setDrawing] = useState<DrawingContent | null>(null);
  const [snapshot, setSnapshot] = useState<CollaborationSessionSnapshot | null>(null);
  const [sessionLoadState, setSessionLoadState] = useState<{
    status: "loading" | "ready" | "error";
    message?: string;
  }>({ status: "loading" });
  // Szene, die in den Editor gespielt wird. Nur echte Remote-Snapshots aktualisieren sie;
  // eigene Pushes nicht, sonst flackert das gerade gezeichnete Element (Echo).
  const [remoteScene, setRemoteScene] = useState<{ content: unknown; revision: number } | null>(null);
  const [sessionSaveState, setSessionSaveState] = useState<{
    status: "ready" | "saving" | "saved" | "error";
    message?: string;
    result?: SessionSaveResult;
  }>({ status: "ready" });
  const [removingClientSocketId, setRemovingClientSocketId] = useState<string | null>(null);
  const [clientActionNotice, setClientActionNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const pushTimeoutRef = useRef<number | null>(null);
  const snapshotRevisionRef = useRef(0);
  const isApplyingRemoteSnapshotRef = useRef(false);
  const collabPresence = useCollabPresence({
    sessionId,
    clientId,
    role: sessionRole,
    inviteToken,
    drawingPath: session?.drawingPath,
    displayName: identity.displayName,
  });
  const isOwner = sessionRole === "owner";
  const isViewer = sessionRole === "viewer";
  const cursorColor = useMemo(() => cursorColorFor(clientId), [clientId]);
  const remoteCursors = useMemo(() => Object.values(collabPresence.cursors), [collabPresence.cursors]);
  const cursorThrottleRef = useRef(0);

  function handlePointerUpdate(payload: { pointer: { x: number; y: number }; button: "up" | "down" }) {
    const now = window.performance.now();
    if (now - cursorThrottleRef.current < 45) {
      return;
    }

    cursorThrottleRef.current = now;
    collabPresence.sendCursor({
      pointer: payload.pointer,
      button: payload.button,
      displayName: identity.displayName,
      color: cursorColor,
    });
  }

  useEffect(() => {
    snapshotRevisionRef.current = snapshot?.revision || 0;
  }, [snapshot?.revision]);

  useEffect(() => {
    async function loadSession() {
      setSessionLoadState({ status: "loading" });
      try {
        const inviteQuery = inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : "";
        const response = await fetch(`/api/sessions/${sessionId}/state${inviteQuery}`);
        const payload = (await response.json()) as {
          session?: CollaborationSession;
          snapshot?: CollaborationSessionSnapshot;
          audit?: unknown;
          error?: string;
        };

        if (!response.ok || !payload.session || !payload.snapshot) {
          throw new Error(payload.error || t("sessionLoadFailed"));
        }

        setSession(payload.session);
        setSnapshot(payload.snapshot);
        setRemoteScene({ content: payload.snapshot.content, revision: payload.snapshot.revision });
        isApplyingRemoteSnapshotRef.current = true;
        setDrawing({
          path: payload.snapshot.drawingPath,
          sha: "",
          content: payload.snapshot.content,
        });
        setSessionLoadState({ status: "ready" });
        window.setTimeout(() => {
          isApplyingRemoteSnapshotRef.current = false;
        }, 600);
      } catch (error) {
        setSession(null);
        setDrawing(null);
        setSessionLoadState({
          status: "error",
          message: sessionLoadErrorMessage(error, tJoin("sessionDataUnavailable")),
        });
      }
    }

    void loadSession();
  }, [inviteToken, sessionId, t, tJoin]);

  useEffect(() => {
    const nextSnapshot = collabPresence.snapshot;
    if (!nextSnapshot || nextSnapshot.revision <= snapshotRevisionRef.current) {
      return;
    }

    setSnapshot(nextSnapshot);
    if (nextSnapshot.updatedBy === clientId) {
      return;
    }

    if (pushTimeoutRef.current) {
      window.clearTimeout(pushTimeoutRef.current);
      pushTimeoutRef.current = null;
    }
    isApplyingRemoteSnapshotRef.current = true;
    window.setTimeout(() => {
      setRemoteScene({ content: nextSnapshot.content, revision: nextSnapshot.revision });
    }, 0);
    window.setTimeout(() => {
      isApplyingRemoteSnapshotRef.current = false;
    }, 600);
  }, [clientId, collabPresence.snapshot]);

  async function pushSessionSnapshot(content: unknown) {
    let nextSnapshot: CollaborationSessionSnapshot | null = null;

    try {
      nextSnapshot = await collabPresence.pushSnapshot(content);
    } catch {
      const inviteQuery = inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : "";
      const response = await fetch(`/api/sessions/${sessionId}/state${inviteQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          content,
        }),
      });
      const payload = (await response.json()) as {
        snapshot?: CollaborationSessionSnapshot;
        error?: string;
      };
      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || t("sessionSyncFailed"));
      }
      nextSnapshot = payload.snapshot || null;
    }

    if (nextSnapshot) {
      // Nur Revision-Bookkeeping; die eigene Szene nicht zurück in den Editor spielen (Echo → Flicker).
      setSnapshot(nextSnapshot);
    }

    return nextSnapshot;
  }

  function handleSceneChange(content: unknown) {
    if (isApplyingRemoteSnapshotRef.current) {
      return;
    }

    if (pushTimeoutRef.current) {
      window.clearTimeout(pushTimeoutRef.current);
    }

    pushTimeoutRef.current = window.setTimeout(() => {
      void pushSessionSnapshot(content);
    }, 1500);
  }

  async function handleOwnerSave(content: unknown) {
    try {
      const snapshotResult = await pushSessionSnapshot(content);

      setSessionSaveState({
        status: "saving",
        message: snapshotResult
          ? t("savingRevision", { revision: snapshotResult.revision })
          : t("savingSession"),
      });

      const response = await fetch(`/api/sessions/${sessionId}/save`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        result?: SessionSaveResult;
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || t("sessionSaveFailed"));
      }

      setSessionSaveState({
        status: "saved",
        result: payload.result,
        message: t("revisionSaved", { revision: payload.result.snapshotRevision, commit: payload.result.commitSha.slice(0, 7) }),
      });
    } catch (error) {
      setSessionSaveState({
        status: "error",
        message: error instanceof Error ? error.message : t("sessionSaveFailed"),
      });
    }
  }

  async function handleRemoveConnectedClient(socketId: string) {
    if (!isOwner || !session || socketId === collabPresence.socketId) {
      return;
    }

    setRemovingClientSocketId(socketId);
    setClientActionNotice(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/clients/${encodeURIComponent(socketId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || t("removePersonFailed"));
      }
      setClientActionNotice({ tone: "success", message: t("personRemoved") });
    } catch (error) {
      setClientActionNotice({
        tone: "error",
        message: error instanceof Error ? error.message : t("removePersonFailed"),
      });
    } finally {
      setRemovingClientSocketId(null);
    }
  }

  const editor = (
    <ExcalidrawEditor
      className="min-h-[55dvh] sm:min-h-[620px] xl:min-h-[calc(100dvh-7rem)]"
      canvasClassName="min-h-[48dvh] sm:min-h-[560px] xl:min-h-[calc(100dvh-11rem)]"
      mode={isOwner ? "owner" : "guest"}
      initialContent={drawing?.content}
      remoteContent={remoteScene?.content}
      remoteRevision={remoteScene?.revision}
      readOnly={isViewer}
      onSceneChange={isViewer ? undefined : handleSceneChange}
      onSave={isOwner ? handleOwnerSave : undefined}
      onPointerUpdate={handlePointerUpdate}
      remoteCursors={remoteCursors}
      yjsSync={{
        sessionId,
        clientId,
        enabled: collabPresence.status === "connected",
        canSeed: isOwner,
        initialStateBase64: collabPresence.yjsStateBase64,
        remoteUpdate: collabPresence.remoteYjsUpdate,
        onSendUpdate: collabPresence.sendYjsUpdate,
      }}
    />
  );

  return (
    <div className="min-h-screen bg-muted/35 px-3 py-3 text-foreground sm:px-4">
      <main className={cn("mx-auto grid gap-3", isOwner ? "max-w-[1720px]" : "max-w-none")}>
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("liveCollaboration")}</p>
            <h1 className="mt-1 text-xl font-bold">{t("roleSession", { role: sessionRoleLabel(sessionRole) })}</h1>
            <p className="text-sm text-muted-foreground">
              {sessionRole === "owner" ? tJoin("ownerDescription") : sessionRole === "viewer" ? tJoin("viewerDescription") : tJoin("collaboratorDescription")}
            </p>
          </div>
          <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 text-sm">
            <StatusBadge value={sessionLoadState.status} />
            <StatusBadge value={sessionRole} />
            <span className="max-w-56 truncate font-mono text-xs" title={sessionId}>{sessionId}</span>
            <span className="max-w-44 truncate font-mono text-xs text-muted-foreground" title={`@${identity.login}`}>@{identity.login}</span>
          </div>
        </header>

        {sessionLoadState.status === "error" ? (
          <div className="grid min-h-64 place-items-center rounded-xl border border-destructive/25 bg-background px-5 py-10 text-center" role="alert">
            <div className="grid max-w-md justify-items-center gap-3">
              <WifiOff className="size-8 text-destructive" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{t("sessionUnavailable")}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {sessionLoadState.message || t("checkInvite")}
                </p>
              </div>
              <Link className={buttonVariants({ variant: "outline" })} href="/sessions">{t("sessionManagement")}</Link>
            </div>
          </div>
        ) : sessionLoadState.status === "loading" ? (
          <div className="grid min-h-64 place-items-center rounded-xl border bg-background" aria-busy="true">
            <div className="grid justify-items-center gap-3" role="status" aria-live="polite">
              <RefreshCcw className="size-6 animate-spin text-primary" aria-hidden="true" />
              <span className="text-sm font-medium">{t("sessionLoading")}</span>
            </div>
          </div>
        ) : isOwner ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            {editor}
            <div className="grid content-start gap-3 xl:max-h-[calc(100dvh-7rem)] xl:overflow-auto xl:pr-1">
              <OwnerSessionPanel
                clientActionNotice={clientActionNotice}
                collabPresence={collabPresence}
                onRemoveClient={handleRemoveConnectedClient}
                removingClientSocketId={removingClientSocketId}
                session={session}
                sessionSaveState={sessionSaveState}
                snapshot={snapshot}
              />
              <Link className={cn(buttonVariants({ variant: "outline" }), "h-8")} href="/sessions">
                {t("sessionManagement")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <GuestSessionBar
              clientId={clientId}
              collabPresence={collabPresence}
              role={sessionRole}
              session={session}
              snapshot={snapshot}
            />
            {editor}
          </div>
        )}
      </main>
    </div>
  );
}

function GuestSessionBar({
  clientId,
  collabPresence,
  role,
  session,
  snapshot,
}: {
  clientId: string;
  collabPresence: ReturnType<typeof useCollabPresence>;
  role: SessionRole;
  session: CollaborationSession | null;
  snapshot: CollaborationSessionSnapshot | null;
}) {
  const t = useTranslations("Workspace");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-sm shadow-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <StatusBadge value={role} />
        <StatusBadge value={collabPresence.status === "connected" ? "online" : collabPresence.status === "error" ? "error" : "offline"} />
        <span className="truncate font-mono text-xs text-muted-foreground">{session?.id || t("loading")}</span>
        <span className="hidden max-w-[520px] truncate font-mono text-xs text-muted-foreground md:inline">
          {session?.drawingPath || "-"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Revision {snapshot?.revision ?? "-"}</span>
        <span>{role === "viewer" ? t("readOnly") : t("editSession")}</span>
        <span>{collabPresence.presence.length} online</span>
        {collabPresence.presence.slice(0, 5).map((client) => (
          <span
            key={client.socketId}
            className="flex max-w-[220px] min-w-0 items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-1 text-foreground"
          >
            {client.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-4 shrink-0 rounded-full" src={client.avatarUrl} />
            ) : null}
            <TruncatedValue
              text={`${client.displayName} @${client.userId}`}
              tooltip={`${client.displayName} (@${client.userId})`}
            />
            {client.role ? <span className="shrink-0"><StatusBadge value={client.role} /></span> : null}
          </span>
        ))}
        <TruncatedValue className="max-w-[220px] font-mono" text={collabPresence.socketId || clientId} />
      </div>
    </div>
  );
}

function OwnerSessionPanel({
  clientActionNotice,
  collabPresence,
  onRemoveClient,
  removingClientSocketId,
  session,
  sessionSaveState,
  snapshot,
}: {
  clientActionNotice: { tone: "success" | "error"; message: string } | null;
  collabPresence: ReturnType<typeof useCollabPresence>;
  onRemoveClient: (socketId: string) => Promise<void>;
  removingClientSocketId: string | null;
  session: CollaborationSession | null;
  sessionSaveState: {
    status: "ready" | "saving" | "saved" | "error";
    message?: string;
    result?: SessionSaveResult;
  };
  snapshot: CollaborationSessionSnapshot | null;
}) {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  return (
    <>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle as="h2">{t("ownerOverview")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <InfoRow
            label="Board"
            value={
              session?.drawingPath ? (
                <TruncatedValue
                  className="font-sans text-sm"
                  text={drawingDisplayName(session.drawingPath)}
                  tooltip={session.drawingPath}
                />
              ) : (
                "-"
              )
            }
          />
          <InfoRow label={t("connection")} value={<StatusBadge value={collabPresence.status === "connected" ? "online" : collabPresence.status === "error" ? "error" : "offline"} />} />
          <InfoRow label={t("people")} value={String(collabPresence.presence.length)} mono />
          <InfoRow label="Revision" value={String(snapshot?.revision || "-")} mono />
          <InfoRow label={t("changedBy")} value={snapshot?.updatedBy || "-"} mono />
          <InfoRow label={t("save")} value={<StatusBadge value={sessionSaveState.status} />} />
          {sessionSaveState.message ? <InfoRow label={t("result")} value={sessionSaveState.message} /> : null}
          <InfoRow label="Session-ID" value={session?.id || t("loading")} mono />
        </CardContent>
      </Card>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle as="h2">{t("connectedPeople")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {clientActionNotice ? (
            <div
              aria-live="polite"
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                clientActionNotice.tone === "error"
                  ? "border-destructive/25 bg-destructive/8 text-destructive"
                  : "border-success/25 bg-success/8 text-success-foreground",
              )}
            >
              {clientActionNotice.message}
            </div>
          ) : null}
          {collabPresence.presence.length === 0 ? (
            <div className="text-muted-foreground">{t("noConnectedPeople")}</div>
          ) : (
            collabPresence.presence.map((client) => (
              <div key={client.socketId} className="grid min-w-0 gap-1 rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {client.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="size-6 shrink-0 rounded-full" src={client.avatarUrl} />
                    ) : null}
                    <TruncatedValue
                      className="font-medium"
                      text={`${client.displayName} @${client.userId}`}
                      tooltip={`${client.displayName} (@${client.userId}) · ${client.socketId}`}
                    />
                    {client.role ? <span className="shrink-0"><StatusBadge value={client.role} /></span> : null}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7 shrink-0 border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                    onClick={() => void onRemoveClient(client.socketId)}
                    disabled={client.socketId === collabPresence.socketId || removingClientSocketId === client.socketId}
                    aria-label={t("removeFromSession", { name: client.displayName })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("joinedAt", { time: formatTime(client.joinedAt, locale) })}
                  {client.socketId === collabPresence.socketId ? ` · ${t("thisIsYou")}` : ""}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle as="h2">{t("sessionHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-1 text-sm">
          <SessionAuditFeed events={collabPresence.audit.slice(-4).reverse()} />
          {collabPresence.audit.length > 0 ? (
            <Dialog>
              <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="mt-2 w-fit" />}>
                {t("showAll")}
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{t("sessionHistory")}</DialogTitle>
                  <DialogDescription>
                    {t("historyDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] min-w-0 overflow-y-auto">
                  <SessionAuditTable events={collabPresence.audit.slice().reverse()} />
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

function SessionAuditFeed({ events }: { events: SessionAuditEvent[] }) {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  if (events.length === 0) {
    return (
      <div className="text-muted-foreground">
        {t("noEvents")}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 divide-y">
      {events.map((event) => (
        <div key={event.id} className="grid min-w-0 gap-0.5 py-2 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="text-xs font-semibold">{sessionAuditTypeLabel(event.type)}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatTime(event.at, locale)}</span>
          </div>
          <TruncatedValue className="text-xs text-muted-foreground" text={event.actor} />
        </div>
      ))}
    </div>
  );
}

const cursorColors = ["#2563eb", "#db2777", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5"];
let collabClientId: string | undefined;

function subscribeToClientId() {
  return () => undefined;
}

function getClientIdSnapshot() {
  collabClientId ??= createCollabClientId();
  return collabClientId;
}

function getServerClientIdSnapshot() {
  return "";
}

function cursorColorFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return cursorColors[hash % cursorColors.length];
}

function createCollabClientId() {
  const randomId =
    typeof window !== "undefined" && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `client-${randomId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function normalizeSessionRole(role?: string): SessionRole {
  if (role === "owner" || role === "viewer" || role === "collaborator") {
    return role;
  }

  return "collaborator";
}

function sessionRoleLabel(role: SessionRole) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "viewer") {
    return "Viewer";
  }

  return "Collaborator";
}

function sessionLoadErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message || message.includes("SKETCHBLOCK_") || /database|postgres/i.test(message)) {
    return fallback;
  }

  return message;
}

function TruncatedValue({
  text,
  tooltip,
  className,
}: {
  text: string;
  tooltip?: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("block min-w-0 cursor-default truncate", className)} />}>
        {text}
      </TooltipTrigger>
      <TooltipContent className="break-all font-mono text-xs">{tooltip || text}</TooltipContent>
    </Tooltip>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right", mono ? "font-mono text-xs" : "break-words leading-5")}>
        {mono && typeof value === "string" ? <TruncatedValue text={value} /> : value}
      </span>
    </div>
  );
}

function drawingDisplayName(path: string) {
  const fileName = drawingFileName(path);
  const title = fileName.replace(/\.excalidraw$/i, "").replace(/[-_]+/g, " ").trim();
  return title || "Unbenanntes Board";
}

function drawingFileName(path: string) {
  return path.split("/").pop() || path;
}

function drawingStatusLabel(status: DrawingFile["status"]) {
  const labels: Record<DrawingFile["status"], string> = {
    indexed: "Indexed",
    saved: "Saved",
    dirty: "Unsaved",
    stale: "Outdated",
    conflict: "Conflict",
  };

  return labels[status] || status;
}

function sessionLifecycleLabel(status: SessionLifecycleStatus) {
  const labels: Record<SessionLifecycleStatus, string> = {
    active: "Active",
    closed: "Closed",
    saved: "Saved",
  };

  return labels[status];
}

function sessionAuditTypeLabel(type: SessionAuditEvent["type"]) {
  const labels: Record<SessionAuditEvent["type"], string> = {
    session_created: "Created",
    session_joined: "Joined",
    snapshot_updated: "Snapshot",
    yjs_updated: "Live-Sync",
    client_kicked: "Removed",
    session_status_changed: "Status",
    session_closed: "Closed",
  };

  return labels[type];
}

function sessionAuditMessage(event: SessionAuditEvent) {
  const revision = typeof event.metadata?.revision === "number" ? event.metadata.revision : null;
  const status = event.metadata?.status;

  switch (event.type) {
    case "session_created":
      return "Session created for the board.";
    case "session_joined":
      return "A participant joined the session.";
    case "snapshot_updated":
      return revision ? `Snapshot updated to revision ${revision}.` : "Snapshot updated.";
    case "yjs_updated":
      return revision ? `Live state updated to revision ${revision}.` : "Live state updated.";
    case "client_kicked":
      return "A participant was removed from the session.";
    case "session_status_changed":
      return status === "active" || status === "saved" || status === "closed"
        ? `Session status changed to “${sessionLifecycleLabel(status)}”.`
        : "Session status changed.";
    case "session_closed":
      return "Session closed.";
  }
}

function translateSaveMessage(message: string) {
  return message;
}

function formatBytes(value?: number) {
  if (value === undefined) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(1)} KB`;
}

function formatTime(value?: string, locale = "en") {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatRelativeTime(value?: string, locale = "en") {
  if (!value) {
    return "–";
  }

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return "–";
  }

  const seconds = Math.round((Date.now() - then) / 1000);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 60) return relative.format(-seconds, "second");

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return relative.format(-minutes, "minute");
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return relative.format(-hours, "hour");
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return relative.format(-days, "day");
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
