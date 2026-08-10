import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { assertAllowedEnrichmentDownloadUrl, sourceReleaseFromHttpHeaders } from "../src/enrichment/landing";
import { OPEN_ENRICHMENT_REGISTRY_VERSION, productionEnrichmentSource } from "../src/enrichment/sourceRegistry";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function requiredArg(name: string): string {
  const value = arg(name)?.trim();
  if (!value) throw new Error(`ENRICHMENT_ARGUMENT_REQUIRED:${name}`);
  return value;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function outputFileName(url: URL, sourceId: string): string {
  const candidate = basename(url.pathname);
  if (candidate && candidate !== "/") return candidate;
  return `${sourceId}.bin`;
}

export async function landOpenSource(): Promise<Record<string, unknown>> {
  const sourceId = requiredArg("source");
  const source = productionEnrichmentSource(sourceId);
  const requestedUrl = arg("url")?.trim() || source.canonicalAccessUri;
  const url = assertAllowedEnrichmentDownloadUrl(sourceId, requestedUrl);
  const outputRoot = resolve(arg("out-dir")?.trim() || "data/raw/enrichment");
  const retrievedAt = new Date().toISOString();

  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "ooh-datahub-open-enrichment/1" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`ENRICHMENT_DOWNLOAD_FAILED:${response.status}:${response.statusText}`);
  }
  const finalUrl = assertAllowedEnrichmentDownloadUrl(sourceId, response.url || url.toString());
  const sourceRelease = sourceReleaseFromHttpHeaders(arg("release"), {
    lastModified: response.headers.get("last-modified"),
    etag: response.headers.get("etag"),
  });

  const sourceDirectory = join(outputRoot, sourceId);
  await mkdir(sourceDirectory, { recursive: true });
  const temporaryPath = join(sourceDirectory, `.landing-${randomUUID()}`);
  const hash = createHash("sha256");
  let byteSize = 0;
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      byteSize += chunk.length;
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body as never),
      tap,
      createWriteStream(temporaryPath, { flags: "wx" }),
    );
    const artifactSha256 = hash.digest("hex");
    const artifactDirectory = join(sourceDirectory, artifactSha256);
    await mkdir(artifactDirectory, { recursive: true });
    const fileName = outputFileName(finalUrl, sourceId);
    const finalPath = join(artifactDirectory, fileName);
    if (await fileExists(finalPath)) await unlink(temporaryPath);
    else await rename(temporaryPath, finalPath);

    const manifest = {
      schemaVersion: 1,
      registryVersion: OPEN_ENRICHMENT_REGISTRY_VERSION,
      sourceId,
      sourceRelease,
      artifactSha256,
      byteSize,
      fileName,
      contentType: response.headers.get("content-type") || "application/octet-stream",
      requestedAccessUri: url.toString(),
      resolvedAccessUri: finalUrl.toString(),
      localPath: finalPath,
      retrievedAt,
      http: {
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        contentLength: response.headers.get("content-length"),
      },
      license: {
        licenseId: source.licenseId,
        attributionText: source.attributionText,
        shareAlike: source.shareAlike,
        commercialUseStatus: source.commercialUseStatus,
      },
      decisionUse: "context_only",
    };
    await writeFile(
      join(artifactDirectory, "artifact-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    return manifest;
  } catch (error) {
    try { await unlink(temporaryPath); } catch { /* no partial landing remains */ }
    throw error;
  }
}

landOpenSource()
  .then((manifest) => process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`enrichment:land failed: ${message}\n`);
    process.exitCode = 1;
  });
