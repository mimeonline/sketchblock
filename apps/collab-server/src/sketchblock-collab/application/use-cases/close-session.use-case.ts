import { Inject, Injectable } from "@nestjs/common";

import { UpdateSessionStatusUseCase } from "./update-session-status.use-case.js";

@Injectable()
export class CloseSessionUseCase {
  constructor(@Inject(UpdateSessionStatusUseCase) private readonly updateSessionStatus: UpdateSessionStatusUseCase) {}

  async execute(input: { sessionId: string; closedBy: string }) {
    return this.updateSessionStatus.execute({
      sessionId: input.sessionId,
      status: "closed",
      updatedBy: input.closedBy,
      message: "Session closed.",
    });
  }
}
