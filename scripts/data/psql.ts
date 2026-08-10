import { spawn } from "node:child_process";
import { once } from "node:events";
import type { Writable } from "node:stream";

export type PsqlResult = {
  stdout: string;
  stderr: string;
};

export type PsqlSession = {
  write: (chunk: string) => Promise<void>;
  finish: () => Promise<PsqlResult>;
};

function decode(value: string): string {
  return decodeURIComponent(value);
}

export function postgresEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("INVALID_DATABASE_URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("INVALID_DATABASE_PROTOCOL");
  }
  const database = decode(url.pathname.replace(/^\/+/, ""));
  if (!url.hostname || !database) throw new Error("INCOMPLETE_DATABASE_URL");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: url.hostname,
    PGDATABASE: database,
  };
  if (url.port) env.PGPORT = url.port;
  if (url.username) env.PGUSER = decode(url.username);
  if (url.password) env.PGPASSWORD = decode(url.password);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  const applicationName = url.searchParams.get("application_name");
  if (applicationName) env.PGAPPNAME = applicationName;
  return env;
}

function writeWithBackpressure(stream: Writable, chunk: string): Promise<void> {
  if (stream.destroyed) return Promise.reject(new Error("PSQL_STDIN_CLOSED"));
  if (stream.write(chunk, "utf8")) return Promise.resolve();
  return once(stream, "drain").then(() => undefined);
}

export function startPsql(
  databaseUrl: string,
  options: { tuplesOnly?: boolean } = {},
): PsqlSession {
  const binary = process.env.PSQL_BIN || "psql";
  const args = ["-X", "--set", "ON_ERROR_STOP=1", "--quiet"];
  if (options.tuplesOnly) {
    args.push("--tuples-only", "--no-align", "--field-separator=\t");
  }

  const child = spawn(binary, args, {
    env: postgresEnvironment(databaseUrl),
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  let processError: Error | null = null;
  child.on("error", (error) => {
    processError = error;
  });

  const completion = new Promise<PsqlResult>((resolve, reject) => {
    child.on("close", (code) => {
      if (processError) {
        reject(new Error(`PSQL_PROCESS_ERROR:${processError.message}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`PSQL_FAILED:${code ?? "signal"}:${stderr.trim().slice(-4000)}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

  return {
    write: (chunk) => writeWithBackpressure(child.stdin, chunk),
    finish: async () => {
      child.stdin.end();
      return completion;
    },
  };
}

export async function runPsql(
  databaseUrl: string,
  sql: string,
  options: { tuplesOnly?: boolean } = {},
): Promise<PsqlResult> {
  const session = startPsql(databaseUrl, options);
  await session.write(sql.endsWith("\n") ? sql : `${sql}\n`);
  return session.finish();
}
