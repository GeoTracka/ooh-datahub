import { createHash } from "node:crypto";

export type IngestionStatus = "running" | "succeeded" | "failed";

export function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function sourceRevisionKey(sourceId: string, sha256: string): string {
  if (!sourceId.trim()) throw new Error("SOURCE_ID_REQUIRED");
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("INVALID_SOURCE_SHA256");
  return `${sourceId}@${sha256}`;
}

export function quarantineRecordId(input: {
  sourceId: string;
  sourceSha256: string;
  sheet: string;
  sourceRow: number;
  reason: string;
  raw: unknown;
}): string {
  return sha256Text(JSON.stringify([
    sourceRevisionKey(input.sourceId, input.sourceSha256),
    input.sheet,
    input.sourceRow,
    input.reason,
    input.raw,
  ]));
}

export function assertIngestionTransition(
  current: IngestionStatus,
  next: IngestionStatus,
): void {
  const allowed =
    current === "running" && (next === "succeeded" || next === "failed");
  if (!allowed) throw new Error(`INVALID_INGESTION_TRANSITION:${current}:${next}`);
}

export function sqlLiteral(value: string): string {
  return "'" + value.replaceAll("'", "''") + "'";
}

export function copyTextField(value: unknown): string {
  if (value === null || value === undefined) return "\\N";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("NON_FINITE_COPY_NUMBER");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "t" : "f";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) return "\\N";
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("\t", "\\t")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}

export function copyTextRow(values: readonly unknown[]): string {
  return values.map(copyTextField).join("\t") + "\n";
}

function assertSqlIdentifier(identifier: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`INVALID_SQL_IDENTIFIER:${identifier}`);
  }
}

export function copyStart(table: string, columns: readonly string[]): string {
  const parts = table.split(".");
  if (parts.length < 1 || parts.length > 2) throw new Error(`INVALID_SQL_TABLE:${table}`);
  for (const part of parts) assertSqlIdentifier(part);
  if (columns.length === 0) throw new Error("COPY_COLUMNS_REQUIRED");
  for (const column of columns) assertSqlIdentifier(column);
  return `COPY ${parts.join(".")} (${columns.join(", ")}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N');\n`;
}

export function validateRetentionUri(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`INVALID_${label.toUpperCase()}_URI`);
  }
  if (!["file:", "s3:", "gs:", "az:", "https:"].includes(url.protocol)) {
    throw new Error(`UNSUPPORTED_${label.toUpperCase()}_URI_SCHEME:${url.protocol}`);
  }
  if (url.username || url.password) throw new Error(`CREDENTIALS_NOT_ALLOWED_IN_${label.toUpperCase()}_URI`);
  return value;
}

export function joinStorageUri(root: string, fileName: string): string {
  const validated = validateRetentionUri(root, "storage");
  const base = validated.endsWith("/") ? validated : `${validated}/`;
  return new URL(encodeURIComponent(fileName), base).toString();
}
