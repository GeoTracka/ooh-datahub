import { verifyCalibrationManifest } from "./calibration/manifest";

function argValue(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return value;
}

async function main(): Promise<void> {
  const result = await verifyCalibrationManifest(argValue("manifest"));
  process.stdout.write(`${JSON.stringify({
    packageDigest: result.packageDigest,
    packageValid: result.promotion.packageValid,
    artifactsVerified: result.artifactsVerified,
    movementEvaluationVerified: result.promotion.movementEvaluationVerified,
    movementEvaluationVersion: result.movementEvaluationVersion,
    movementEvaluationDigest: result.movementEvaluationDigest,
    derivedMovementCalibrationReport: result.derivedMovementCalibrationReport,
    registerable: result.registerable,
    calibrationPassed: result.promotion.calibrationPassed,
    eligibleForEvidenceC: result.eligibleForEvidenceC,
    packageFailures: result.promotion.packageFailures,
    promotionFailures: result.promotion.promotionFailures,
    evaluationFailures: result.evaluationFailures,
    calibrationFailures: result.promotion.calibrationFailures,
    artifactFailures: result.artifactFailures,
  }, null, 2)}\n`);

  if (!result.registerable) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`calibration evidence validation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
