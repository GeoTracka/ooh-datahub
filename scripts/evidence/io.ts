import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export async function fileSha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

export async function writeJsonAtomic(
  destination: string,
  value: unknown,
): Promise<void> {
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rm(destination, { force: true });
  await rename(temporary, destination);
}

export function requiredEnvironmentPath(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return path.resolve(value);
}

export async function replaceDirectoryAtomic(
  destination: string,
  build: (temporaryDirectory: string) => Promise<void>,
): Promise<void> {
  const parent = path.dirname(destination);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(
    path.join(parent, `.${path.basename(destination)}-${process.pid}-`),
  );
  const backup = `${destination}.${process.pid}.previous`;

  try {
    await build(temporary);
    await rm(backup, { recursive: true, force: true });
    try {
      await rename(destination, backup);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
      if (code !== "ENOENT") throw error;
    }
    await rename(temporary, destination);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    try {
      await rename(backup, destination);
    } catch {
      // The original destination either did not exist or is already intact.
    }
    throw error;
  }
}
