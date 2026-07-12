import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "./app.module.js";
import { SessionStorePort } from "./sketchblock-collab/application/ports/session-store.port.js";
import { CollabConfigService } from "./shared/infrastructure/config/collab-config.service.js";
import { configureHttpBodyParser } from "./shared/infrastructure/http/configure-http-body-parser.js";

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
    process.env.COLLAB_ALLOWED_ORIGINS = "http://localhost:4512";
    process.env.COLLAB_MAX_SNAPSHOT_BYTES = "200000";
    process.env.COLLAB_HTTP_REQUESTS_PER_IP_PER_MINUTE = "2";
    process.env.COLLAB_SOCKET_CONNECTS_PER_IP_PER_MINUTE = "2";
    process.env.COLLAB_SOCKET_EVENTS_PER_SOCKET_PER_MINUTE = "2";
    process.env.COLLAB_LOG_LEVEL = "silent";
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

    await request(app.getHttpServer())
      .get("/metrics")
      .set("x-forwarded-for", "198.51.100.2")
      .expect(200)
      .expect(({ body }) => {
        expect(body.sessions.maxActiveSessions).toBeGreaterThan(0);
        expect(body.limits.httpRequestsPerIpPerMinute).toBe(2);
      });
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
});
