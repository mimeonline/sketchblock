"use client";

import { Switch } from "@base-ui/react/switch";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { facilitationErrorKey } from "../errors";
import { TimerChip } from "../molecules/TimerChip";
import type { FacilitationAck, ModerationState, ModerationUpdate } from "../types";

const TIMER_PRESETS = [1, 3, 5, 10] as const;
const switchRoot = "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[checked]:bg-primary motion-reduce:transition-none";
const switchThumb = "block size-4 translate-x-0.5 rounded-full bg-background transition-transform data-[checked]:translate-x-4 motion-reduce:transition-none";

export function ModerationBar({
  moderation,
  onUpdate,
  children,
}: {
  moderation: ModerationState;
  onUpdate: (update: ModerationUpdate) => Promise<FacilitationAck> | FacilitationAck | void;
  /** Extra content below the controls, e.g. the vote summary. */
  children?: ReactNode;
}) {
  const t = useTranslations("Facilitation");
  const [votes, setVotes] = useState(moderation.voting.votesPerParticipant);
  const [error, setError] = useState<string | null>(null);

  async function send(update: ModerationUpdate) {
    const ack = await onUpdate(update);
    setError(ack && ack.ok === false ? t(facilitationErrorKey(ack.error)) : null);
  }

  const clampVotes = (value: number) => Math.min(10, Math.max(1, Math.round(value) || 1));

  return (
    <section aria-label={t("moderationTitle")} className="grid gap-3 rounded-xl border bg-background px-4 py-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("moderationTitle")}</h2>
        <label className="flex items-center gap-2">
          <Switch.Root checked={moderation.followOwner} onCheckedChange={(value) => void send({ followOwner: value })} className={switchRoot}>
            <Switch.Thumb className={switchThumb} />
          </Switch.Root>
          <span>{t("followMe")}</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch.Root checked={moderation.editingLocked} onCheckedChange={(value) => void send({ editingLocked: value })} className={switchRoot}>
            <Switch.Thumb className={switchThumb} />
          </Switch.Root>
          <span>{t("lockEditing")}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("timer")}>
        <span className="text-muted-foreground">{t("timer")}</span>
        {TIMER_PRESETS.map((minutes) => (
          <Button key={minutes} type="button" size="sm" variant="outline" onClick={() => void send({ timer: { durationSeconds: minutes * 60 } })}>
            {t("timerPreset", { minutes })}
          </Button>
        ))}
        {moderation.timer ? (
          <>
            <TimerChip timer={moderation.timer} />
            <Button type="button" size="sm" variant="ghost" onClick={() => void send({ timer: null })}>{t("timerStop")}</Button>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("voting")}>
        <span className="text-muted-foreground">{t("voting")}</span>
        <label className="flex items-center gap-1.5">
          <span>{t("votesPerPerson")}</span>
          <input
            type="number"
            min={1}
            max={10}
            value={votes}
            onChange={(event) => setVotes(clampVotes(Number(event.target.value)))}
            className="h-7 w-14 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        {moderation.voting.open ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => void send({ voting: { open: false } })}>{t("votingStop")}</Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void send({ voting: { open: true, votesPerParticipant: votes } })}>{t("votingStart")}</Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => void send({ resetVotes: true })}>{t("resetVotes")}</Button>
      </div>

      {moderation.editingLocked ? <p className="text-xs text-muted-foreground">{t("lockedOwnerHint")}</p> : null}
      <p role="alert" className={error ? "text-xs text-destructive" : "sr-only"}>{error}</p>
      {children}
    </section>
  );
}
