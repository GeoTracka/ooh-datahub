import { type NextRequest, NextResponse } from "next/server";

import { revokeSessionToken } from "@/server/auth/currentUser";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/server/auth/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) await revokeSessionToken(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

