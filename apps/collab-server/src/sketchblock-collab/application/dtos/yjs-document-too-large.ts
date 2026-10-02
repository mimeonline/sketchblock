export class YjsDocumentTooLarge extends Error {
  constructor(
    readonly sizeBytes: number,
    readonly limitBytes: number,
  ) {
    super("yjs_document_too_large");
  }
}
