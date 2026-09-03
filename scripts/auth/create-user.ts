import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RowDataPacket } from "mysql2/promise";

import { hashPassword } from "@/server/auth/password";
import { normalizeEmail } from "@/server/auth/currentUser";
import { uuidToBinary } from "@/server/auth/ids";
import { evidenceDatabase } from "@/server/db/client";

type Arguments = { email: string; name: string; replacePassword: boolean };

function parseArguments(values: readonly string[]): Arguments {
  let email = "";
  let name = "";
  let replacePassword = false;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--email") email = values[++index] ?? "";
    else if (value === "--name") name = values[++index] ?? "";
    else if (value === "--replace-password") replacePassword = true;
    else throw new Error(`UNKNOWN_ARGUMENT:${value}`);
  }
  email = normalizeEmail(email);
  name = name.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!email || !email.includes("@")) throw new Error("VALID_EMAIL_REQUIRED");
  if (!name || name.length > 120) throw new Error("VALID_NAME_REQUIRED");
  return { email, name, replacePassword };
}

export async function createUser(args: Arguments, password: string): Promise<void> {
  if (password.length < 12) throw new Error("PASSWORD_MUST_BE_AT_LEAST_12_CHARACTERS");
  const { pool } = evidenceDatabase();
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM app_users WHERE email = ? LIMIT 1",
    [args.email],
  );
  const passwordHash = await hashPassword(password);
  if (existing.length > 0) {
    if (!args.replacePassword) throw new Error("ACCOUNT_ALREADY_EXISTS");
    await pool.execute(
      "UPDATE app_users SET display_name = ?, password_hash = ?, status = 'active' WHERE email = ?",
      [args.name, passwordHash, args.email],
    );
    return;
  }
  await pool.execute(
    `INSERT INTO app_users (id, email, display_name, password_hash, status)
     VALUES (?, ?, ?, ?, 'active')`,
    [uuidToBinary(randomUUID()), args.email, args.name, passwordHash],
  );
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const password = process.env.APP_BOOTSTRAP_PASSWORD ?? "";
  await createUser(args, password);
  process.stdout.write(`Account ready for ${args.email}.\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
