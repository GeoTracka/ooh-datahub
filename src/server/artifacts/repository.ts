import {
  ArtifactPayloadSchema,
  type ArtifactPayload,
  type ArtifactType,
} from "@/server/artifacts/contracts";
import { binaryToUuid, uuidToBinary } from "@/server/auth/ids";
import { evidenceDatabase } from "@/server/db/client";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type ArtifactRecord = {
  id: string;
  ownerId: string;
  currentRevisionNumber: number;
  type: ArtifactType;
};

export type AppendArtifactRevision = {
  artifactId: string;
  ownerId: string;
  expectedParentRevision: number;
  payload: ArtifactPayload;
  reason: string;
};

export type ArtifactStore = {
  findArtifact(artifactId: string): Promise<ArtifactRecord | null>;
  appendRevision(input: AppendArtifactRevision): Promise<{
    artifactId: string;
    revision: number;
    payload: ArtifactPayload;
  }>;
};

type ArtifactRow = RowDataPacket & {
  id: Buffer;
  owner_user_id: Buffer;
  current_revision_number: number;
  type: ArtifactType;
};

function toArtifactRecord(row: ArtifactRow): ArtifactRecord {
  return {
    id: binaryToUuid(row.id),
    ownerId: binaryToUuid(row.owner_user_id),
    currentRevisionNumber: row.current_revision_number,
    type: row.type,
  };
}

export function createMariaDbArtifactStore(): ArtifactStore {
  const { pool } = evidenceDatabase();
  return {
    async findArtifact(artifactId) {
      const [rows] = await pool.query<ArtifactRow[]>(
        `SELECT id, owner_user_id, current_revision_number, type
         FROM campaign_artifacts WHERE id = ? LIMIT 1`,
        [uuidToBinary(artifactId)],
      );
      return rows[0] ? toArtifactRecord(rows[0]) : null;
    },
    async appendRevision(input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<ArtifactRow[]>(
          `SELECT id, owner_user_id, current_revision_number, type
           FROM campaign_artifacts WHERE id = ? FOR UPDATE`,
          [uuidToBinary(input.artifactId)],
        );
        const row = rows[0];
        if (!row || binaryToUuid(row.owner_user_id) !== input.ownerId) {
          throw new Error("ARTIFACT_NOT_FOUND");
        }
        if (row.current_revision_number !== input.expectedParentRevision) {
          throw new Error(
            `STALE_ARTIFACT_REVISION:${row.current_revision_number}:${input.expectedParentRevision}`,
          );
        }
        if (row.type !== input.payload.type) throw new Error("ARTIFACT_TYPE_MISMATCH");

        const revision = row.current_revision_number + 1;
        await connection.execute(
          `INSERT INTO campaign_artifact_revisions
             (artifact_id, revision_number, parent_revision_number, created_by_user_id, payload, reason)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            uuidToBinary(input.artifactId),
            revision,
            input.expectedParentRevision,
            uuidToBinary(input.ownerId),
            JSON.stringify(input.payload),
            input.reason,
          ],
        );
        const [update] = await connection.execute<ResultSetHeader>(
          `UPDATE campaign_artifacts
           SET current_revision_number = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND current_revision_number = ?`,
          [revision, uuidToBinary(input.artifactId), input.expectedParentRevision],
        );
        if (update.affectedRows !== 1) throw new Error("STALE_ARTIFACT_REVISION");
        await connection.commit();
        return { artifactId: input.artifactId, revision, payload: input.payload };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

export function mariaDbArtifactRepository() {
  return createArtifactRepository(createMariaDbArtifactStore());
}

export function createArtifactRepository(store: ArtifactStore) {
  async function ownedArtifact(artifactId: string, ownerId: string) {
    const artifact = await store.findArtifact(artifactId);
    if (!artifact || artifact.ownerId !== ownerId) {
      throw new Error("ARTIFACT_NOT_FOUND");
    }
    return artifact;
  }

  return {
    getArtifact: ownedArtifact,
    async appendRevision(input: AppendArtifactRevision) {
      const artifact = await ownedArtifact(input.artifactId, input.ownerId);
      if (artifact.currentRevisionNumber !== input.expectedParentRevision) {
        throw new Error(
          `STALE_ARTIFACT_REVISION:${artifact.currentRevisionNumber}:${input.expectedParentRevision}`,
        );
      }
      const payload = ArtifactPayloadSchema.parse(input.payload);
      if (payload.type !== artifact.type) throw new Error("ARTIFACT_TYPE_MISMATCH");
      const reason = input.reason.normalize("NFKC").replace(/\s+/g, " ").trim();
      if (!reason || reason.length > 240) throw new Error("INVALID_REVISION_REASON");
      return store.appendRevision({ ...input, payload, reason });
    },
  };
}
