export class SessionSnapshotEntity {
  constructor(
    readonly sessionId: string,
    readonly drawingPath: string | null,
    readonly revision: number,
    readonly content: unknown,
    readonly updatedAt: string,
    readonly updatedBy: string,
  ) {}

  static nextRevision(currentRevision: number | undefined) {
    return (currentRevision || 0) + 1;
  }
}
