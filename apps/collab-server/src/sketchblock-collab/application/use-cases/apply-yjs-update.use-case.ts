import { Inject, Injectable } from "@nestjs/common";

import type { YjsUpdatePayload } from "../dtos/collab-schemas.js";
import { YjsDocumentRegistryPort } from "../ports/yjs-document-registry.port.js";

@Injectable()
export class ApplyYjsUpdateUseCase {
  constructor(@Inject(YjsDocumentRegistryPort) private readonly yjsDocuments: YjsDocumentRegistryPort) {}

  async execute(input: YjsUpdatePayload) {
    return this.yjsDocuments.applyUpdate(input);
  }
}
