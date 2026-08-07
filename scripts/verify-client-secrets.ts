import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const forbidden = [
  /GOOGLE_GEOCODING_API_KEY/i,
  /X-Goog-Api-Key/i,
  /AIza[0-9A-Za-z_-]{20,}/,
];

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : Promise.resolve([path]);
  }));
  return nested.flat();
}

const staticRoot = resolve(".next/static");
const violations: string[] = [];
for (const file of await filesUnder(staticRoot)) {
  const contents = await readFile(file, "utf8");
  if (forbidden.some((pattern) => pattern.test(contents))) violations.push(file);
}
if (violations.length > 0) {
  throw new Error("CLIENT_SECRET_PATTERN:" + violations.join(","));
}
console.log("No server-key patterns found in .next/static");
