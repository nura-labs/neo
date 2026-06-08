import { NextResponse } from "next/server";
import { Pool } from "pg";
import { adminAuth } from "@/lib/auth/firebase-admin";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      INSTANCE_UNIX_SOCKET: process.env.INSTANCE_UNIX_SOCKET ?? "(not set)",
      DB_NAME: process.env.DB_NAME ?? "(not set)",
      DB_USER: process.env.DB_USER ?? "(not set)",
      DB_PASS_LENGTH: process.env.DB_PASS?.length ?? 0,
      DB_PASS_TRIMMED_LENGTH: process.env.DB_PASS?.trim().length ?? 0,
      FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    },
  };

  // Test DB connection with raw pg Pool
  const pool = new Pool({
    host: process.env.INSTANCE_UNIX_SOCKET,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS?.trim(),
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    const result = await client.query("SELECT 1 as ok");
    client.release();
    await pool.end();
    checks.db = { ok: true, result: result.rows[0] };
  } catch (err) {
    await pool.end().catch(() => {});
    checks.db = {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      code: (err as Record<string, unknown>)?.code,
      errno: (err as Record<string, unknown>)?.errno,
      syscall: (err as Record<string, unknown>)?.syscall,
      address: (err as Record<string, unknown>)?.address,
    };
  }

  // Test Firebase Admin
  try {
    checks.firebaseAdmin = { ok: true, projectId: adminAuth.app.options.projectId };
  } catch (err) {
    checks.firebaseAdmin = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const allOk = (checks.db as { ok: boolean }).ok;
  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
