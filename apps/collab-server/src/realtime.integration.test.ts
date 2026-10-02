import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { createHmac } from "node:crypto";
import * as Y from "yjs";
import { AppModule } from "./app.module.js";
import { SessionStorePort } from "./sketchblock-collab/application/ports/session-store.port.js";
import type { StoredSession } from "./sketchblock-collab/application/dtos/collab-schemas.js";
import { SnapshotConflict } from "./sketchblock-collab/application/dtos/snapshot-conflict.js";

function signTicket(role: "owner" | "collaborator" | "viewer", actor: string) {
  const payload = Buffer.from(JSON.stringify({ kind: "collab-ticket", sessionId: "socket-test", clientId: actor, actor, displayName: actor, role, permission: role === "viewer" ? "read" : "write", expiresAt: Date.now() + 60_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", "socket-test-secret").update(`collab-ticket.${payload}`).digest("base64url")}`;
}

function signServerTicket() {
  const payload = Buffer.from(JSON.stringify({ kind: "collab-ticket", sessionId: "*", clientId: "web-api", actor: "web-api", displayName: "web", role: "server", permission: "admin", expiresAt: Date.now() + 60_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", "socket-test-secret").update(`collab-ticket.${payload}`).digest("base64url")}`;
}

// Exercise the real Engine.IO polling transport without another client dependency.
class PollingClient {
  private sid = "";
  private sequence = 0;
  constructor(private readonly origin: string) {}
  private url() { return `${this.origin}/socket.io/?EIO=4&transport=polling${this.sid ? `&sid=${this.sid}` : ""}`; }
  private async read() {
    const response = await fetch(this.url(), { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`poll failed: ${response.status}`);
    return (await response.text()).split("\x1e");
  }
  private async send(packet: string) {
    const response = await fetch(this.url(), { method: "POST", body: packet, headers: { "Content-Type": "text/plain" }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`send failed: ${response.status}`);
  }
  async connectAsServer() {
    this.sid = JSON.parse((await this.read())[0].slice(1)).sid;
    await this.send(`40${JSON.stringify({ token: signServerTicket() })}`);
    expect((await this.read()).some((packet) => packet.startsWith("40"))).toBe(true);
  }
  async connect(role: "owner" | "collaborator" | "viewer", actor: string) {
    this.sid = JSON.parse((await this.read())[0].slice(1)).sid;
    await this.send(`40${JSON.stringify({ token: signTicket(role, actor) })}`);
    expect((await this.read()).some((packet) => packet.startsWith("40"))).toBe(true);
  }
  async emit(event: string, payload: unknown): Promise<Record<string, any>> {
    const id = ++this.sequence;
    await this.send(`42${id}${JSON.stringify([event, payload])}`);
    for (let attempt = 0; attempt < 10; attempt++) {
      for (const packet of await this.read()) {
        if (packet === "2") await this.send("3");
        if (packet.startsWith(`43${id}[`)) return JSON.parse(packet.slice(2 + String(id).length))[0];
      }
    }
    throw new Error("ack missing");
  }
  async close() { await this.send("1"); }
}

describe("Socket.IO multi-client collaboration", () => {
  let app: NestExpressApplication;
  let origin: string;
  let session: StoredSession | null = null;
  const clients: PollingClient[] = [];
  const now = new Date().toISOString();
  const store: SessionStorePort = {
    async getOrCreateSession(input) {
      session ??= { sessionId: input.sessionId, drawingPath: null, status: "active", createdAt: now, updatedAt: now, snapshot: null, audit: [] };
      return session;
    },
    async getSession() { return session; },
    async countSessions() { return session ? 1 : 0; },
    async upsertSnapshot(input) {
      if (input.baseRevision !== undefined && input.baseRevision !== (session?.snapshot?.revision ?? 0)) throw new SnapshotConflict(session?.snapshot ?? null);
      const snapshot = { sessionId: input.sessionId, drawingPath: null, content: input.content, revision: (session?.snapshot?.revision ?? 0) + 1, updatedBy: input.updatedBy, updatedAt: now };
      session!.snapshot = snapshot;
      return snapshot;
    },
    async upsertYjsState(input) { session!.yjsStateBase64 = input.stateBase64; session!.yjsRevision = (session!.yjsRevision ?? 0) + 1; return session!; },
    async appendSessionAudit() { return session; },
    async updateSessionStatus(input) { if (session) session.status = input.status; return session; },
    async deleteSession() { const previous = session; session = null; return previous; },
  };
  beforeAll(async () => {
    process.env.COLLAB_AUTH_SECRET = "socket-test-secret";
    process.env.COLLAB_LOG_LEVEL = "silent";
    process.env.COLLAB_DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
    process.env.COLLAB_SOCKET_EVENTS_PER_SOCKET_PER_MINUTE = "100";
    process.env.COLLAB_SOCKET_CONNECTS_PER_IP_PER_MINUTE = "100";
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SessionStorePort).useValue(store).compile();
    app = module.createNestApplication<NestExpressApplication>();
    await app.listen(0, "127.0.0.1");
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await Promise.allSettled(clients.map((client) => client.close()));
    await app?.close();
  });
  it("enforces viewer access, rejects concurrent stale snapshots, and resumes authoritative state", async () => {
    const [first, second, viewer] = Array.from({ length: 3 }, () => new PollingClient(origin));
    clients.push(first, second, viewer);
    await Promise.all([first.connect("collaborator", "first"), second.connect("collaborator", "second"), viewer.connect("viewer", "viewer")]);
    for (const [index, client] of [first, second, viewer].entries()) {
      expect(await client.emit("session:join", { sessionId: "socket-test", userId: `client-${index}` })).toMatchObject({ ok: true });
    }
    expect(await viewer.emit("canvas:update", { sessionId: "socket-test", updatedBy: "viewer", content: "forbidden", baseRevision: 0 })).toMatchObject({ ok: false, error: "not_authorized" });
    const results = await Promise.all([first, second].map((client, index) => client.emit("canvas:update", { sessionId: "socket-test", updatedBy: "spoofed", content: `change-${index}`, baseRevision: 0 })));
    expect(results.filter((ack) => ack.ok)).toHaveLength(1);
    expect(results.find((ack) => !ack.ok)).toMatchObject({ error: "snapshot_conflict", snapshot: { revision: 1 } });
    expect(["first", "second"]).toContain(session?.snapshot?.updatedBy);
    const docs = [new Y.Doc(), new Y.Doc()];
    docs.forEach((doc, index) => doc.getMap("elements").set(`edit-${index}`, index));
    await Promise.all([first, second].map((client, index) => client.emit("yjs:update", {
      sessionId: "socket-test", updatedBy: "spoofed", updateBase64: Buffer.from(Y.encodeStateAsUpdate(docs[index])).toString("base64"),
    })));
    expect(await viewer.emit("yjs:update", { sessionId: "socket-test", updatedBy: "viewer", updateBase64: Buffer.from(Y.encodeStateAsUpdate(docs[0])).toString("base64") })).toMatchObject({ ok: false, error: "not_authorized" });
    await second.close();
    const resumed = new PollingClient(origin); clients.push(resumed);
    await resumed.connect("collaborator", "second");
    const ack = await resumed.emit("session:join", { sessionId: "socket-test", userId: "second" });
    expect(ack.snapshot).toEqual(session?.snapshot);
    const recovered = new Y.Doc();
    Y.applyUpdate(recovered, Buffer.from(ack.yjsStateBase64, "base64"));
    expect([...recovered.getMap("elements").keys()].sort()).toEqual(["edit-0", "edit-1"]);
    docs.forEach((doc) => doc.destroy()); recovered.destroy();
    expect(ack.presence.filter((presence: { userId: string }) => presence.userId === "second")).toHaveLength(1);
  });

  it("removes a participant on all sockets and rejects their rejoin without excluding the owner", async () => {
    const owner = new PollingClient(origin);
    const first = new PollingClient(origin);
    const second = new PollingClient(origin);
    clients.push(owner, first, second);
    await owner.connect("owner", "owner-kick");
    await first.connect("collaborator", "removed-user");
    await second.connect("collaborator", "removed-user");
    const ownerJoin = await owner.emit("session:join", { sessionId: "socket-test", userId: "owner-kick" });
    const firstJoin = await first.emit("session:join", { sessionId: "socket-test", userId: "removed-user" });
    expect(await second.emit("session:join", { sessionId: "socket-test", userId: "removed-user" })).toMatchObject({ ok: true });

    // The web server (role server) issues the kick; owner presence is never excluded.
    const admin = new PollingClient(origin);
    clients.push(admin);
    await admin.connectAsServer();
    const ownerKick = await admin.emit("client:kick", { sessionId: "socket-test", socketId: ownerJoin.socketId, kickedBy: "web-api", excludeActor: true });  expect(ownerKick).toMatchObject({ ok: true, excluded: false });
    const ownerAgain = new PollingClient(origin);
    clients.push(ownerAgain);
    await ownerAgain.connect("owner", "owner-kick");
    expect(await ownerAgain.emit("session:join", { sessionId: "socket-test", userId: "owner-kick" })).toMatchObject({ ok: true });

    const kicked = await admin.emit("client:kick", { sessionId: "socket-test", socketId: firstJoin.socketId, kickedBy: "web-api", excludeActor: true });
    expect(kicked).toMatchObject({ ok: true, excluded: true });
    await expect(second.emit("session:inspect", { sessionId: "socket-test" })).rejects.toThrow();

    const rejoin = new PollingClient(origin);
    clients.push(rejoin);
    await rejoin.connect("collaborator", "removed-user");
    expect(await rejoin.emit("session:join", { sessionId: "socket-test", userId: "removed-user" })).toMatchObject({ ok: false, error: "participant_removed" });
  });

  it("ends live collaboration when the owner closes the session", async () => {
    const owner = new PollingClient(origin);
    const collaborator = new PollingClient(origin);
    clients.push(owner, collaborator);
    await owner.connect("owner", "owner");
    await collaborator.connect("collaborator", "late");
    expect(await owner.emit("session:join", { sessionId: "socket-test", userId: "owner" })).toMatchObject({ ok: true });
    expect(await collaborator.emit("yjs:update", { sessionId: "socket-test", updatedBy: "late", updateBase64: Buffer.from(Y.encodeStateAsUpdate(new Y.Doc())).toString("base64") })).toMatchObject({ ok: false, error: "session_not_joined" });
    const serverPayload = Buffer.from(JSON.stringify({ kind: "collab-ticket", sessionId: "*", clientId: "web-api", actor: "web-api", displayName: "web", role: "server", permission: "admin", expiresAt: Date.now() + 60_000 })).toString("base64url");
    const serverTicket = `${serverPayload}.${createHmac("sha256", "socket-test-secret").update(`collab-ticket.${serverPayload}`).digest("base64url")}`;
    const closed = await fetch(`${origin}/sessions/socket-test/close`, { method: "POST", headers: { Authorization: `Bearer ${serverTicket}`, "Content-Type": "application/json" }, body: JSON.stringify({ closedBy: "web-api" }) });
    expect(await closed.json()).toMatchObject({ ok: true, status: "closed" });
    expect(session?.status).toBe("closed");
    // Connected participants are disconnected by the server.
    await expect(owner.emit("session:inspect", { sessionId: "socket-test" })).rejects.toThrow();
    expect(await collaborator.emit("session:join", { sessionId: "socket-test", userId: "late" })).toMatchObject({ ok: false, error: "session_closed" });
    expect(await collaborator.emit("canvas:update", { sessionId: "socket-test", updatedBy: "late", content: "after-close" })).toMatchObject({ ok: false, error: "session_not_joined" });
  });
});
