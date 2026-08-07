import { z } from "zod";

export const EnrichmentRowSchema = z
  .object({
    rowId: z.string().min(1),
    address: z.string().trim().min(1).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    coordinateAccuracyM: z.number().finite().positive().optional(),
    spatialLicenseId: z.string().trim().min(1).optional(),
    sourceArtifactId: z.string().trim().min(1).optional(),
    spatialRights: z.enum([
      "customer_captured",
      "open_licensed",
      "provider_derived",
      "unknown",
    ]),
    assetId: z.string().optional(),
    supplier: z.string().optional(),
    format: z.string().optional(),
    rateNgn: z.number().optional(),
  })
  .superRefine((row, context) => {
    const hasPair = row.latitude !== undefined && row.longitude !== undefined;
    if (!row.address && !hasPair) {
      context.addIssue({
        code: "custom",
        message: "ADDRESS_OR_COORDINATE_REQUIRED",
      });
    }
    if (
      (row.latitude === undefined) !== (row.longitude === undefined)
    ) {
      context.addIssue({ code: "custom", message: "COORDINATE_PAIR_REQUIRED" });
    }
  });

export const PreflightBodySchema = z.object({
  rows: z.array(EnrichmentRowSchema).min(1).max(50),
});

export const RunBodySchema = PreflightBodySchema.extend({
  preflightId: z.string().min(1),
  authorized: z.literal(true),
  idempotencyKey: z.string().min(8).max(100),
});
