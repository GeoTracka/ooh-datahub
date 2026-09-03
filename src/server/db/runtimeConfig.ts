import "server-only";

export function evidenceRuntimeConfig() {
  const url = process.env.MARIADB_URL?.trim();
  if (!url) throw new Error("MARIADB_URL_REQUIRED");

  const parsed = new URL(url);
  if (parsed.protocol !== "mysql:") {
    throw new Error("MARIADB_URL_MUST_USE_MYSQL_PROTOCOL");
  }

  return { url } as const;
}
