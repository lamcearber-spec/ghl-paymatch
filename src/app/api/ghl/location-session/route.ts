import { NextResponse } from "next/server";
import { provisionLocationInstallation } from "@/lib/ghl/provision-location";
import { createInstallationSession, readInstallationSession } from "@/lib/security/installation-session";
import { getInstallationStore, type InstallationStore, type PayMatchInstallation } from "@/lib/store/installations";

type LocationSessionDependencies = {
  store?: InstallationStore;
  readSession?: (session: string) => string;
  createSession?: (installationId: string) => string;
  provisionLocation?: (input: { companyId: string; locationId: string }) => Promise<PayMatchInstallation>;
};

export async function POST(request: Request) {
  return handleLocationSession(request);
}

export async function handleLocationSession(request: Request, deps: LocationSessionDependencies = {}) {
  let body: { session?: unknown; locationId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.session !== "string" || typeof body.locationId !== "string") {
    return NextResponse.json({ error: "Session and location are required." }, { status: 400 });
  }

  let authenticatedId: string;
  try {
    authenticatedId = (deps.readSession ?? readInstallationSession)(body.session);
  } catch {
    return NextResponse.json({ error: "Installation session is invalid." }, { status: 401 });
  }

  const store = deps.store ?? getInstallationStore();
  const authenticated = await store.get(authenticatedId);
  if (!authenticated) {
    return NextResponse.json({ error: "Installation was not found." }, { status: 401 });
  }

  if (authenticated.userType === "Location") {
    if (authenticated.id !== body.locationId) {
      return NextResponse.json({ error: "Location is not authorized." }, { status: 403 });
    }
    return NextResponse.json({ session: (deps.createSession ?? createInstallationSession)(authenticated.id) });
  }

  const companyId = authenticated.companyId;
  if (!companyId || companyId !== authenticated.id) {
    return NextResponse.json({ error: "Agency installation is invalid." }, { status: 403 });
  }

  const existing = await store.get(body.locationId);
  if (existing && (existing.userType !== "Location" || existing.companyId !== companyId)) {
    return NextResponse.json({ error: "Location is not authorized." }, { status: 403 });
  }

  const location = existing ?? await (deps.provisionLocation ?? provisionLocationInstallation)({
    companyId,
    locationId: body.locationId
  });
  return NextResponse.json({ session: (deps.createSession ?? createInstallationSession)(location.id) });
}
