"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useExcalidrawYjs } from "@/features/home/hooks/useExcalidrawYjs";
import { cn } from "@/lib/utils";
import type { CollabCursor } from "@/types/sketchblock";

const WHITE_CANVAS = "#ffffff";

function EditorLoadingState() {
  const t = useTranslations("Editor");
  return (
    <div className="grid h-full min-h-[min(460px,70dvh)] place-items-center bg-white text-sm text-muted-foreground" role="status" aria-live="polite">
      {t("loadingBoard")}
    </div>
  );
}

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: EditorLoadingState,
  },
);

type ExcalidrawEditorProps = {
  className?: string;
  canvasClassName?: string;
  mode?: "owner" | "guest";
  initialContent?: unknown;
  remoteContent?: unknown;
  remoteRevision?: number;
  readOnly?: boolean;
  saveDisabled?: boolean;
  onDirty?: () => void;
  onSceneChange?: (content: unknown) => void;
  onSave?: (content: unknown) => Promise<void>;
  onPointerUpdate?: (payload: { pointer: { x: number; y: number }; button: "up" | "down" }) => void;
  remoteCursors?: CollabCursor[];
  yjsSync?: {
    sessionId: string;
    clientId: string;
    enabled: boolean;
    canSeed: boolean;
    initialStateBase64?: string | null;
    remoteUpdate?: {
      updateBase64: string;
      updatedBy: string;
      sequence: number;
    } | null;
    onSendUpdate: (updateBase64: string) => void;
  };
};

function normalizeInitialContent(initialContent: unknown): ExcalidrawInitialDataState {
  if (initialContent && typeof initialContent === "object") {
    const content = initialContent as {
      appState?: Record<string, unknown>;
      elements?: unknown;
      files?: unknown;
    };
    const appState = content.appState || {};

    return {
      elements: Array.isArray(content.elements)
        ? (content.elements as ExcalidrawInitialDataState["elements"])
        : [],
      appState: {
        currentItemBackgroundColor:
          typeof appState.currentItemBackgroundColor === "string"
            ? appState.currentItemBackgroundColor
            : "transparent",
        currentItemStrokeColor:
          typeof appState.currentItemStrokeColor === "string"
            ? appState.currentItemStrokeColor
            : "#087980",
        gridSize: typeof appState.gridSize === "number" ? appState.gridSize : undefined,
        name: typeof appState.name === "string" ? appState.name : undefined,
        viewBackgroundColor: WHITE_CANVAS,
      },
      files: content.files && typeof content.files === "object" ? (content.files as BinaryFiles) : {},
    };
  }

  return {
    elements: [],
    appState: {
      viewBackgroundColor: WHITE_CANVAS,
      currentItemBackgroundColor: "transparent",
      currentItemStrokeColor: "#087980",
    },
  };
}

