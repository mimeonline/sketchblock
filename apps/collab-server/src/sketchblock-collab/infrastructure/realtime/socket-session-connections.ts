import { Inject, Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

import { PresenceStorePort } from "../../application/ports/presence-store.port.js";
import { SessionConnectionsPort } from "../../application/ports/session-connections.port.js";
import { YjsDocumentRegistryPort } from "../../application/ports/yjs-document-registry.port.js";

export function sessionRoomName(sessionId: string) {
  return `session:${sessionId}`;
}

@Injectable()
export class SocketSessionConnections extends SessionConnectionsPort {
  private server: Server | null = null;

  constructor(
    @Inject(PresenceStorePort) private readonly presence: PresenceStorePort,
    @Inject(YjsDocumentRegistryPort) private readonly yjsDocuments: YjsDocumentRegistryPort,
  ) {
    super();
  }

  attach(server: Server) {
    this.server = server;
  }

  async endSession(sessionId: string, input: { closedBy: string }) {
    const room = sessionRoomName(sessionId);
    if (this.server) {
      this.server.to(room).emit("session:closed", { sessionId, closedBy: input.closedBy });
      this.server.in(room).disconnectSockets(true);
    }
    this.presence.deleteSession(sessionId);
    await this.yjsDocuments.releaseDocument(sessionId);
  }
}
