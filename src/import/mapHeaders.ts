export type CanonicalHeader =
  | "assetId"
  | "address"
  | "latitude"
  | "longitude"
  | "coordinateAccuracyM"
  | "supplier"
  | "format"
  | "rate"
  | "orientation"
  | "spatialRights"
  | "spatialLicenseId"
  | "sourceArtifactId"
  | "personName";

const aliases: Record<CanonicalHeader, string[]> = {
  assetId: ["asset id", "billboard id", "site id", "face id"],
  address: ["address", "location address", "site address"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon"],
  coordinateAccuracyM: ["coordinate accuracy m", "coordinate accuracy metres", "location accuracy m"],
  supplier: ["supplier", "owner", "media owner"],
  format: ["format", "media format"],
  rate: ["rate", "price", "cost"],
  orientation: ["orientation", "travel direction", "facing"],
  spatialRights: ["coordinate source", "spatial rights", "location source"],
  spatialLicenseId: ["spatial license id", "coordinate attestation id", "location license id"],
  sourceArtifactId: ["source artifact id", "source file id", "location source id"],
  personName: ["person name", "contact name", "resident name"],
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalize(left).split(" "));
  const rightTokens = new Set(normalize(right).split(" "));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function mapHeaders(headers: string[]) {
  return headers.map((header) => {
    const normalized = normalize(header);
    const exact = (Object.entries(aliases) as [CanonicalHeader, string[]][])
      .find(([, values]) => values.includes(normalized));
    if (exact) return { source: header, target: exact[0], confidence: 1, confirmed: true };
    const approximate = (Object.entries(aliases) as [CanonicalHeader, string[]][])
      .flatMap(([target, values]) => values.map((value) => ({
        target,
        confidence: tokenSimilarity(header, value),
      })))
      .sort((left, right) => right.confidence - left.confidence)[0];
    return approximate?.confidence >= 0.6
      ? { source: header, target: approximate.target, confidence: approximate.confidence, confirmed: false }
      : { source: header, target: null, confidence: 0, confirmed: false };
  });
}
