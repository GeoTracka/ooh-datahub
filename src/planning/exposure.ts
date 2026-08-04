export function generalOts(
  movement: number,
  visibility: number,
  delivery: number,
): number {
  if (visibility < 0 || visibility > 1) throw new Error("Visibility must be 0..1");
  if (delivery < 0 || delivery > 1) throw new Error("Delivery must be 0..1");
  return movement * visibility * delivery;
}

export function targetOts(ots: number, targetShare: number): number {
  if (targetShare < 0 || targetShare > 1) throw new Error("Target share must be 0..1");
  return ots * targetShare;
}
