import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("local account password security", () => {
  it("stores a salted scrypt hash", async () => {
    const hash = await hashPassword("a sufficiently long password");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("a sufficiently long password", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("uses a different salt for the same password", async () => {
    const first = await hashPassword("a sufficiently long password");
    const second = await hashPassword("a sufficiently long password");
    expect(first).not.toBe(second);
  });
});

