import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("chat responsive styles", () => {
  it("wraps long inline references instead of widening the conversation", () => {
    const styles = readFileSync(path.resolve("src/app/chat/chat.css"), "utf8");

    expect(styles).toMatch(
      /\.ai-message code\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*break-word;/,
    );
  });
});
