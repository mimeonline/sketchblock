import { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import type { ServerOptions } from "socket.io";

import { CollabConfigService } from "../config/collab-config.service.js";

export class ConfiguredSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: CollabConfigService,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.config.allowedOrigins,
        methods: ["GET", "POST"],
      },
      maxHttpBufferSize: this.config.maxSnapshotBytes,
    });
  }
}
