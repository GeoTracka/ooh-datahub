import { describe, expect, it } from "vitest";

import { parseNdjson } from "@/features/chat/ndjson";

describe("NDJSON parser", () => {
  it("handles event lines split across arbitrary chunks", async () => {
    const encoder = new TextEncoder();
    const text = `${JSON.stringify({ type: "response.started", messageId: "m1" })}\n${JSON.stringify({ type: "text.delta", delta: "Hello" })}\n`;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text.slice(0, 17)));
        controller.enqueue(encoder.encode(text.slice(17, 42)));
        controller.enqueue(encoder.encode(text.slice(42)));
        controller.close();
      },
    });
    const events = [];
    for await (const event of parseNdjson(stream)) events.push(event);
    expect(events.map((event) => event.type)).toEqual(["response.started", "text.delta"]);
  });
});
