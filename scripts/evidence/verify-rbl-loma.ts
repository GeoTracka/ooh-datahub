import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evidenceDisposition } from "@/evidence/rblLoma2026/policy";
import { rblLoma2026Sources } from "@/evidence/sourceCatalog";
import { assertPublicationPrivacy } from "./audit-rbl-loma";

export type Publication = {
  sourceHashes: Record<string, string>;
  facts: Array<{
    factId: string;
    metricId: string;
    segment: { city: string };
  }>;
  blockedDiscrepancies: Array<{ status: string }>;
};

export function verifyPublication(publication: Publication): void {
  assertPublicationPrivacy(publication);
  for (const source of rblLoma2026Sources) {
    if (publication.sourceHashes[source.id] !== source.sha256) {
      throw new Error(`PUBLICATION_SOURCE_HASH_MISMATCH:${source.id}`);
    }
  }
  const factIds = new Set<string>();
  for (const fact of publication.facts) {
    if (factIds.has(fact.factId)) throw new Error(`DUPLICATE_FACT_ID:${fact.factId}`);
    factIds.add(fact.factId);
    const disposition = evidenceDisposition(fact.metricId, fact.segment.city);
    if (disposition.status !== "approved") {
      throw new Error(`BLOCKED_METRIC_IN_PUBLICATION:${fact.metricId}`);
    }
  }
  if (publication.blockedDiscrepancies.some((item) => item.status !== "blocked")) {
    throw new Error("UNRESOLVED_DISCREPANCY_NOT_BLOCKED");
  }
}

async function main(): Promise<void> {
  const stagingDirectory = path.resolve(
    process.env.RBL_LOMA_EVIDENCE_STAGING_DIR?.trim() ||
      ".local/evidence/rbl-loma-2026",
  );
  const publication = JSON.parse(
    await readFile(path.join(stagingDirectory, "publication.json"), "utf8"),
  ) as Publication;
  verifyPublication(publication);
  process.stdout.write(
    `Verified ${publication.facts.length} governed RBL/LOMA publication facts.\n`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
