"use client";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { facilitationErrorKey } from "../errors";
import { useSceneToViewport } from "../hooks/useSceneToViewport";
import type { FacilitationAck, ModerationState, VotesState } from "../types";

function useSceneTick(api: ExcalidrawImperativeAPI | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!api) return;
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; setTick((n) => n + 1); });
    };
    const unsubscribe = api.onChange(bump);
    const unsubscribeScroll = api.onScrollChange(bump);
    return () => {
      unsubscribe?.();
      unsubscribeScroll?.();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [api]);
}

export function VoteOverlay({
  api,
  votes,
  voting,
  actorIds,
  onToggleVote,
}: {
  api: ExcalidrawImperativeAPI | null;
  votes: VotesState;
  voting: ModerationState["voting"];
  /** Identifiers under which the server may know this participant. */
  actorIds: string[];
  onToggleVote: (elementId: string) => Promise<FacilitationAck> | FacilitationAck;
}) {
  const t = useTranslations("Facilitation");
  const toViewport = useSceneToViewport();
  const [error, setError] = useState<string | null>(null);
  useSceneTick(api);

  const isMine = useCallback((voters: string[]) => voters.some((id) => actorIds.includes(id)), [actorIds]);
  const myVoteCount = useMemo(() => Object.values(votes).filter(isMine).length, [votes, isMine]);
  const votesLeft = Math.max(0, voting.votesPerParticipant - myVoteCount);

  const toggle = useCallback(async (elementId: string) => {
    const ack = await onToggleVote(elementId);
    setError(ack && ack.ok === false ? t(facilitationErrorKey(ack.error)) : null);
  }, [onToggleVote, t]);

  const appState = api?.getAppState();
  const elements = api?.getSceneElements() ?? [];
  const selectedId = appState ? Object.keys(appState.selectedElementIds ?? {})[0] : undefined;
  const selectedMine = selectedId ? isMine(votes[selectedId] ?? []) : false;

  const badges = [];
  if (api && appState && toViewport) {
    for (const element of elements) {
      const voters = votes[element.id];
      if (!voters || voters.length === 0 || element.isDeleted) continue;
      const { x, y } = toViewport({ sceneX: Math.max(element.x, element.x + element.width), sceneY: Math.min(element.y, element.y + element.height) }, appState);
      const left = x - appState.offsetLeft;
      const top = y - appState.offsetTop;
      const mine = isMine(voters);
      const label = t(mine ? "badgeMine" : "badgeLabel", { count: voters.length });
      const className = cn(
        "pointer-events-auto absolute z-10 grid h-6 min-w-6 -translate-y-1/2 translate-x-[-50%] place-items-center rounded-full border px-1.5 text-xs font-bold tabular-nums shadow outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        mine ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground",
      );
      badges.push(
        voting.open ? (
          <button key={element.id} type="button" data-testid="vote-badge" aria-label={label} aria-pressed={mine} className={className} style={{ left, top }} onClick={() => void toggle(element.id)}>
            {voters.length}
          </button>
        ) : (
          <span key={element.id} data-testid="vote-badge" role="img" aria-label={label} className={className} style={{ left, top }}>
            {voters.length}
          </span>
        ),
      );
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {badges}
      {voting.open ? (
        <div role="group" aria-label={t("votePanel")} className="pointer-events-auto absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
          <span className="font-semibold">{t("votePanel")}</span>
          <span aria-live="polite">{t("votesLeft", { count: votesLeft })}</span>
          <button
            type="button"
            disabled={!selectedId || (!selectedMine && votesLeft === 0)}
            onClick={() => selectedId && void toggle(selectedId)}
            className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {selectedMine ? t("unvote") : t("vote")}
          </button>
          {!selectedId ? <span className="text-xs text-muted-foreground">{t("selectToVote")}</span> : null}
          <span role="status" className={error ? "text-xs text-destructive" : "sr-only"}>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

export function VoteSummary({ api, votes, limit = 5 }: { api: ExcalidrawImperativeAPI | null; votes: VotesState; limit?: number }) {
  const t = useTranslations("Facilitation");
  const elements = api?.getSceneElements() ?? [];
  const ranked = Object.entries(votes)
    .map(([id, voters]) => [id, voters.length] as const)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  function labelFor(id: string) {
    const textOf = (element: { id: string; type: string; text?: string; containerId?: string | null }) => (element.text ?? "").trim();
    const direct = elements.find((element) => element.id === id);
    const own = direct && direct.type === "text" ? textOf(direct as never) : "";
    const bound = elements.find((element) => element.type === "text" && (element as { containerId?: string | null }).containerId === id);
    const text = own || (bound ? textOf(bound as never) : "");
    return text ? (text.length > 40 ? `${text.slice(0, 40)}…` : text) : t("elementFallback", { id: id.slice(0, 6) });
  }

  return (
    <section aria-label={t("votesSummary")} className="grid gap-1 text-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("votesSummary")}</h3>
      {ranked.length === 0 ? (
        <p className="text-muted-foreground">{t("votesSummaryEmpty")}</p>
      ) : (
        <ol className="grid gap-1">
          {ranked.map(([id, count]) => (
            <li key={id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">{labelFor(id)}</span>
              <span className="shrink-0 font-semibold tabular-nums">{t("voteCount", { count })}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
