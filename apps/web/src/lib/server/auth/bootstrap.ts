import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";

const MIN_BOOTSTRAP_TOKEN_LENGTH = 24;

const bootstrapRuntime = globalThis as typeof globalThis & {
  sketchblockBootstrapToken?: string;
  sketchblockBootstrapTokenLogged?: boolean;
};

export function getBootstrapTokenStatus() {
  const token = getBootstrapToken();
  return {
    configured: token.length >= MIN_BOOTSTRAP_TOKEN_LENGTH,
    generated: !hasConfiguredBootstrapToken() && token.length >= MIN_BOOTSTRAP_TOKEN_LENGTH,
    minimumLength: MIN_BOOTSTRAP_TOKEN_LENGTH,
  };
}

export function verifyBootstrapToken(candidate: string) {
  const configured = getBootstrapToken();
  if (configured.length < MIN_BOOTSTRAP_TOKEN_LENGTH || candidate.length !== configured.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(candidate), Buffer.from(configured));
}

function getBootstrapToken() {
  const configured = process.env.SKETCHBLOCK_BOOTSTRAP_TOKEN?.trim() || "";
  if (configured) return configured;

  bootstrapRuntime.sketchblockBootstrapToken ||= randomBytes(32).toString("hex");
  if (!bootstrapRuntime.sketchblockBootstrapTokenLogged) {
    console.warn(
      `\n[Sketchblock First Run]\nEinmaliger Setup-Code: ${bootstrapRuntime.sketchblockBootstrapToken}\nÖffne /setup und gib diesen Code in das Feld „Einmaliger Setup-Code“ ein.\n`,
    );
    bootstrapRuntime.sketchblockBootstrapTokenLogged = true;
  }
  return bootstrapRuntime.sketchblockBootstrapToken;
}

function hasConfiguredBootstrapToken() {
  return Boolean(process.env.SKETCHBLOCK_BOOTSTRAP_TOKEN?.trim());
}
