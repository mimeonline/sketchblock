"use client";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useEffect, useMemo } from "react";

import { useSceneToViewport, type SceneToViewport } from "../hooks/useSceneToViewport";
import type { IncomingReaction } from "../types";

const LIFETIME_MS = 2400;

function FloatingReaction({ reaction, api, toViewport, onDone }: { reaction: IncomingReaction; api: ExcalidrawImperativeAPI | null; toViewport: SceneToViewport | null; onDone: (id: number) => void }) {
  useEffect(() => {
    const id = window.setTimeout(() => onDone(reaction.id), LIFETIME_MS);
    return () => window.clearTimeout(id);
  }, [reaction.id, onDone]);

  // Position is resolved once, at arrival, in canvas-relative viewport coordinates.
  const position = useMemo(() => {
    const appState = api?.getAppState();
    if (reaction.pointer && appState && toViewport) {
      const { x, y } = toViewport({ sceneX: reaction.pointer.x, sceneY: reaction.pointer.y }, appState);
      return { left: x - appState.offsetLeft, top: y - appState.offsetTop };
    }
    return { left: 48 + ((reaction.id * 53) % 200), top: 160 };
  }, [api, toViewport, reaction.id, reaction.pointer]);

  return (
    <span
      className="sb-reaction absolute flex flex-col items-center text-3xl leading-none"
      style={position}
    >
      <span aria-hidden="true">{reaction.emoji}</span>
      {reaction.displayName ? <span className="mt-0.5 max-w-24 truncate rounded bg-foreground/70 px-1 text-[10px] text-background">{reaction.displayName}</span> : null}
    </span>
  );
}

export function ReactionLayer({ reactions, api, onDone }: { reactions: IncomingReaction[]; api: ExcalidrawImperativeAPI | null; onDone: (id: number) => void }) {
  const toViewport = useSceneToViewport();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {reactions.map((reaction) => (
        <FloatingReaction key={reaction.id} reaction={reaction} api={api} toViewport={toViewport} onDone={onDone} />
      ))}
    </div>
  );
}
