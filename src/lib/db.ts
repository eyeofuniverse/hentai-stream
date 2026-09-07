import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Open the pool eagerly so the first real request isn't paying the (slow, from
// far away) connection handshake.
if (!globalForPrisma.prisma || process.env.NODE_ENV === "production") {
  prisma.$connect().catch(() => {});
}

/**
 * True when an error is a transient connection / pooler problem worth retrying
 * rather than a real query bug. The DB is in us-east-2, the dev + build box can
 * be far away and flaky, and Supabase's free pooler resets connections under
 * sustained load — none of that should fail a render, a build, or an import.
 */
export function isTransientDbError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientRustPanicError) return true;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1000", "P1001", "P1002", "P1008", "P1010", "P1017", "P2024", "P2028"].includes(
      err.code,
    )
  ) {
    return true;
  }
  // Connection resets / socket errors surface as "unknown" request errors or
  // plain errors whose message carries the give-away phrasing.
  const msg =
    err instanceof Error ? `${err.message} ${(err as { code?: string }).code ?? ""}` : "";
  return /ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|ECONNREFUSED|10054|connection.*(closed|reset|terminat)|closed the connection|Timed out fetching|pool timeout|Can't reach database|Server has closed/i.test(
    msg,
  );
}

/**
 * Run a DB operation, retrying transient connection errors with exponential
 * backoff + jitter. Safe only for idempotent work (reads, upserts, or writes
 * you don't mind re-attempting).
 */
export async function db<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransientDbError(err) || i === attempts - 1) throw err;
      const backoff = Math.min(8000, 300 * 2 ** i) + Math.random() * 250;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw last;
}