export function ExcalidrawEditor({
  className,
  canvasClassName,
  mode = "owner",
  initialContent,
  remoteContent,
  remoteRevision,
  readOnly = false,
  saveDisabled = false,
  onDirty,
  onSceneChange,
  onSave,
  onPointerUpdate,
  remoteCursors,
  yjsSync,
}: ExcalidrawEditorProps) {
  const t = useTranslations("Editor");
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const sceneRef = useRef<unknown>(null);
  const hasUserInteractedRef = useRef(false);
  const hasReportedDirtyRef = useRef(false);
  const hasAppliedInitialContentRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const suppressLocalChangeUntilRef = useRef(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!fullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullscreen]);

  const initialData = useMemo(
    () => normalizeInitialContent(initialContent),
    [initialContent],
  );

  const handleExcalidrawApi = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawApiRef.current = api;
    setExcalidrawApi(api);
  }, []);

  const yjs = useExcalidrawYjs({
    sessionId: yjsSync?.sessionId || "inactive",
    clientId: yjsSync?.clientId || "inactive",
    enabled: Boolean(yjsSync?.enabled),
    readOnly,
    canSeed: Boolean(yjsSync?.canSeed),
    api: excalidrawApi,
    initialContent,
    initialStateBase64: yjsSync?.initialStateBase64,
    remoteUpdate: yjsSync?.remoteUpdate,
    onSendUpdate: yjsSync?.onSendUpdate || (() => {}),
    onBeforeRemoteApply: () => {
      isApplyingRemoteRef.current = true;
      hasUserInteractedRef.current = false;
      suppressLocalChangeUntilRef.current = window.performance.now() + 160;
    },
    onAfterRemoteApply: () => {
      window.setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 160);
    },
  });

  useEffect(() => {
    if (!initialContent || !excalidrawApi || hasAppliedInitialContentRef.current) {
      return;
    }

    hasAppliedInitialContentRef.current = true;
    if (excalidrawApi.getSceneElements().length > 0) {
      return;
    }

    const nextData = normalizeInitialContent(initialContent);
    isApplyingRemoteRef.current = true;
    suppressLocalChangeUntilRef.current = window.performance.now() + 500;

    if (nextData.files) {
      excalidrawApi.addFiles(Object.values(nextData.files));
    }

    excalidrawApi.updateScene({
      elements: nextData.elements,
      appState: {
        viewBackgroundColor: WHITE_CANVAS,
        viewModeEnabled: readOnly,
      },
      captureUpdate: "NEVER",
    });

    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 500);
  }, [excalidrawApi, initialContent, readOnly]);

  useEffect(() => {
    if (!remoteContent || remoteRevision === undefined || !excalidrawApiRef.current) {
      return;
    }

    const nextData = normalizeInitialContent(remoteContent);
    isApplyingRemoteRef.current = true;
    hasUserInteractedRef.current = false;
    suppressLocalChangeUntilRef.current = window.performance.now() + 500;

    if (nextData.files) {
      excalidrawApiRef.current.addFiles(Object.values(nextData.files));
    }

    excalidrawApiRef.current.updateScene({
      elements: nextData.elements,
      appState: {
        viewBackgroundColor: WHITE_CANVAS,
        viewModeEnabled: readOnly,
      },
      captureUpdate: "NEVER",
    });

    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 500);
  }, [readOnly, remoteContent, remoteRevision]);

  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

    const collaborators = new Map<string, unknown>();
    for (const cursor of remoteCursors ?? []) {
      if (!cursor.pointer) {
        continue;
      }
      collaborators.set(cursor.socketId, {
        id: cursor.socketId,
        username: cursor.displayName || "Gast",
        pointer: { x: cursor.pointer.x, y: cursor.pointer.y, tool: "pointer" },
        button: cursor.button || "up",
        color: cursor.color ? { background: cursor.color, stroke: cursor.color } : undefined,
        selectedElementIds: {},
      });
    }

    api.updateScene({ collaborators } as Parameters<ExcalidrawImperativeAPI["updateScene"]>[0]);
  }, [remoteCursors]);

  async function handleSave() {
    if (!onSave) {
      return;
    }

    setSaving(true);
    try {
      await onSave(sceneRef.current ?? initialData);
      hasUserInteractedRef.current = false;
      hasReportedDirtyRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-label={fullscreen ? "Board im Vollbild" : undefined}
      aria-modal={fullscreen || undefined}
      className={cn(
        "grid min-h-[55dvh] grid-rows-[1fr_auto] overflow-hidden rounded-xl border bg-white shadow-sm sm:min-h-[620px]",
        className,
        fullscreen && "fixed inset-0 z-50 min-h-screen rounded-none border-0",
      )}
      role={fullscreen ? "dialog" : undefined}
    >
      <div
        className={cn("min-h-[48dvh] bg-white sm:min-h-[560px]", canvasClassName, fullscreen && "min-h-0")}
        onInputCapture={() => {
          if (!readOnly) {
            hasUserInteractedRef.current = true;
          }
        }}
        onKeyDownCapture={() => {
          if (!readOnly) {
            hasUserInteractedRef.current = true;
          }
        }}
        onPasteCapture={() => {
          if (!readOnly) {
            hasUserInteractedRef.current = true;
          }
        }}
        onPointerDownCapture={() => {
          if (!readOnly) {
            hasUserInteractedRef.current = true;
          }
        }}
      >
        <Excalidraw
          excalidrawAPI={handleExcalidrawApi}
          initialData={initialData}
          theme="light"
          UIOptions={{
            canvasActions: {
              toggleTheme: false,
            },
          }}
          onPointerUpdate={(payload) => {
            onPointerUpdate?.({
              pointer: { x: payload.pointer.x, y: payload.pointer.y },
              button: payload.button,
            });
          }}
          onChange={(elements, appState, files) => {
            sceneRef.current = {
              type: "excalidraw",
              version: 2,
              source: "sketchblock",
              elements,
              appState: {
                ...appState,
                viewBackgroundColor: WHITE_CANVAS,
                viewModeEnabled: readOnly,
              },
              files,
            };

            if (
              !readOnly &&
              yjsSync?.enabled &&
              !isApplyingRemoteRef.current &&
              !yjs.isApplyingRemoteRef.current &&
              window.performance.now() > suppressLocalChangeUntilRef.current &&
              hasUserInteractedRef.current
            ) {
              yjs.applyLocalScene(elements as readonly OrderedExcalidrawElement[]);
            }

            if (
              !readOnly &&
              !isApplyingRemoteRef.current &&
              !yjs.isApplyingRemoteRef.current &&
              window.performance.now() > suppressLocalChangeUntilRef.current &&
              hasUserInteractedRef.current
            ) {
              if (!hasReportedDirtyRef.current) {
                hasReportedDirtyRef.current = true;
                onDirty?.();
              }
              onSceneChange?.(sceneRef.current);
            }
          }}
        />
      </div>
      <div className="flex flex-col gap-3 border-t bg-white px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="leading-5">
          {mode === "owner"
            ? onSceneChange
              ? t("ownerLiveHint")
              : t("ownerLocalHint")
            : readOnly
              ? t("viewerHint")
              : t("collaboratorHint")}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setFullscreen((current) => !current)}
            aria-label={fullscreen ? t("leaveFullscreen") : t("enterFullscreen")}
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          {mode === "owner" ? (
            <Button type="button" onClick={handleSave} disabled={saving || saveDisabled}>
              {saving ? t("saving") : t("saveGitHub")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
