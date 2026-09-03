import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const PARAMETERS = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;

function deriveKey(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, PARAMETERS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (!password) throw new Error("PASSWORD_REQUIRED");
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, KEY_LENGTH);
  return [
    "scrypt",
    PARAMETERS.N,
    PARAMETERS.r,
    PARAMETERS.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  try {
    const [algorithm, nText, rText, pText, saltText, hashText, extra] =
      encodedHash.split("$");
    if (
      algorithm !== "scrypt" ||
      extra !== undefined ||
      Number(nText) !== PARAMETERS.N ||
      Number(rText) !== PARAMETERS.r ||
      Number(pText) !== PARAMETERS.p
    ) {
      return false;
    }
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await deriveKey(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
