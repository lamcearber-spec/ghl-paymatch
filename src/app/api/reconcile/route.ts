import { NextResponse } from "next/server";
import { scanPayMatch } from "@/lib/paymatch/scan";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scan = await scanPayMatch({
    installationId: url.searchParams.get("installationId") ?? undefined,
    locationId: url.searchParams.get("locationId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined
  });

  return NextResponse.json(scan);
}
