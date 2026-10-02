"use client";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RemoteViewport } from "../types";

const THROTTLE_MS = 100;

/** Participant side: applies the owner's viewport while following is on and not locally stopped. */
export function useFollowOwner({ api, followOwner, isOwner, viewport }: { api: ExcalidrawImperativeAPI | null; followOwner: boolean; isOwner: boolean; viewport: RemoteViewport | null }) {
  const [stoppedFor, setStoppedFor] = useState<boolean>(false);
  // The local opt-out only lasts for the current "follow me" period.
  const [previousFollow, setPreviousFollow] = useState(followOwner);
  if (previousFollow !== followOwner) {
    setPreviousFollow(followOwner);
    if (!followOwner) setStoppedFor(false);
  }
  const following = followOwner && !isOwner && !stoppedFor;

  useEffect(() => {
    if (!following || !api || !viewport) return;
    api.updateScene({
      appState: { scrollX: viewport.scrollX, scrollY: viewport.scrollY, zoom: { value: viewport.zoom } },
      captureUpdate: "NEVER",
    } as unknown as Parameters<ExcalidrawImperativeAPI["updateScene"]>[0]);
  }, [api, following, viewport]);

  return { following, active: followOwner && !isOwner, stopped: stoppedFor, setStopped: setStoppedFor };
}

/** Owner side: throttled (trailing) viewport broadcast, only while "follow me" is on. */
export function useViewportBroadcast({ api, enabled, send }: { api: ExcalidrawImperativeAPI | null; enabled: boolean; send: (viewport: { scrollX: number; scrollY: number; zoom: number }) => void }) {
  const sendRef = useRef(send);
  const enabledRef = useRef(enabled);
  const lastSentRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ scrollX: number; scrollY: number; zoom: number } | null>(null);
  useEffect(() => { sendRef.current = send; enabledRef.current = enabled; });

  const flush = useCallback(() => {
    timerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending || !enabledRef.current) return;
    lastSentRef.current = Date.now();
    sendRef.current(pending);
  }, []);

  const onScrollChange = useCallback((scrollX: number, scrollY: number, zoom: { value: number }) => {
    if (!enabledRef.current) return;
    pendingRef.current = { scrollX, scrollY, zoom: zoom.value };
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(flush, Math.max(0, THROTTLE_MS - (Date.now() - lastSentRef.current)));
  }, [flush]);

  // Sync followers immediately when "follow me" is switched on.
  useEffect(() => {
    if (!enabled || !api) return;
    const state = api.getAppState();
    sendRef.current({ scrollX: state.scrollX, scrollY: state.scrollY, zoom: state.zoom.value });
  }, [api, enabled]);

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);

  return onScrollChange;
}
