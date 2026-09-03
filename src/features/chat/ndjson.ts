import { ChatServerEventSchema, type ChatServerEvent } from "@/server/chat/contracts";

export async function* parseNdjson(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatServerEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield ChatServerEventSchema.parse(JSON.parse(line));
      }
    }
    pending += decoder.decode();
    if (pending.trim()) yield ChatServerEventSchema.parse(JSON.parse(pending));
  } finally {
    reader.releaseLock();
  }
}
