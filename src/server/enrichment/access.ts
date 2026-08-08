import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "@/shared/canonicalJson";

export type EnrichmentAccessGrant = {
  principalId: string;
  tenantId: string;
  grantId: string;
  expiresAt: string;
  maxCalls: number;
};

function signature(encoded: string, secret: string): string {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

export function signEnrichmentAccessGrant(
  grant: EnrichmentAccessGrant,
  secret: string,
): string {
  if (secret.length < 32) throw new Error("ENRICHMENT_ACCESS_SECRET_MISSING");
  const encoded = Buffer.from(canonicalJson(grant), "utf8").toString("base64url");
  return encoded + "." + signature(encoded, secret);
}

export function verifyEnrichmentAccessGrant(
  token: string,
  secret: string,
  now: Date,
): EnrichmentAccessGrant {
  if (secret.length < 32) throw new Error("ENRICHMENT_ACCESS_SECRET_MISSING");
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("ENRICHMENT_ACCESS_GRANT_INVALID");
  const [encoded, suppliedSignature] = parts;
  const expectedSignature = signature(encoded, secret);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("ENRICHMENT_ACCESS_GRANT_INVALID");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("ENRICHMENT_ACCESS_GRANT_INVALID");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("ENRICHMENT_ACCESS_GRANT_INVALID");
  }
  const value = parsed as Partial<EnrichmentAccessGrant>;
  if (
    typeof value.principalId !== "string" || value.principalId.length === 0 ||
    typeof value.tenantId !== "string" || value.tenantId.length === 0 ||
    typeof value.grantId !== "string" || value.grantId.length === 0 ||
    typeof value.expiresAt !== "string" ||
    typeof value.maxCalls !== "number" ||
    !Number.isInteger(value.maxCalls) || value.maxCalls < 1 || value.maxCalls > 50
  ) {
    throw new Error("ENRICHMENT_ACCESS_GRANT_INVALID");
  }
  const expiresAt = new Date(value.expiresAt);
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new Error("ENRICHMENT_ACCESS_GRANT_INVALID");
  }
  if (expiresAt <= now) throw new Error("ENRICHMENT_ACCESS_GRANT_EXPIRED");
  if (expiresAt.getTime() - now.getTime() > 10 * 60_000) {
    throw new Error("ENRICHMENT_ACCESS_GRANT_TOO_LONG");
  }
  return value as EnrichmentAccessGrant;
}

export function accessGrantForRequest(request: Request): EnrichmentAccessGrant | null {
  if (process.env.LIVE_ENRICHMENT_ENABLED !== "true") return null;
  if (process.env.ENRICHMENT_QUOTA_ENFORCEMENT !== "upstream") {
    throw new Error("ENRICHMENT_UPSTREAM_QUOTA_REQUIRED");
  }
  const secret = process.env.ENRICHMENT_ACCESS_GRANT_SECRET?.trim() ?? "";
  const token = request.headers.get("x-ooh-enrichment-grant")?.trim() ?? "";
  if (!token) throw new Error("ENRICHMENT_ACCESS_GRANT_REQUIRED");
  return verifyEnrichmentAccessGrant(token, secret, new Date());
}

export function assertGrantCallAllowance(
  grant: EnrichmentAccessGrant | null,
  rows: Array<{ address?: string }>,
): void {
  if (!grant) return;
  const requestedCalls = rows.filter((row) => Boolean(row.address)).length;
  if (requestedCalls > grant.maxCalls) {
    throw new Error("ENRICHMENT_GRANT_CALL_LIMIT");
  }
}

export function enrichmentHttpStatus(code: string): number {
  if (
    code === "ENRICHMENT_ACCESS_GRANT_REQUIRED" ||
    code === "ENRICHMENT_ACCESS_GRANT_INVALID" ||
    code === "ENRICHMENT_ACCESS_GRANT_EXPIRED"
  ) return 401;
  if (
    code === "ENRICHMENT_UPSTREAM_QUOTA_REQUIRED" ||
    code === "ENRICHMENT_ACCESS_SECRET_MISSING" ||
    code === "ENRICHMENT_ACCESS_GRANT_TOO_LONG"
  ) return 403;
  if (
    code === "ENRICHMENT_GRANT_CALL_LIMIT" ||
    code === "MAX_CALLS" ||
    code === "MAX_ROWS"
  ) return 429;
  if (code === "PROVIDER_ERROR") return 502;
  return 400;
}
