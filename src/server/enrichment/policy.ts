import "server-only";
import type {
  AllowedPurpose,
  DisplaySurface,
  EnrichedField,
} from "@/contracts/enrichment";
import { isExpired, isRendererEligible } from "@/enrichment/policyRules";

export function assertReadable<T>(field: EnrichedField<T>, now: Date): void {
  if (isExpired(field, now)) throw new Error("FIELD_EXPIRED");
}

export function assertRendererEligible<T>(
  field: EnrichedField<T>,
  surface: DisplaySurface,
  now: Date,
): void {
  assertReadable(field, now);
  if (!isRendererEligible(field, surface, now)) {
    throw new Error("RENDERER_NOT_ELIGIBLE");
  }
}

export function assertPurposeEligible<T>(
  field: EnrichedField<T>,
  purpose: AllowedPurpose,
  now: Date,
): void {
  assertReadable(field, now);
  if (!field.policy.allowedPurposes.includes(purpose)) {
    throw new Error("PURPOSE_NOT_ELIGIBLE");
  }
}

export function assertPersistable<T>(field: EnrichedField<T>): void {
  if (field.policy.persistence.kind === "NEVER") {
    throw new Error("FIELD_NOT_PERSISTABLE");
  }
}

export function assertModelEligible<T>(
  field: EnrichedField<T>,
  now: Date,
): void {
  assertPurposeEligible(field, "CALIBRATION_INPUT", now);
}
