type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function normalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const normalized: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))) {
      normalized[key] = normalize(child);
    }
    return normalized;
  }
  throw new Error("Unsupported JSON value: " + typeof value);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}
