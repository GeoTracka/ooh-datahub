import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";
import { describe, expect, it } from "vitest";

const RAW_BUDGET_BYTES = 1_600_000;
const BROTLI_BUDGET_BYTES = 350_000;

describe("Lagos planning context payload budget", () => {
  it("stays within raw and deterministic Brotli ceilings", () => {
    const raw = readFileSync(resolve("public/map/lagos-open-context.geojson"));
    const brotli = brotliCompressSync(raw, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 6,
      },
    });

    expect(raw.byteLength).toBeLessThanOrEqual(RAW_BUDGET_BYTES);
    expect(brotli.byteLength).toBeLessThanOrEqual(BROTLI_BUDGET_BYTES);
  });
});
