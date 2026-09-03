import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";

import { binaryToUuid, uuidToBinary } from "@/server/auth/ids";
import {
  createSessionToken,
  sessionExpiresAt,
  sessionMetadataHash,
  SESSION_COOKIE_NAME,
  sessionTokenHash,
} from "@/server/auth/session";
import { evidenceDatabase } from "@/server/db/client";
import { appSessions, appUsers } from "@/server/db/schema";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
};

export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UnauthenticatedError";
  }
}

export function normalizeEmail(email: string): string {
  return email.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export async function findCurrentUserByToken(
  token: string,
  now = new Date(),
): Promise<CurrentUser | null> {
  const { db } = evidenceDatabase();
  const rows = await db
    .select({
      sessionId: appSessions.id,
      id: appUsers.id,
      email: appUsers.email,
      displayName: appUsers.displayName,
    })
    .from(appSessions)
    .innerJoin(appUsers, eq(appUsers.id, appSessions.userId))
    .where(
      and(
        eq(appSessions.tokenHash, sessionTokenHash(token)),
        gt(appSessions.expiresAt, now),
        eq(appUsers.status, "active"),
      ),
    )
    .limit(1);
  const record = rows[0];
  if (!record) return null;
  await db
    .update(appSessions)
    .set({ lastSeenAt: now })
    .where(eq(appSessions.id, record.sessionId));
  return {
    id: binaryToUuid(record.id),
    email: record.email,
    displayName: record.displayName,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new UnauthenticatedError();
  const user = await findCurrentUserByToken(token);
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function issueSession({
  userId,
  ipAddress,
  userAgent,
}: {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<string> {
  const { db } = evidenceDatabase();
  const token = createSessionToken();
  await db.insert(appSessions).values({
    id: uuidToBinary(randomUUID()),
    tokenHash: sessionTokenHash(token),
    userId: uuidToBinary(userId),
    expiresAt: sessionExpiresAt(),
    ipHash: sessionMetadataHash(ipAddress),
    userAgentHash: sessionMetadataHash(userAgent),
  });
  return token;
}

export async function revokeSessionToken(token: string): Promise<void> {
  const { db } = evidenceDatabase();
  await db.delete(appSessions).where(eq(appSessions.tokenHash, sessionTokenHash(token)));
}

