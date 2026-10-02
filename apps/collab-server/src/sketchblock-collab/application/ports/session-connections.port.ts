export abstract class SessionConnectionsPort {
  /** Notifies connected clients, disconnects them and releases live in-memory state. */
  abstract endSession(sessionId: string, input: { closedBy: string }): Promise<void>;
}
