import { NextResponse } from "next/server";

import {
  requireUser,
  UnauthenticatedError,
} from "@/server/auth/currentUser";

export async function GET() {
  try {
    return NextResponse.json({ user: await requireUser() });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    throw error;
  }
}
