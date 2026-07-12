import { Inject, Injectable } from "@nestjs/common";

import { DatabaseDiagnosticsPort } from "../ports/database-diagnostics.port.js";

@Injectable()
export class GetDatabaseDiagnosticsUseCase {
  constructor(
    @Inject(DatabaseDiagnosticsPort)
    private readonly diagnostics: DatabaseDiagnosticsPort,
  ) {}

  execute() {
    return this.diagnostics.inspect();
  }
}
