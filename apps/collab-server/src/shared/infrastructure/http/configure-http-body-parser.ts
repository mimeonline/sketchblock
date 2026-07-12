import type { NestExpressApplication } from "@nestjs/platform-express";

export function configureHttpBodyParser(app: NestExpressApplication, maxBodyBytes: number) {
  app.useBodyParser("json", { limit: maxBodyBytes });
  app.useBodyParser("urlencoded", { extended: true, limit: maxBodyBytes });
}
