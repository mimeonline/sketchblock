export class SessionClosed extends Error {
  constructor(readonly sessionId: string) {
    super("session_closed");
  }
}
