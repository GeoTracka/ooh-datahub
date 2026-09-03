import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  sessionCookieOptions,
  sessionIsActive,
} from "@/server/auth/session";

describe("local account sessions", () => {
  it("rejects expired sessions", () => {
    expect(
      sessionIsActive(
        { expiresAt: new Date("2026-01-01") },
        new Date("2026-01-02"),
      ),
    ).toBe(false);
  });

  it("creates an opaque 32-byte browser token and protected cookie", () => {
    const token = createSessionToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(sessionCookieOptions(false)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 60 * 60 * 24 * 14,
    });
  });
});
