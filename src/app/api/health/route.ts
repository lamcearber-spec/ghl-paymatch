import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export async function GET() {
  const database = await databaseReady();
  const oauth = Boolean(process.env.GHL_CLIENT_ID && process.env.GHL_CLIENT_SECRET && process.env.GHL_REDIRECT_URI);
  const tokenEncryption = Boolean(process.env.INSTALLATION_SECRET && process.env.INSTALLATION_SECRET.length >= 24);
  const ready = database && oauth && tokenEncryption;

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      checks: { application: true, database, oauth, tokenEncryption }
    },
    { status: ready ? 200 : 503 }
  );
}

async function databaseReady(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }

  try {
    const sql = neon(databaseUrl);
    await sql`select 1 as ready`;
    return true;
  } catch {
    return false;
  }
}
