import "server-only";

import type { SessionRole } from "@/types/sketchblock";
import type { GitHubRepositoryPermission } from "@/lib/server/auth/permissions";
import { signPayload } from "@/lib/server/auth/crypto";

const COLLAB_TICKET_MAX_AGE_MS = 5 * 60 * 1000;

export type CollabTicketPayload = {
  kind: "collab-ticket";
  sessionId: string;
  clientId: string;
  actor: string;
  displayName: string;
  avatarUrl?: string | null;
  role: SessionRole | "server";
  permission: GitHubRepositoryPermission | "admin";
  expiresAt: number;
};

export function createCollabTicket(input: Omit<CollabTicketPayload, "kind" | "expiresAt">) {
  return signPayload({
    kind: "collab-ticket",
    ...input,
    expiresAt: Date.now() + COLLAB_TICKET_MAX_AGE_MS,
  });
}

export function createServerCollabTicket() {
  return createCollabTicket({
    sessionId: "*",
    clientId: "web-api",
    actor: "web-api",
    displayName: "Sketchblock Web",
    avatarUrl: null,
    role: "server",
    permission: "admin",
  });
}
