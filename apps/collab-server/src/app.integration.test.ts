import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { createHmac } from "node:crypto";
import request from "supertest";

import { AppModule } from "./app.module.js";
import { SessionStorePort } from "./sketchblock-collab/application/ports/session-store.port.js";
import { CollabConfigService } from "./shared/infrastructure/config/collab-config.service.js";
import { configureHttpBodyParser } from "./shared/infrastructure/http/configure-http-body-parser.js";
import { configureOpenApi } from "./shared/infrastructure/http/configure-open-api.js";
import { SnapshotConflict } from "./sketchblock-collab/application/dtos/snapshot-conflict.js";

describe("Collab server HTTP integration", () => {
  let app: NestExpressApplication;
  const sessionStore: SessionStorePort = {
    async getOrCreateSession(input) {
      const now = new Date().toISOString();
      return {
        sessionId: input.sessionId,
        drawingPath: input.drawingPath || null,
        status: "active",
        createdAt: now,
        updatedAt: now,
        snapshot:
          input.initialContent === undefined
            ? null
            : {
                sessionId: input.sessionId,
                drawingPath: input.drawingPath || null,
                revision: 1,
                content: input.initialContent,
                updatedAt: now,
                updatedBy: "github",
              },
        yjsRevision: 1,
        audit: [],
      };
    },
    async upsertSnapshot() {
      throw new Error("not implemented in HTTP integration test");
    },
    async upsertYjsState() {
      throw new Error("not implemented in HTTP integration test");
    },
    async updateSessionStatus() {
      throw new Error("not implemented in HTTP integration test");
    },
    async appendSessionAudit() {
      throw new Error("not implemented in HTTP integration test");
    },
    async getSession() {
      return null;
    },
    async countSessions() {
      return 0;
    },
    async deleteSession() {
      return null;
    },
  };

  beforeAll(async () => {
    process.env.COLLAB_AUTH_SECRET = "";
    process.env.APP_AUTH_SECRET = "";
    process.env.COLLAB_ALLOW_INSECURE_NO_AUTH = "true";
    process.env.COLLAB_ALLOWED_ORIGINS = "http://localhost:4512";
    process.env.COLLAB_MAX_SNAPSHOT_BYTES = "200000";
    process.env.COLLAB_HTTP_REQUESTS_PER_IP_PER_MINUTE = "2";
    process.env.COLLAB_SOCKET_CONNECTS_PER_IP_PER_MINUTE = "2";
    process.env.COLLAB_SOCKET_EVENTS_PER_SOCKET_PER_MINUTE = "2";
    process.env.COLLAB_LOG_LEVEL = "silent";
    process.env.COLLAB_TRUST_PROXY = "true";
    process.env.COLLAB_DATABASE_URL = "postgresql://test:test@127.0.0.1:1/sketchblock_test";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SessionStorePort)
      .useValue(sessionStore)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpBodyParser(app, app.get(CollabConfigService).maxSnapshotBytes);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("serves health and metrics", async () => {
    await request(app.getHttpServer())
      .get("/health")
      .set("x-forwarded-for", "198.51.100.1")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          service: "sketchblock-collab-server",
          status: "ok",
          transport: "socket.io",
        });
      });

    const publicHealth = await request(app.getHttpServer()).get("/").set("x-forwarded-for", "198.51.100.5").expect(200);
    expect(Object.keys(publicHealth.body).sort()).toEqual(["service", "status", "transport"]);
  });

  it("keeps metrics closed when collab auth is not configured", async () => {
    await request(app.getHttpServer())
      .get("/metrics")
      .set("x-forwarded-for", "198.51.100.2")
      .expect(503)
      .expect(({ body }) => expect(body.error).toBe("collab_auth_not_configured"));
  });

  it("keeps internal diagnostics closed when collab auth is not configured", async () => {
    await request(app.getHttpServer())
      .get("/internal/diagnostics")
      .set("x-forwarded-for", "198.51.100.20")
      .expect(503)
      .expect(({ body }) => {
        expect(body.error).toBe("collab_auth_not_configured");
      });
  });

  it("rate limits repeated HTTP requests per IP", async () => {
    const ip = "198.51.100.3";

    await request(app.getHttpServer()).get("/").set("x-forwarded-for", ip).expect(200);
    await request(app.getHttpServer()).get("/").set("x-forwarded-for", ip).expect(200);

    await request(app.getHttpServer())
      .get("/")
      .set("x-forwarded-for", ip)
      .expect(429)
      .expect(({ body }) => {
        expect(body.error).toBe("rate_limit_exceeded");
      });
  });

  it("accepts an Excalidraw session payload larger than the NestJS 100 KB default", async () => {
    const initialContent = {
      type: "excalidraw",
      version: 2,
      elements: [],
      appState: {},
      files: {},
      padding: "x".repeat(112_000),
    };

    await request(app.getHttpServer())
      .post("/sessions")
      .set("x-forwarded-for", "198.51.100.4")
      .send({
        sessionId: "large-payload-session",
        userId: "web-api",
        displayName: "Sketchblock Web",
        drawingPath: "Workshop/Software Factory Workshop.excalidraw",
        initialContent,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          ok: true,
          sessionId: "large-payload-session",
          revision: 1,
        });
      });
  });

  it("returns an actionable 409 for a stale HTTP snapshot revision", async () => {
    const current = { sessionId: "conflict-session", drawingPath: null, revision: 8, content: { elements: ["current"] }, updatedAt: new Date().toISOString(), updatedBy: "current-writer" };
    const upsert = vi.spyOn(sessionStore, "upsertSnapshot").mockImplementation(async (input) => {
      expect(input.baseRevision).toBe(7);
      throw new SnapshotConflict(current);
    });
    try {
      await request(app.getHttpServer())
        .patch("/sessions/conflict-session/state")
        .set("x-forwarded-for", "198.51.100.30")
        .send({ baseRevision: 7, content: { elements: ["stale"] }, updatedBy: "web-api" })
        .expect(409)
        .expect(({ body }) => expect(body).toEqual({ ok: false, error: "snapshot_conflict", code: "snapshot_conflict", snapshot: current }));
      expect(upsert).toHaveBeenCalledTimes(1);
    } finally {
      upsert.mockRestore();
    }
  });
});

