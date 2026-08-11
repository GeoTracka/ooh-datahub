export async function requestPreflight(body: unknown, signal?: AbortSignal) {
  const response = await fetch("/api/enrichment/preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error("PREFLIGHT_FAILED");
  return response.json();
}

export async function runEnrichment(body: unknown, signal?: AbortSignal) {
  const response = await fetch("/api/enrichment/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error("ENRICHMENT_FAILED");
  return response.json();
}
