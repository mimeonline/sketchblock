import { Inject, Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

import { PresenceStorePort } from "../../application/ports/presence-store.port.js";
import { SessionConnectionsPort } from "../../application/ports/session-connections.port.js";
import { YjsDocumentRegistryPort } from "../../application/ports/yjs-document-registry.port.js";
import { isGuestTicket } from "../auth/collab-ticket.verifier.js";
import { FacilitationRegistry } from "./facilitation.registry.js";
import { SessionParticipantExclusions, type GuestAccessPolicy } from "./session-participant-exclusions.js";

export function sessionRoomName(sessionId: string) {
  return `session:${sessionId}`;
}

@Injectable()
export class SocketSessionConnections extends SessionConnectionsPort {
  private server: Server | null = null;

  constructor(
    @Inject(PresenceStorePort) private readonly presence: PresenceStorePort,
    @Inject(YjsDocumentRegistryPort) private readonly yjsDocuments: YjsDocumentRegistryPort,
    @Inject(SessionParticipantExclusions) private readonly exclusions: SessionParticipantExclusions,
    @Inject(FacilitationRegistry) private readonly facilitation: FacilitationRegistry,
  ) {
    super();
  }

  attach(server: Server) {
    this.server = server;
  }

  async setGuestAccess(sessionId: string, policy: GuestAccessPolicy) {
    // Block joins before awaiting the adapter so concurrent joins cannot slip through.
    this.exclusions.applyGuestPolicy(sessionId, policy);
    if (!policy.enabled && this.server) {
      const sockets = await this.server.in(sessionRoomName(sessionId)).fetchSockets();
      for (const socket of sockets) {
        const auth = socket.data.auth;
        if (!isGuestTicket(auth)) continue;
        this.presence.removePresence(socket.id);
        socket.emit("client:kicked", { sessionId, socketId: socket.id, kickedBy: "web-api" });
        await socket.leave(sessionRoomName(sessionId));
        socket.disconnect(true);
      }
      this.server.to(sessionRoomName(sessionId)).emit("presence:update", {
        sessionId, presence: this.presence.getPresence(sessionId),
      });
    }
  }

  async endSession(sessionId: string, input: { closedBy: string }) {
    const room = sessionRoomName(sessionId);
    if (this.server) {
      this.server.to(room).emit("session:closed", { sessionId, closedBy: input.closedBy });
      this.server.in(room).disconnectSockets(true);
    }
    this.presence.deleteSession(sessionId);
    this.exclusions.clear(sessionId);
    this.facilitation.clear(sessionId);
    await this.yjsDocuments.releaseDocument(sessionId);
  }
}
