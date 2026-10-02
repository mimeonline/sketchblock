import type { SessionSnapshot } from "./collab-schemas.js";

export class SnapshotConflict extends Error {
  constructor(readonly snapshot: SessionSnapshot | null) {
    super("snapshot_conflict");
  }
}
