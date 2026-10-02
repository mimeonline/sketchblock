"use client";

import { useEffect, useState } from "react";

/** Seconds remaining until `endsAt` (null when no timer or already expired). Ticks once per second. */
export function useCountdown(endsAt?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    const initial = window.setTimeout(tick, 0);
    return () => { window.clearInterval(id); window.clearTimeout(initial); };
  }, [endsAt]);
  if (!endsAt) return null;
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return null;
  const seconds = Math.ceil((end - now) / 1000);
  return seconds > 0 ? seconds : 0;
}

export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
