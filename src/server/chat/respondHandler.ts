import type { CurrentUser } from "@/server/auth/currentUser";
import {
  ChatServerEventSchema,
  RespondCommandSchema,
  type ChatServerEvent,
} from "@/server/chat/contracts";

type RespondDependencies = {
  requireUser(): Promise<CurrentUser>;
  getOwnedThread(threadId: string, ownerId: string): Promise<unknown>;
  checkRateLimit(userId: string): Promise<boolean>;
  events(input: {
    user: CurrentUser;
    threadId: string;
    message: string;
    signal: AbortSignal;
  }): AsyncIterable<ChatServerEvent>;
};

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export function createRespondHandler(dependencies: RespondDependencies) {
  return async function respond(request: Request): Promise<Response> {
    let user: CurrentUser;
    try {
      user = await dependencies.requireUser();
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        return jsonError("UNAUTHENTICATED", 401);
      }
      throw error;
    }

    const command = RespondCommandSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!command.success) return jsonError("INVALID_CHAT_COMMAND", 400);

    try {
      await dependencies.getOwnedThread(command.data.threadId, user.id);
    } catch (error) {
      if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
        return jsonError("THREAD_NOT_FOUND", 404);
      }
      throw error;
    }
    if (!(await dependencies.checkRateLimit(user.id))) {
      return jsonError("RATE_LIMITED", 429);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of dependencies.events({
            user,
            threadId: command.data.threadId,
            message: command.data.message,
            signal: request.signal,
          })) {
            const validated = ChatServerEventSchema.parse(event);
            controller.enqueue(
              encoder.encode(`${JSON.stringify(validated)}\n`),
            );
          }
        } catch {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "response.failed",
                code: "STREAM_FAILED",
                recoverable: true,
              })}\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
      cancel() {
        // The request signal is forwarded to the provider and tool timeout controller.
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Content-Type-Options": "nosniff",
        "X-Accel-Buffering": "no",
      },
    });
  };
}
