import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { EnrichmentRow, GeocodeResponse } from "@/contracts/enrichment";
import type { GeocodingProvider } from "@/server/enrichment/adapter";
import { canonicalJson } from "@/shared/canonicalJson";

type Dependencies = {
  now(): Date;
  geocoder: GeocodingProvider;
  enabled: boolean;
  maxRows: number;
  maxCalls: number;
  signingSecret: string;
};

type Preflight = {
  id: string;
  expiresAt: string;
  rowHash: string;
  maximumCalls: number;
  providerProducts: string[];
  transmittedFields: string[];
};

function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type SignedPreflight = Omit<Preflight, "id">;

function signPreflight(payload: SignedPreflight, secret: string): string {
  const encoded = Buffer.from(canonicalJson(payload), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

function verifyPreflight(token: string, secret: string): SignedPreflight {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("PREFLIGHT_TOKEN_INVALID");
  const [encoded, suppliedSignature] = parts;
  const expectedSignature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new Error("PREFLIGHT_TOKEN_INVALID");
  }
  const parsed = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Partial<SignedPreflight>;
  if (
    typeof parsed.rowHash !== "string" ||
    typeof parsed.expiresAt !== "string" ||
    typeof parsed.maximumCalls !== "number" ||
    !Array.isArray(parsed.providerProducts) ||
    !Array.isArray(parsed.transmittedFields)
  ) {
    throw new Error("PREFLIGHT_TOKEN_INVALID");
  }
  return parsed as SignedPreflight;
}

export function createEnrichmentGateway(dependencies: Dependencies) {
  const completed = new Map<
    string,
    { rowHash: string; expiresAt: number; result: GeocodeResponse[] }
  >();

  function preflight(input: { rows: EnrichmentRow[] }): Preflight {
    if (!dependencies.enabled) throw new Error("LIVE_ENRICHMENT_DISABLED");
    if (dependencies.signingSecret.length < 32)
      throw new Error("PREFLIGHT_SECRET_MISSING");
    if (input.rows.length > dependencies.maxRows) throw new Error("MAX_ROWS");
    if (input.rows.some((row) => row.spatialRights === "unknown")) {
      throw new Error("SPATIAL_RIGHTS_REQUIRED");
    }
    const maximumCalls = input.rows.filter((row) => Boolean(row.address)).length;
    if (maximumCalls > dependencies.maxCalls) throw new Error("MAX_CALLS");
    const rowHash = contentHash(canonicalJson(input.rows));
    const unsigned: SignedPreflight = {
      rowHash,
      expiresAt: new Date(
        dependencies.now().getTime() + 5 * 60_000,
      ).toISOString(),
      maximumCalls,
      providerProducts: ["Google Geocoding API v4"],
      transmittedFields: ["address", "Accept-Language: en"],
    };
    return { ...unsigned, id: signPreflight(unsigned, dependencies.signingSecret) };
  }

  async function run(input: {
    preflightId: string;
    rows: EnrichmentRow[];
    authorized: boolean;
    idempotencyKey: string;
  }): Promise<GeocodeResponse[]> {
    if (!input.authorized) throw new Error("AUTHORIZATION_REQUIRED");
    const approved = verifyPreflight(input.preflightId, dependencies.signingSecret);
    if (new Date(approved.expiresAt) <= dependencies.now())
      throw new Error("PREFLIGHT_EXPIRED");
    const rowHash = contentHash(canonicalJson(input.rows));
    if (approved.rowHash !== rowHash) {
      throw new Error("PREFLIGHT_MISMATCH");
    }
    const prior = completed.get(input.idempotencyKey);
    if (prior && prior.expiresAt <= dependencies.now().getTime()) {
      completed.delete(input.idempotencyKey);
    }
    const current = completed.get(input.idempotencyKey);
    if (current && current.rowHash !== rowHash)
      throw new Error("IDEMPOTENCY_MISMATCH");
    if (current) return current.result;
    const results = await Promise.all(
      input.rows.map((row) => {
        if (!row.address)
          return Promise.resolve<GeocodeResponse>({
            status: "NO_RESULTS",
            candidates: [],
          });
        return dependencies.geocoder.geocode({
          assetId: row.rowId,
          address: row.address,
          expectedCountryCode: "NG",
          languageCode: "en",
        });
      }),
    );
    completed.set(input.idempotencyKey, {
      rowHash,
      result: results,
      expiresAt: dependencies.now().getTime() + 5 * 60_000,
    });
    return results;
  }

  return { preflight, run };
}
