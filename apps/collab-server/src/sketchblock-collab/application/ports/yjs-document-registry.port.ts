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
  abstract deleteDocument(sessionId: string): void;
}
