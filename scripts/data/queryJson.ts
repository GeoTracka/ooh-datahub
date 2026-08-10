import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { postgresEnvironment } from "./psql";

export async function* queryJsonRows<T>(
  databaseUrl: string,
  sql: string,
): AsyncGenerator<T> {
  const binary = process.env.PSQL_BIN || "psql";
  const child = spawn(
    binary,
    ["-X", "--set", "ON_ERROR_STOP=1", "--quiet", "--tuples-only", "--no-align"],
    {
      env: postgresEnvironment(databaseUrl),
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stderr = "";
  let processError: Error | null = null;
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.on("error", (error) => {
    processError = error;
  });

  const completion = new Promise<void>((resolve, reject) => {
    child.on("close", (code) => {
      if (processError) {
        reject(new Error(`PSQL_QUERY_PROCESS_ERROR:${processError.message}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`PSQL_QUERY_FAILED:${code ?? "signal"}:${stderr.trim().slice(-4000)}`));
        return;
      }
      resolve();
    });
  });

  child.stdin.end(`\\set ON_ERROR_STOP on\n${sql.trimEnd()}\n`);
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as T;
      } catch {
        throw new Error(`INVALID_PSQL_JSON_ROW:${lineNumber}`);
      }
    }
    await completion;
  } catch (error) {
    if (!child.killed) child.kill("SIGTERM");
    try {
      await completion;
    } catch {
      // Preserve the parsing/caller error when it is more specific.
    }
    throw error;
  }
}
