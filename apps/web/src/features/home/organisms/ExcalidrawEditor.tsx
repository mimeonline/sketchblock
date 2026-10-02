"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { Maximize2, Minimize2, Scan } from "lucide-react";

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
  demoMode?: boolean;
  saveLabel?: string;
  toolbarContent?: ReactNode;
  /** Overrides the default sync/save hint above the canvas. */
  hint?: string;
  onDirty?: () => void;
  onSceneChange?: (content: unknown) => void;
  onSave?: (content: unknown) => Promise<void>;
  onPointerUpdate?: (payload: { pointer: { x: number; y: number }; button: "up" | "down" }) => void;
  /** Facilitation hooks: scroll/zoom changes, API handle and an overlay layer above the canvas. */
  onScrollChange?: (scrollX: number, scrollY: number, zoom: { value: number }) => void;
  onApiReady?: (api: ExcalidrawImperativeAPI | null) => void;
  canvasOverlay?: ReactNode;
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
      scrollToContent: true,
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
  demoMode = false,
  saveLabel,
  toolbarContent,
  hint,
  onDirty,
  onSceneChange,
  onSave,
  onPointerUpdate,
  onScrollChange,
  onApiReady,
  canvasOverlay,
  remoteCursors,
  yjsSync,
}: ExcalidrawEditorProps) {
  const t = useTranslations("Editor");
  const locale = useLocale();
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
  const [saveError, setSaveError] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const hasFittedContentRef = useRef(false);
  const restoreElementsRef = useRef<typeof import("@excalidraw/excalidraw").restoreElements | null>(null);

  useEffect(() => {
    if (!fullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = editorRef.current;
    const isolatedElements: HTMLElement[] = [];
    // Keep the mounted canvas (and unsaved scene) while isolating the expanded workspace.
    for (let branch: HTMLElement | null = root; branch?.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement && !sibling.hasAttribute("inert")) {
          sibling.setAttribute("inert", "");
          isolatedElements.push(sibling);
        }
      }
      if (branch.parentElement === document.body) break;
    }
    fullscreenButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setFullscreen(false);
      }
      if (event.key === "Tab" && root) {
        const controls = Array.from(root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        )).filter((element) => !element.closest('[inert], [aria-hidden="true"]') && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      isolatedElements.forEach((element) => element.removeAttribute("inert"));
      previousFocus?.focus();
    };
  }, [fullscreen]);

  const initialData = useMemo(
    () => normalizeInitialContent(initialContent),
    [initialContent],
  );

  const handleExcalidrawApi = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawApiRef.current = api;
    setExcalidrawApi(api);
    onApiReady?.(api);
  }, [onApiReady]);

  const fitBoard = useCallback(() => {
    excalidrawApiRef.current?.scrollToContent(undefined, { fitToContent: true, maxZoom: 1, animate: false });
  }, []);

  useEffect(() => {
    if (!excalidrawApi || !initialData.elements?.length || hasFittedContentRef.current) return;
    let active = true;
    const frame = requestAnimationFrame(() => {
      void (async () => {
        // Excalidraw registers/loads scene fonts during initialization. Measuring earlier
        // uses fallback metrics and can clip imported text once the real font arrives.
        await document.fonts?.ready;
        const { restoreElements } = await import("@excalidraw/excalidraw");
        restoreElementsRef.current = restoreElements;
        if (!active || hasUserInteractedRef.current) return;
        // Re-measure text with the loaded fonts; this is a local render fix and is
        // not propagated to collaborators because no user interaction happened yet.
        excalidrawApi.updateScene({
          elements: restoreElements(excalidrawApi.getSceneElements(), null, { refreshDimensions: true, repairBindings: true }),
          captureUpdate: "NEVER",
        });
        fitBoard();
        hasFittedContentRef.current = true;
      })();
    });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [excalidrawApi, fitBoard, initialData]);

  const prepareRemoteElements = useCallback((elements: Parameters<NonNullable<Parameters<typeof useExcalidrawYjs>[0]["prepareRemoteElements"]>>[0]) => {
    const restoreElements = restoreElementsRef.current;
    if (!restoreElements) return elements;
    return restoreElements(elements, null, { refreshDimensions: true }) as typeof elements;
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
    prepareRemoteElements,
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
    if (nextData.files) {
      excalidrawApiRef.current.addFiles(Object.values(nextData.files));
    }
    // Checkpoints carry binary assets; Yjs exclusively owns the live element document.
    if (yjsSync?.enabled) return;
    isApplyingRemoteRef.current = true;
    hasUserInteractedRef.current = false;
    suppressLocalChangeUntilRef.current = window.performance.now() + 500;

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
  }, [readOnly, remoteContent, remoteRevision, yjsSync?.enabled]);

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
        username: cursor.displayName || t("guestName"),
        pointer: { x: cursor.pointer.x, y: cursor.pointer.y, tool: "pointer" },
        button: cursor.button || "up",
        color: cursor.color ? { background: cursor.color, stroke: cursor.color } : undefined,
        selectedElementIds: {},
      });
    }

    api.updateScene({ collaborators } as Parameters<ExcalidrawImperativeAPI["updateScene"]>[0]);
  }, [remoteCursors, t]);

  async function handleSave() {
    if (!onSave) {
      return;
    }

    setSaving(true);
    setSaveError(false);
    try {
      await onSave(sceneRef.current ?? initialData);
      hasUserInteractedRef.current = false;
      hasReportedDirtyRef.current = false;
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={editorRef}
      aria-label={fullscreen ? t("fullscreenBoard") : undefined}
      aria-modal={fullscreen || undefined}
      className={cn(
        "grid h-[max(420px,calc(100dvh-16rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border bg-white shadow-sm",
        className,
        fullscreen && "fixed inset-0 z-50 h-dvh rounded-none border-0",
      )}
      role={fullscreen ? "dialog" : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-white px-3 py-2 text-xs text-muted-foreground">
        <div className="min-w-0 flex-1 basis-40" aria-live="polite">
          {saveError ? <span role="alert" className="text-destructive">{t("saveFailed")}</span> : (
            <span className="leading-5">
              {hint ?? (mode === "owner"
                ? demoMode ? t(onSceneChange ? "demoLiveHint" : "demoLocalHint") : t(onSceneChange ? "ownerLiveHint" : "ownerLocalHint")
                : t(readOnly ? "viewerHint" : demoMode ? "demoCollaboratorHint" : "collaboratorHint"))}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbarContent}
          <Button type="button" variant="ghost" size="icon" onClick={fitBoard} aria-label={t("fitBoard")} title={t("fitBoard")}>
            <Scan className="size-4" />
          </Button>
          <Button ref={fullscreenButtonRef} type="button" variant="ghost" size="icon" onClick={() => setFullscreen((current) => !current)} aria-label={fullscreen ? t("leaveFullscreen") : t("enterFullscreen")} title={fullscreen ? t("leaveFullscreen") : t("enterFullscreen")}>
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          {mode === "owner" && onSave ? (
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || saveDisabled}>
              {saving ? t("saving") : saveLabel || t(demoMode ? "saveDemo" : "saveGitHub")}
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className={cn("relative min-h-0 bg-white", canvasClassName)}
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
          langCode={locale === "de" ? "de-DE" : "en"}
          viewModeEnabled={readOnly}
          UIOptions={{
            canvasActions: {
              toggleTheme: false,
            },
          }}
          onScrollChange={onScrollChange}
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
        {canvasOverlay}
      </div>
    </div>
  );
}
