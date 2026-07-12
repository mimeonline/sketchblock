import "server-only";

type DiagnosticError = {
  code: string;
  occurredAt: string;
  requestId?: string;
};

let lastError: DiagnosticError | null = null;

export function recordDiagnosticError(code: string, requestId?: string) {
  lastError = { code: sanitizeCode(code), occurredAt: new Date().toISOString(), requestId };
}

export function getLastDiagnosticError() {
  return lastError;
}

function sanitizeCode(code: string) {
  return /^[a-z0-9._:-]{1,128}$/i.test(code) ? code : "unexpected_error";
}
