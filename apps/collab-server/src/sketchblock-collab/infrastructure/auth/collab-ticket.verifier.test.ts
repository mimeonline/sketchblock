import { createHmac } from "node:crypto";

import { CollabTicketVerifier, type CollabTicketPayload } from "./collab-ticket.verifier.js";

const secret = "test-secret-value";

function sign(payload: Partial<CollabTicketPayload> = {}) {
  const fullPayload: CollabTicketPayload = {
    kind: "collab-ticket",
    sessionId: "session-1",
    clientId: "client-1",
    actor: "michael",
    displayName: "Michael",
    role: "owner",
    permission: "admin",
    expiresAt: Date.now() + 60_000,
    ...payload,
  };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");

  return `${encodedPayload}.${signature}`;
}

describe("CollabTicketVerifier", () => {
  const verifier = new CollabTicketVerifier();

  it("verifies valid tickets", () => {
    const result = verifier.verifyDetailed(sign(), secret);

    expect(result.ok).toBe(true);
    expect(result.ok && result.payload.sessionId).toBe("session-1");
  });

  it("returns a stable error for expired tickets", () => {
    const result = verifier.verifyDetailed(sign({ expiresAt: Date.now() - 1_000 }), secret);

    expect(result).toEqual({ ok: false, error: "collab_ticket_expired" });
  });

  it("returns a stable error for invalid signatures", () => {
    const result = verifier.verifyDetailed(`${sign()}x`, secret);

    expect(result).toEqual({ ok: false, error: "collab_ticket_invalid_signature" });
  });
});
