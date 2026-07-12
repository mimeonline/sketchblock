import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ENCRYPTED_SECRET_VERSION = "v1";

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function getAuthSecret() {
  const secret = process.env.APP_AUTH_SECRET?.trim();

  if (!secret || secret.length < 24) {
    throw new Error("Missing APP_AUTH_SECRET. Set a long random value in apps/web/.env.local.");
  }

  return secret;
}

export function signPayload(payload: object) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getAuthSecret()).update(encodedPayload).digest();

  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export function verifySignedPayload<T extends object>(token?: string | null): T | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expected = createHmac("sha256", getAuthSecret()).update(encodedPayload).digest();
  const actual = base64UrlDecode(encodedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_SECRET_VERSION,
    base64UrlEncode(iv),
    base64UrlEncode(encrypted),
    base64UrlEncode(authTag),
  ].join(".");
}

export function decryptSecret(value?: string | null) {
  if (!value) {
    return null;
  }

  const [version, encodedIv, encodedEncrypted, encodedAuthTag] = value.split(".");
  if (version !== ENCRYPTED_SECRET_VERSION || !encodedIv || !encodedEncrypted || !encodedAuthTag) {
    return null;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), base64UrlDecode(encodedIv));
    decipher.setAuthTag(base64UrlDecode(encodedAuthTag));
    const decrypted = Buffer.concat([
      decipher.update(base64UrlDecode(encodedEncrypted)),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

function getEncryptionKey() {
  return createHash("sha256")
    .update(`sketchblock:github-oauth:${getAuthSecret()}`)
    .digest();
}
