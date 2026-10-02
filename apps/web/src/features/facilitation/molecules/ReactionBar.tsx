"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { facilitationErrorKey } from "../errors";
import { REACTION_EMOJIS, type FacilitationAck, type ReactionEmoji } from "../types";

export function ReactionBar({
  onSend,
  getPointer,
}: {
  onSend: (emoji: ReactionEmoji, pointer?: { x: number; y: number }) => Promise<FacilitationAck> | FacilitationAck | void;
  getPointer?: () => { x: number; y: number } | undefined;
}) {
  const t = useTranslations("Facilitation");
  const [error, setError] = useState<string | null>(null);

  async function send(emoji: ReactionEmoji) {
    const ack = await onSend(emoji, getPointer?.());
    setError(ack && ack.ok === false ? t(facilitationErrorKey(ack.error)) : null);
  }

  return (
    <div role="group" aria-label={t("reactions")} className="flex items-center gap-1 rounded-full border bg-background px-1.5 py-1 shadow-sm">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={t("reactionSend", { emoji })}
          onClick={() => void send(emoji)}
          className="grid size-8 place-items-center rounded-full text-lg outline-none transition-transform hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
      <span role="status" className={error ? "px-2 text-xs text-destructive" : "sr-only"}>{error}</span>
    </div>
  );
}
