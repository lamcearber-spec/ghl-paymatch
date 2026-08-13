import { buildLocationTokenRequest, type HighLevelTokenResponse } from "./oauth";
import { getValidInstallation } from "./session";
import { recordAppEvent, type AppEvent } from "@/lib/observability/events";
import {
  getInstallationStore,
  installationFromTokenResponse,
  type InstallationStore,
  type PayMatchInstallation
} from "@/lib/store/installations";

type ProvisionLocationInput = {
  companyId: string;
  locationId: string;
};

type ProvisionLocationDependencies = {
  store?: InstallationStore;
  fetcher?: typeof fetch;
  now?: () => Date;
  oauthConfig?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  recordEvent?: (event: AppEvent) => Promise<void>;
};

export async function provisionLocationInstallation(
  input: ProvisionLocationInput,
  deps: ProvisionLocationDependencies = {}
): Promise<PayMatchInstallation> {
  const store = deps.store ?? getInstallationStore();
  const fetcher = deps.fetcher ?? fetch;
  const agency = await getValidInstallation(input.companyId, {
    store,
    fetcher,
    now: deps.now,
    oauthConfig: deps.oauthConfig,
    recordEvent: deps.recordEvent
  });

  if (agency.userType !== "Company" || agency.companyId !== input.companyId) {
    throw new Error("A matching HighLevel agency installation is required.");
  }

  const tokenRequest = buildLocationTokenRequest({
    agencyAccessToken: agency.accessToken,
    companyId: input.companyId,
    locationId: input.locationId
  });
  const response = await fetcher(tokenRequest.url, tokenRequest.init);
  if (!response.ok) {
    throw new Error(`HighLevel location token exchange failed: ${response.status}`);
  }

  const token = (await response.json()) as HighLevelTokenResponse;
  const installation = installationFromTokenResponse({
    ...token,
    companyId: input.companyId,
    locationId: input.locationId,
    userType: "Location"
  });
  await store.save(installation);
  await safeRecordEvent(deps.recordEvent ?? recordAppEvent, {
    installationId: installation.id,
    name: "install_completed",
    result: "success"
  });
  return installation;
}

async function safeRecordEvent(recorder: (event: AppEvent) => Promise<void>, event: AppEvent): Promise<void> {
  try {
    await recorder(event);
  } catch {
    // Provisioning must remain successful if optional telemetry is unavailable.
  }
}
