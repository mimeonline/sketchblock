export abstract class YjsDocumentRegistryPort {
  abstract getDocument(sessionId: string): Promise<unknown>;
  abstract applyUpdate(input: {
    sessionId: string;
    updateBase64: string;
    updatedBy: string;
  }): Promise<{ updateBase64: string; stateBase64: string }>;
  abstract mirrorSnapshot(input: {
    sessionId: string;
    snapshot: unknown;
    updatedBy: string;
  }): Promise<{ stateBase64: string }>;
  abstract getEncodedState(sessionId: string): Promise<string>;
  /** Returns the live Excalidraw elements of the collaborative document. */
  abstract getLiveElements(sessionId: string): Promise<unknown[]>;
  abstract deleteDocument(sessionId: string): void;
  /** Persists pending updates, then drops the in-memory document. Resolves false when activity during the release kept the document. */
  abstract releaseDocument(sessionId: string): Promise<boolean>;
}
