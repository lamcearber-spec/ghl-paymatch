import { NextResponse } from "next/server";
import { recordAppEvent, type AppEvent } from "@/lib/observability/events";
import { readInstallationSession } from "@/lib/security/installation-session";

const EXPORT_NAMES = new Set([
  "paymatch-paid-without-charge.csv",
  "paymatch-charge-without-invoice.csv",
  "paymatch-active-sub-failed-payment.csv",
  "paymatch-linked-mismatch.csv"
]);

type ExportEventDependencies = {
  recordEvent?: (event: AppEvent) => Promise<void>;
};

export async function POST(request: Request) {
  return handleExportEvent(request);
}

export async function handleExportEvent(request: Request, deps: ExportEventDependencies = {}) {
  let body: { session?: unknown; exportName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (typeof body.session !== "string" || !body.session.trim()) {
    return NextResponse.json({ error: "session is required." }, { status: 400 });
  }
  if (typeof body.exportName !== "string" || !EXPORT_NAMES.has(body.exportName)) {
    return NextResponse.json({ error: "invalid_export" }, { status: 400 });
  }

  let installationId: string;
  try {
    installationId = readInstallationSession(body.session);
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  await (deps.recordEvent ?? recordAppEvent)({
    installationId,
    name: "export_completed",
    result: "success"
  });
  return new NextResponse(null, { status: 202 });
}
