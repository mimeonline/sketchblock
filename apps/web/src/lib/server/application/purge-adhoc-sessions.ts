import "server-only";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { purgeCollabSession } from "@/lib/server/collab/collab-server-client";
import {
  deleteSessionsByIds,
  listPurgeableAdhocSessions,
  markExpiredAdhocSessionsForPurge,
} from "@/lib/server/database/session-store";
import { adhocRetentionHours } from "@/lib/server/domain/session-lifecycle";

const MIN_INTERVAL_MS = 10 * 60 * 1000;
const BATCH_SIZE = 50;
let lastRun = 0;

/** Opportunistic cleanup of expired ad-hoc sessions; runs at most every 10 minutes per process. */
export async function purgeExpiredAdhocSessions(options: { force?: boolean } = {}) {
  const nowMs = Date.now();
  if (!options.force && nowMs - lastRun < MIN_INTERVAL_MS) {
    return { skipped: true, purged: [] as string[], failed: [] as string[] };
  }
  lastRun = nowMs;

  const now = new Date(nowMs);
  await markExpiredAdhocSessionsForPurge(now, adhocRetentionHours());
  const ids = await listPurgeableAdhocSessions(now, BATCH_SIZE);
  const purged: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    const result = await purgeCollabSession(id);
    if (result.ok) purged.push(id);
    else failed.push(id);
  }
  if (purged.length > 0) {
    await deleteSessionsByIds(purged);
    for (const id of purged) {
      await safeRecordAuditEvent({
        actorId: null,
        actorUsername: "system",
        actorRole: "system",
        action: "session.purge",
        targetType: "session",
        targetId: id,
        outcome: "success",
        metadata: { sourceKind: "adhoc" },
      });
    }
  }
  return { skipped: false, purged, failed };
}

/** Test helper. */
export function resetPurgeThrottleForTests() {
  lastRun = 0;
}
