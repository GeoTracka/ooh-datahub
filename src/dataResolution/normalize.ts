import { createHash } from "node:crypto";

export const ENTITY_RESOLVER_VERSION = "entity-resolver-v1";

export type CanonicalEntityType =
  | "advertiser"
  | "brand"
  | "category"
  | "format"
  | "state"
  | "city";

export function sourceDisplayLiteral(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).normalize("NFKC").trim().replace(/\s+/gu, " ");
  return text.length > 0 ? text : null;
}

export function normalizeEntityLiteral(value: unknown): string | null {
  const display = sourceDisplayLiteral(value);
  if (!display) return null;
  const normalized = display
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
  return normalized.length > 0 ? normalized : null;
}

export function stableResolutionId(prefix: string, ...parts: readonly string[]): string {
  if (!/^[a-z][a-z0-9_-]*$/.test(prefix)) throw new Error(`INVALID_RESOLUTION_ID_PREFIX:${prefix}`);
  const hash = createHash("sha256")
    .update(JSON.stringify(parts), "utf8")
    .digest("hex")
    .slice(0, 32);
  return `${prefix}:${hash}`;
}

export function canonicalEntityId(
  entityType: CanonicalEntityType,
  normalizedKey: string,
  resolverVersion = ENTITY_RESOLVER_VERSION,
): string {
  return stableResolutionId("entity", resolverVersion, entityType, normalizedKey);
}

export function canonicalAliasId(
  entityType: CanonicalEntityType,
  sourceLiteral: string,
  resolverVersion = ENTITY_RESOLVER_VERSION,
): string {
  return stableResolutionId("alias", resolverVersion, entityType, sourceLiteral);
}

export type StrictSiteIdentityInput = {
  state: unknown;
  city: unknown;
  address: unknown;
  boardType: unknown;
  format: unknown;
};

export type StrictSiteIdentity = {
  strictKey: string;
  siteId: string;
  stateKey: string;
  cityKey: string;
  addressKey: string;
  boardTypeKey: string;
  formatKey: string;
};

export function strictSiteIdentity(
  input: StrictSiteIdentityInput,
  resolverVersion = ENTITY_RESOLVER_VERSION,
): StrictSiteIdentity | null {
  const stateKey = normalizeEntityLiteral(input.state);
  const cityKey = normalizeEntityLiteral(input.city);
  const addressKey = normalizeEntityLiteral(input.address);
  const boardTypeKey = normalizeEntityLiteral(input.boardType);
  const formatKey = normalizeEntityLiteral(input.format);
  if (!stateKey || !cityKey || !addressKey || !boardTypeKey || !formatKey) return null;
  const strictKey = [stateKey, cityKey, addressKey, boardTypeKey, formatKey].join("|");
  return {
    strictKey,
    siteId: stableResolutionId("site", resolverVersion, strictKey),
    stateKey,
    cityKey,
    addressKey,
    boardTypeKey,
    formatKey,
  };
}

export function airportId(
  normalizedNameKey: string,
  resolverVersion = ENTITY_RESOLVER_VERSION,
): string {
  return stableResolutionId("airport", resolverVersion, normalizedNameKey);
}

export function airportAliasId(
  aliasKind: string,
  sourceLiteral: string,
  resolverVersion = ENTITY_RESOLVER_VERSION,
): string {
  return stableResolutionId("airport-alias", resolverVersion, aliasKind, sourceLiteral);
}

export function reviewItemId(
  domain: string,
  reason: string,
  sourceIdentity: readonly string[],
  resolverVersion = ENTITY_RESOLVER_VERSION,
): string {
  return stableResolutionId("review", resolverVersion, domain, reason, ...sourceIdentity);
}

export function coordinateAssertionId(input: {
  siteId: string;
  latitude: number;
  longitude: number;
  coordinateSourceId: string;
  sourceArtifactId?: string | null;
  enrichmentRevision: string;
}): string {
  return stableResolutionId(
    "coordinate",
    input.siteId,
    input.latitude.toFixed(8),
    input.longitude.toFixed(8),
    input.coordinateSourceId,
    input.sourceArtifactId ?? "",
    input.enrichmentRevision,
  );
}

export function mediaOwnerId(
  normalizedKey: string,
  registryNamespace: string,
): string {
  return stableResolutionId("owner", registryNamespace, normalizedKey);
}
