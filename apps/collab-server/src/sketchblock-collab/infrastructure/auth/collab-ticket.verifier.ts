import { createHmac, timingSafeEqual } from "node:crypto";

import { Injectable } from "@nestjs/common";

export type CollabTicketPayload = {
  kind: "collab-ticket";
  sessionId: string;
  clientId: string;
  actor: string;
  displayName: string;
  avatarUrl?: string | null;
  role: "owner" | "collaborator" | "viewer" | "server";
  permission: "read" | "triage" | "write" | "maintain" | "admin";
  expiresAt: number;
};
export type CollabTicketErrorCode =
  | "collab_ticket_missing"
  | "collab_ticket_malformed"
  | "collab_ticket_invalid_signature"
  | "collab_ticket_expired"
  | "collab_ticket_invalid";
export type CollabTicketVerification =
  | { ok: true; payload: CollabTicketPayload }
  | { ok: false; error: CollabTicketErrorCode };

function base64UrlDecode(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

@Injectable()
export class CollabTicketVerifier {
  verify(token: unknown, secret?: string | null): CollabTicketPayload | null {
    const result = this.verifyDetailed(token, secret);
    return result.ok ? result.payload : null;
  }

  verifyDetailed(token: unknown, secret?: string | null): CollabTicketVerification {
    if (!secret) {
      return { ok: false, error: "collab_ticket_missing" };
    }

    if (typeof token !== "string") {
      return { ok: false, error: "collab_ticket_missing" };
    }

    const [encodedPayload, encodedSignature] = token.split(".");
    if (!encodedPayload || !encodedSignature) {
      return { ok: false, error: "collab_ticket_malformed" };
    }

    const expected = createHmac("sha256", secret).update(encodedPayload).digest();
    const actual = base64UrlDecode(encodedSignature);

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return { ok: false, error: "collab_ticket_invalid_signature" };
    }

    try {
      const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as CollabTicketPayload;

      if (payload.kind !== "collab-ticket") {
        return { ok: false, error: "collab_ticket_invalid" };
      }

      if (payload.expiresAt < Date.now()) {
        return { ok: false, error: "collab_ticket_expired" };
      }

      return { ok: true, payload };
    } catch {
      return { ok: false, error: "collab_ticket_malformed" };
    }
  }
}
