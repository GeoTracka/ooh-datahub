import { createHash, createHmac, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "ooh_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionTokenHash(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export function sessionMetadataHash(value: string | null): Buffer | null {
  if (!value) return null;
  const secret = process.env.SESSION_COOKIE_SECRET?.trim();
  if (!secret) throw new Error("SESSION_COOKIE_SECRET_REQUIRED");
  return createHmac("sha256", secret).update(value, "utf8").digest();
}

export function sessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_SECONDS * 1_000);
}

export function sessionIsActive(
  session: { expiresAt: Date },
  now = new Date(),
): boolean {
  return session.expiresAt.getTime() > now.getTime();
}

export function sessionCookieOptions(production = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

