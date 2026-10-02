export class StorageConflictError extends Error {
  readonly status = 409;

  constructor(message = "The board was changed after it was opened.") {
    super(message);
    this.name = "StorageConflictError";
  }
}
