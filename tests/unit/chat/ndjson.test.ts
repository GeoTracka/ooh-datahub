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

  it("accepts a strict inline download event", async () => {
    const encoder = new TextEncoder();
    const event = {
      type: "download.ready",
      download: {
        artifactId: "11111111-1111-4111-8111-111111111111",
        revision: 2,
        reportKind: "campaign_plan",
        title: "Everyday essentials campaign plan",
        filename: "everyday-essentials-campaign-plan-r2",
        formats: ["xlsx", "csv"],
      },
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        controller.close();
      },
    });

    const events = [];
    for await (const parsed of parseNdjson(stream)) events.push(parsed);
    expect(events).toEqual([event]);
  });
});