function signTicket(role: "server" | "collaborator", secret: string) {
  const permission = role === "server" ? "admin" : "write";
  const payload = Buffer.from(JSON.stringify({ kind: "collab-ticket", sessionId: role === "server" ? "*" : "s", clientId: role, actor: role, displayName: role, role, permission, expiresAt: Date.now() + 60_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(`collab-ticket.${payload}`).digest("base64url")}`;
}

describe("Collab server HTTP integration with auth", () => {
  let app: NestExpressApplication;
  const secret = "metrics-test-secret";

  beforeAll(async () => {
    process.env.COLLAB_AUTH_SECRET = secret;
    process.env.COLLAB_HTTP_REQUESTS_PER_IP_PER_MINUTE = "100";
    process.env.COLLAB_LOG_LEVEL = "silent";
    process.env.COLLAB_DATABASE_URL = "postgresql://test:test@127.0.0.1:1/sketchblock_test";
    delete process.env.COLLAB_EXPOSE_API_DOCS;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SessionStorePort)
      .useValue({ async countSessions() { return 0; }, async getSession() { return null; } })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureOpenApi(app, app.get(CollabConfigService).exposeApiDocs);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    process.env.COLLAB_AUTH_SECRET = "";
  });

  it("requires a server admin ticket for metrics", async () => {
    await request(app.getHttpServer()).get("/metrics").expect(401);
    await request(app.getHttpServer()).get("/metrics").set("Authorization", `Bearer ${signTicket("collaborator", secret)}`).expect(403);
    await request(app.getHttpServer())
      .get("/metrics")
      .set("Authorization", `Bearer ${signTicket("server", secret)}`)
      .expect(200)
      .expect(({ body }) => expect(body.sessions.maxActiveSessions).toBeGreaterThan(0));
  });

  it("does not mount API docs by default", async () => {
    await request(app.getHttpServer()).get("/docs").expect(404);
  });
});
