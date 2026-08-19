import { hash, verify } from '@node-rs/argon2';

// OWASP Password Storage Cheat Sheet (2023): Argon2id, m=19 MiB, t=2, p=1.
// 19,456 KiB is a little over the 19 MiB recommendation and is a common
// production-safe choice for interactive login latency.
const ARGON2_OPTS = {
  algorithm: 2, // Argon2id (numeric literal — @node-rs/argon2's ambient enum breaks isolatedModules)
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTS);
  } catch {
    // Malformed hash or any verification error → treat as mismatch.
    return false;
  }
}
