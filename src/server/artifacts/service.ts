import "server-only";

import { randomUUID } from "node:crypto";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { uuidToBinary } from "@/server/auth/ids";
import {
  ArtifactPayloadSchema,
  type ArtifactPayload,
} from "@/server/artifacts/contracts";
import { mariaDbArtifactRepository } from "@/server/artifacts/repository";
import { evidenceDatabase } from "@/server/db/client";

type CurrentArtifactRow = RowDataPacket & {
  id: Buffer;
  current_revision_number: number;
  save_state: "draft" | "saved";
  payload: string | ArtifactPayload;
  reason: string;
  created_at: Date;
};

function parsePayload(value: string | ArtifactPayload): ArtifactPayload {
  return ArtifactPayloadSchema.parse(
    typeof value === "string" ? JSON.parse(value) : value,
  );
}

export async function createArtifact(input: {
  ownerId: string;
  threadId: string | null;
  payload: ArtifactPayload;
  reason: string;
}) {
  const payload = ArtifactPayloadSchema.parse(input.payload);
  const artifactId = randomUUID();
  const { pool } = evidenceDatabase();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO campaign_artifacts
         (id, owner_user_id, thread_id, type, save_state, current_revision_number)
       VALUES (?, ?, ?, ?, 'draft', 1)`,
      [
        uuidToBinary(artifactId),
        uuidToBinary(input.ownerId),
        input.threadId ? uuidToBinary(input.threadId) : null,
        payload.type,
      ],
    );
    await connection.execute(
      `INSERT INTO campaign_artifact_revisions
         (artifact_id, revision_number, parent_revision_number, created_by_user_id, payload, reason)
       VALUES (?, 1, NULL, ?, ?, ?)`,
      [
        uuidToBinary(artifactId),
        uuidToBinary(input.ownerId),
        JSON.stringify(payload),
        input.reason,
      ],
    );
    if (payload.type === "evidence") {
      for (const factId of new Set(payload.factIds)) {
        await connection.execute(
          `INSERT INTO artifact_citations
             (id, artifact_id, revision_number, fact_id, excerpt_id)
           VALUES (?, ?, 1, ?, NULL)`,
          [uuidToBinary(randomUUID()), uuidToBinary(artifactId), factId],
        );
      }
      for (const excerptId of new Set(payload.excerptIds)) {
        await connection.execute(
          `INSERT INTO artifact_citations
             (id, artifact_id, revision_number, fact_id, excerpt_id)
           VALUES (?, ?, 1, NULL, ?)`,
          [uuidToBinary(randomUUID()), uuidToBinary(artifactId), excerptId],
        );
      }
    }
    await connection.commit();
    return { id: artifactId, type: payload.type, revision: 1, payload };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCurrentArtifact(artifactId: string, ownerId: string) {
  const { pool } = evidenceDatabase();
  const [rows] = await pool.query<CurrentArtifactRow[]>(
    `SELECT a.id, a.current_revision_number, a.save_state,
            r.payload, r.reason, r.created_at
     FROM campaign_artifacts a
     INNER JOIN campaign_artifact_revisions r
       ON r.artifact_id = a.id AND r.revision_number = a.current_revision_number
     WHERE a.id = ? AND a.owner_user_id = ?
     LIMIT 1`,
    [uuidToBinary(artifactId), uuidToBinary(ownerId)],
  );
  const row = rows[0];
  if (!row) throw new Error("ARTIFACT_NOT_FOUND");
  return {
    id: artifactId,
    revision: row.current_revision_number,
    saveState: row.save_state,
    payload: parsePayload(row.payload),
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export async function appendArtifactRevision(input: {
  artifactId: string;
  ownerId: string;
  expectedParentRevision: number;
  payload: ArtifactPayload;
  reason: string;
}) {
  return mariaDbArtifactRepository().appendRevision(input);
}

export async function undoArtifact(
  artifactId: string,
  ownerId: string,
  expectedRevision: number,
) {
  const current = await getCurrentArtifact(artifactId, ownerId);
  if (current.revision !== expectedRevision) {
    throw new Error(`STALE_ARTIFACT_REVISION:${current.revision}:${expectedRevision}`);
  }
  if (current.revision <= 1) throw new Error("NO_ARTIFACT_REVISION_TO_UNDO");
  const { pool } = evidenceDatabase();
  const [rows] = await pool.query<(RowDataPacket & { payload: string | ArtifactPayload })[]>(
    `SELECT payload FROM campaign_artifact_revisions
     WHERE artifact_id = ? AND revision_number = ? LIMIT 1`,
    [uuidToBinary(artifactId), current.revision - 1],
  );
  if (!rows[0]) throw new Error("ARTIFACT_REVISION_NOT_FOUND");
  return appendArtifactRevision({
    artifactId,
    ownerId,
    expectedParentRevision: current.revision,
    payload: parsePayload(rows[0].payload),
    reason: `Undo revision ${current.revision}`,
  });
}

export async function setArtifactSaveState(
  artifactId: string,
  ownerId: string,
  saveState: "draft" | "saved",
) {
  const { pool } = evidenceDatabase();
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE campaign_artifacts SET save_state = ?
     WHERE id = ? AND owner_user_id = ?`,
    [saveState, uuidToBinary(artifactId), uuidToBinary(ownerId)],
  );
  if (result.affectedRows !== 1) throw new Error("ARTIFACT_NOT_FOUND");
  return { artifactId, saveState };
}
