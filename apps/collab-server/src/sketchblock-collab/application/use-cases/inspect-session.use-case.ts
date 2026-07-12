import { Inject, Injectable } from "@nestjs/common";

import { PresenceStorePort } from "../ports/presence-store.port.js";
import { GetSessionStateUseCase } from "./get-session-state.use-case.js";

@Injectable()
export class InspectSessionUseCase {
  constructor(
    @Inject(GetSessionStateUseCase) private readonly getSessionState: GetSessionStateUseCase,
    @Inject(PresenceStorePort) private readonly presence: PresenceStorePort,
  ) {}

  async execute(sessionId: string) {
    const state = await this.getSessionState.execute(sessionId);
    const presence = this.presence.getPresence(sessionId);

    return {
      ...state,
      presence,
      presenceCount: presence.length,
    };
  }
}
