import { Pool } from "pg";

import { CollabConfigService } from "../config/collab-config.service.js";

export function createCollabPostgresPool(config: CollabConfigService) {
  if (!config.databaseUrl) {
    throw new Error("COLLAB_DATABASE_URL is required when COLLAB_PERSISTENCE_DRIVER=postgres");
  }

  return new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
  });
}
