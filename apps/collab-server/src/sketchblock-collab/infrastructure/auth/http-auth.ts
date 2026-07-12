import type { CollabTicketPayload } from "./collab-ticket.verifier.js";

type HeaderRequest = {
  headers: {
    authorization?: string;
  };
};

export type CollabHttpRequest = {
  collabAuth?: CollabTicketPayload | null;
} & HeaderRequest;

export function readBearerToken(request: HeaderRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}
