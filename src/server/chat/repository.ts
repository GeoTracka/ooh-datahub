import type { ChatThread } from "@/server/chat/contracts";
import { binaryToUuid, uuidToBinary } from "@/server/auth/ids";
import { evidenceDatabase } from "@/server/db/client";
import type { RowDataPacket } from "mysql2/promise";

export type ChatStore = {
  findThread(threadId: string): Promise<ChatThread | null>;
};

type ThreadRow = RowDataPacket & {
  id: Buffer;
  owner_user_id: Buffer;
  title: string;
  status: ChatThread["status"];
  created_at: Date;
  updated_at: Date;
};

export function createMariaDbChatStore(): ChatStore {
  const { pool } = evidenceDatabase();
  return {
    async findThread(threadId) {
      const [rows] = await pool.query<ThreadRow[]>(
        `SELECT id, owner_user_id, title, status, created_at, updated_at
         FROM ai_threads WHERE id = ? LIMIT 1`,
        [uuidToBinary(threadId)],
      );
      const row = rows[0];
      return row
        ? {
            id: binaryToUuid(row.id),
            ownerId: binaryToUuid(row.owner_user_id),
            title: row.title,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }
        : null;
    },
  };
}

export function mariaDbChatRepository() {
  return createChatRepository(createMariaDbChatStore());
}

export function createChatRepository(store: ChatStore) {
  return {
    async getThread(threadId: string, ownerId: string): Promise<ChatThread> {
      const thread = await store.findThread(threadId);
      if (!thread || thread.ownerId !== ownerId) throw new Error("THREAD_NOT_FOUND");
      return thread;
    },
  };
}
