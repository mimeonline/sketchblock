"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import * as Y from "yjs";

type SketchblockScene = {
  elements?: unknown;
};

type RemoteYjsUpdate = {
  updateBase64: string;
  updatedBy: string;
  sequence: number;
};

type UseExcalidrawYjsInput = {
  sessionId: string;
  clientId: string;
  enabled: boolean;
  readOnly: boolean;
  canSeed: boolean;
  api: ExcalidrawImperativeAPI | null;
  initialContent?: unknown;
  initialStateBase64?: string | null;
  remoteUpdate?: RemoteYjsUpdate | null;
  onSendUpdate: (updateBase64: string) => void;
  onBeforeRemoteApply?: () => void;
  onAfterRemoteApply?: () => void;
};

type StoredElement = ExcalidrawElement & {
  id: string;
  version?: number;
  versionNonce?: number;
  index?: string;
};

const ELEMENTS_MAP_NAME = "elements";
const LOCAL_ORIGIN = "sketchblock:local";
const REMOTE_ORIGIN = "sketchblock:remote";
const SEED_ORIGIN = "sketchblock:seed";
const LOCAL_UPDATE_INTERVAL_MS = 50;

function base64ToUint8Array(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function uint8ArrayToBase64(value: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < value.length; index += chunkSize) {
    binary += String.fromCharCode(...value.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function sceneElements(content: unknown): StoredElement[] {
  if (!content || typeof content !== "object") {
    return [];
  }

  const elements = (content as SketchblockScene).elements;
  return Array.isArray(elements) ? (elements as StoredElement[]) : [];
}

function cloneElement(element: StoredElement): StoredElement {
  return JSON.parse(JSON.stringify(element)) as StoredElement;
}

function shouldWriteElement(next: StoredElement, current?: StoredElement) {
  if (!current) {
    return true;
  }

  const nextVersion = next.version ?? 0;
  const currentVersion = current.version ?? 0;

  if (nextVersion > currentVersion) {
    return true;
  }

  if (nextVersion < currentVersion) {
    return false;
  }

  return (next.versionNonce ?? 0) > (current.versionNonce ?? 0);
}

function compareElementOrder(a: StoredElement, b: StoredElement) {
  if (typeof a.index === "string" && typeof b.index === "string" && a.index !== b.index) {
    return a.index.localeCompare(b.index);
  }

  return a.id.localeCompare(b.id);
}

export function useExcalidrawYjs({
  sessionId,
  clientId,
  enabled,
  readOnly,
  canSeed,
  api,
  initialContent,
  initialStateBase64,
  remoteUpdate,
  onSendUpdate,
  onBeforeRemoteApply,
  onAfterRemoteApply,
}: UseExcalidrawYjsInput) {
  const docRef = useRef<Y.Doc | null>(null);
  const mapRef = useRef<Y.Map<StoredElement> | null>(null);
  const initializedSessionRef = useRef<string | null>(null);
  const seededSessionRef = useRef<string | null>(null);
  const appliedRemoteSequenceRef = useRef(0);
  const pendingLocalUpdatesRef = useRef<Uint8Array[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const initialStateBase64Ref = useRef(initialStateBase64);
  const onSendUpdateRef = useRef(onSendUpdate);
  const onBeforeRemoteApplyRef = useRef(onBeforeRemoteApply);
  const onAfterRemoteApplyRef = useRef(onAfterRemoteApply);

  const initialElements = useMemo(() => sceneElements(initialContent), [initialContent]);

  useEffect(() => {
    initialStateBase64Ref.current = initialStateBase64;
    onSendUpdateRef.current = onSendUpdate;
    onBeforeRemoteApplyRef.current = onBeforeRemoteApply;
    onAfterRemoteApplyRef.current = onAfterRemoteApply;
  }, [initialStateBase64, onAfterRemoteApply, onBeforeRemoteApply, onSendUpdate]);

  useEffect(() => {
    if (!enabled || !api || initializedSessionRef.current === sessionId) {
      return;
    }

    initializedSessionRef.current = sessionId;
    const doc = new Y.Doc();
    const elementsMap = doc.getMap<StoredElement>(ELEMENTS_MAP_NAME);
    appliedRemoteSequenceRef.current = 0;
    docRef.current = doc;
    mapRef.current = elementsMap;

    function applyMapToScene() {
      if (!api) {
        return;
      }

      const elements = Array.from(elementsMap.values()).sort(compareElementOrder);
      isApplyingRemoteRef.current = true;
      onBeforeRemoteApplyRef.current?.();
      api.updateScene({
        elements,
        captureUpdate: "NEVER",
      });
      window.setTimeout(() => {
        isApplyingRemoteRef.current = false;
        onAfterRemoteApplyRef.current?.();
      }, 120);
    }

    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== LOCAL_ORIGIN && origin !== SEED_ORIGIN) {
        return;
      }

      pendingLocalUpdatesRef.current.push(update);
      if (flushTimerRef.current) {
        return;
      }

      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        const pending = pendingLocalUpdatesRef.current;
        pendingLocalUpdatesRef.current = [];
        if (pending.length === 0) {
          return;
        }

        const mergedUpdate = pending.length === 1 ? pending[0] : Y.mergeUpdates(pending);
        onSendUpdateRef.current(uint8ArrayToBase64(mergedUpdate));
      }, LOCAL_UPDATE_INTERVAL_MS);
    });

    if (initialStateBase64Ref.current) {
      Y.applyUpdate(doc, base64ToUint8Array(initialStateBase64Ref.current), REMOTE_ORIGIN);
    }

    elementsMap.observe((event) => {
      if (event.transaction.origin === LOCAL_ORIGIN || event.transaction.origin === SEED_ORIGIN) {
        return;
      }

      applyMapToScene();
    });

    // Legacy/server-side Yjs state can contain metadata without an element map.
    // An empty map must never replace a snapshot that Excalidraw has already loaded.
    if (elementsMap.size > 0) {
      applyMapToScene();
    }

    return () => {
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
      }
      pendingLocalUpdatesRef.current = [];
      doc.destroy();
      if (docRef.current === doc) {
        docRef.current = null;
        mapRef.current = null;
        initializedSessionRef.current = null;
      }
    };
  }, [
    api,
    enabled,
    sessionId,
  ]);

  useEffect(() => {
    const doc = docRef.current;
    const elementsMap = mapRef.current;

    if (
      !enabled ||
      !canSeed ||
      !doc ||
      !elementsMap ||
      elementsMap.size > 0 ||
      initialElements.length === 0 ||
      seededSessionRef.current === sessionId
    ) {
      return;
    }

    seededSessionRef.current = sessionId;
    doc.transact(() => {
      for (const element of initialElements) {
        elementsMap.set(element.id, cloneElement(element));
      }
    }, SEED_ORIGIN);
  }, [canSeed, enabled, initialElements, sessionId]);

  useEffect(() => {
    const doc = docRef.current;
    if (!enabled || !doc || !remoteUpdate || remoteUpdate.sequence <= appliedRemoteSequenceRef.current) {
      return;
    }

    appliedRemoteSequenceRef.current = remoteUpdate.sequence;
    if (remoteUpdate.updatedBy === clientId) {
      return;
    }

    Y.applyUpdate(doc, base64ToUint8Array(remoteUpdate.updateBase64), REMOTE_ORIGIN);
  }, [clientId, enabled, remoteUpdate]);

  function applyLocalScene(elements: readonly StoredElement[]) {
    const doc = docRef.current;
    const elementsMap = mapRef.current;

    if (!enabled || readOnly || isApplyingRemoteRef.current || !doc || !elementsMap) {
      return;
    }

    doc.transact(() => {
      for (const element of elements) {
        const current = elementsMap.get(element.id);
        if (shouldWriteElement(element, current)) {
          elementsMap.set(element.id, cloneElement(element));
        }
      }
    }, LOCAL_ORIGIN);
  }

  return {
    applyLocalScene,
    isApplyingRemoteRef,
  };
}
