"use client";

import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";

import { formatCountdown, useCountdown } from "../hooks/useCountdown";
import type { ModerationState } from "../types";

export function TimerChip({ timer }: { timer: ModerationState["timer"] }) {
  const t = useTranslations("Facilitation");
  const remaining = useCountdown(timer?.endsAt);
  if (!timer || remaining === null) return null;
  return (
    <span
      role="timer"
      aria-label={t("timerChip", { time: formatCountdown(remaining) })}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${remaining === 0 ? "border-destructive/40 bg-destructive/10 text-destructive" : "bg-background"}`}
    >
      <Timer className="size-3.5" aria-hidden="true" />
      {timer.label ? <span className="max-w-32 truncate font-medium">{timer.label}</span> : null}
      {formatCountdown(remaining)}
    </span>
  );
}
