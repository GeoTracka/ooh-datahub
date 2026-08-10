import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  canonicalCalibrationEvidencePackage,
  type CalibrationEvidencePackage,
} from "@/planning/calibrationEvidence";

export function calibrationEvidencePackageDigest(pkg: CalibrationEvidencePackage): string {
  return createHash("sha256")
    .update(canonicalCalibrationEvidencePackage(pkg), "utf8")
    .digest("hex");
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}
