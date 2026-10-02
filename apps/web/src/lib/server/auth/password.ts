import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
const SCRYPT_N = 131_072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;

const MAX_CONCURRENT_DERIVATIONS = 2;
const MAX_QUEUED_DERIVATIONS = 32;

export class PasswordHashBusyError extends Error {
  constructor() {
    super("Password hashing is busy.");
    this.name = "PasswordHashBusyError";
  }
}

let activeDerivations = 0;
const waitingDerivations: Array<() => void> = [];

async function acquireSlot() {
  if (activeDerivations < MAX_CONCURRENT_DERIVATIONS) {
    activeDerivations += 1;
    return;
  }
  if (waitingDerivations.length >= MAX_QUEUED_DERIVATIONS) throw new PasswordHashBusyError();
  // The releasing derivation hands its slot over, so activeDerivations stays unchanged.
  await new Promise<void>((resolve) => waitingDerivations.push(resolve));
}

function releaseSlot() {
  const next = waitingDerivations.shift();
  if (next) next();
  else activeDerivations -= 1;
}

function runScrypt(password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function deriveKey(password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) {
  await acquireSlot();
  try {
    return await runScrypt(password, salt, length, options);
  } finally {
    releaseSlot();
  }
}

/** Test hook: lets tests exercise the semaphore with a fake derivation. */
export const __passwordSemaphoreForTests = {
  run: async <T>(task: () => Promise<T>) => {
    await acquireSlot();
    try {
      return await task();
    } finally {
      releaseSlot();
    }
  },
};

let dummyHashPromise: Promise<string> | null = null;

export async function verifyPasswordAgainstDummy(password: string) {
  dummyHashPromise ??= hashPassword(randomBytes(16).toString("hex"));
  let dummyHash: string;
  try {
    dummyHash = await dummyHashPromise;
  } catch (error) {
    dummyHashPromise = null;
    throw error;
  }
  await verifyPassword(password, dummyHash);
  return false;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  });

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, nValue, rValue, pValue, encodedSalt, encodedDerived] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !nValue || !rValue || !pValue || !encodedSalt || !encodedDerived) {
    return false;
  }

  const n = Number.parseInt(nValue, 10);
  const r = Number.parseInt(rValue, 10);
  const p = Number.parseInt(pValue, 10);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) {
    return false;
  }

  const expected = Buffer.from(encodedDerived, "base64url");
  const actual = await deriveKey(password, Buffer.from(encodedSalt, "base64url"), expected.length, {
    N: n,
    r,
    p,
    maxmem: SCRYPT_MAX_MEMORY,
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
