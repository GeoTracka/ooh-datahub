import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { binaryToUuid } from "@/server/auth/ids";
import {
  issueSession,
  normalizeEmail,
  revokeSessionToken,
} from "@/server/auth/currentUser";
import { verifyPassword } from "@/server/auth/password";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/server/auth/session";
import { evidenceDatabase } from "@/server/db/client";
import { appUsers } from "@/server/db/schema";

const LoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1_024),
});

const INVALID_PASSWORD_HASH =
  "scrypt$16384$8$1$sBEec9VsHMio6-ofCsQfiQ$-7W65XVgTzVvLasYV1qU-v_xnX1eHlsGODxfRLWSUW7fms8oA4JoOFbBoSbyQzWIgdlDV7wAEM16Sv0vf94QeQ";

function invalidCredentials() {
  return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidCredentials();

  const { db } = evidenceDatabase();
  const email = normalizeEmail(parsed.data.email);
  const records = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      displayName: appUsers.displayName,
      passwordHash: appUsers.passwordHash,
      status: appUsers.status,
    })
    .from(appUsers)
    .where(eq(appUsers.email, email))
    .limit(1);
  const account = records[0];
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    account?.passwordHash ?? INVALID_PASSWORD_HASH,
  );
  if (!account || account.status !== "active" || !passwordMatches) {
    return invalidCredentials();
  }

  const previousToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (previousToken) await revokeSessionToken(previousToken);
  const token = await issueSession({
    userId: binaryToUuid(account.id),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });
  const response = NextResponse.json({
    user: {
      id: binaryToUuid(account.id),
      email: account.email,
      displayName: account.displayName,
    },
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
}

