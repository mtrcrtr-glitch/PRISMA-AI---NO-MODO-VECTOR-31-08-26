import "@tanstack/react-start/server-only"
import { env } from "cloudflare:workers"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

type Database = ReturnType<typeof drizzle>

/**
 * Server-only database access. The `server-only` import above is this file's
 * environment marker — do not copy it onto a `createServerFn` module; routes
 * must be able to import those. Call `withDatabase` from a `.handler()` only.
 *
 * Runs database work with a client scoped to the current Worker request.
 * Cloudflare TCP sockets cannot be created globally or reused across requests.
 */
export async function withDatabase<T>(
  run: (database: Database) => Promise<T>,
): Promise<T> {
  const databaseUrl = (env as { DATABASE_URL?: string }).DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is not set")

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  })

  try {
    return await run(drizzle(sql))
  } finally {
    await sql.end()
  }
}