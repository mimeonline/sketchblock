"use client";

import { Lock, Navigation } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { ReactionBar } from "../molecules/ReactionBar";
import { TimerChip } from "../molecules/TimerChip";
import type { FacilitationAck, ModerationState, ReactionEmoji } from "../types";

/** Banners (follow / lock), timer chip and reaction bar shown above the canvas to every role. */
export function FacilitationStrip({
  moderation,
  isOwner,
  following,
  followActive,
  onToggleFollow,
  onReaction,
  getPointer,
}: {
  moderation: ModerationState;
  isOwner: boolean;
  following: boolean;
  /** True while the owner has "follow me" on (for non-owners). */
  followActive: boolean;
  onToggleFollow: () => void;
  onReaction: (emoji: ReactionEmoji, pointer?: { x: number; y: number }) => Promise<FacilitationAck> | FacilitationAck | void;
  getPointer?: () => { x: number; y: number } | undefined;
}) {
  const t = useTranslations("Facilitation");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {followActive ? (
        <div role="status" className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1">
          <Navigation className="size-3.5 text-primary" aria-hidden="true" />
          <span>{following ? t("following") : null}</span>
          <Button type="button" size="xs" variant="outline" onClick={onToggleFollow}>
            {following ? t("stopFollowing") : t("resumeFollowing")}
          </Button>
        </div>
      ) : null}
      {moderation.editingLocked && !isOwner ? (
        <div role="status" className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-950">
          <Lock className="size-3.5" aria-hidden="true" />
          {t("lockedBanner")}
        </div>
      ) : null}
      <TimerChip timer={moderation.timer} />
      <div className="ml-auto">
        <ReactionBar onSend={onReaction} getPointer={getPointer} />
      </div>
    </div>
  );
}
