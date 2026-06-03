import { NextResponse } from "next/server";
import { HighLevelClient } from "@/lib/ghl/client";
import { demoPayMatchInput } from "@/lib/reconcile/fixtures";
import { reconcilePayMatch } from "@/lib/reconcile/matcher";
import { toCsv } from "@/lib/reconcile/export";
import { getInstallationStore } from "@/lib/store/installations";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? demoPayMatchInput.dateRange.from;
  const to = url.searchParams.get("to") ?? demoPayMatchInput.dateRange.to;
  const locationId = url.searchParams.get("locationId") ?? "demo-location";
  const installationId = url.searchParams.get("installationId");
  const dateRange = { from, to };
  const installation = installationId ? await getInstallationStore().get(installationId) : undefined;

  if (installation) {
    const client = new HighLevelClient(installation.accessToken);
    const liveLocationId = installation.locationId ?? locationId;
    const [invoices, transactions, subscriptions, contacts] = await Promise.all([
      client.listInvoices(liveLocationId, dateRange),
      client.listTransactions(liveLocationId, dateRange),
      client.listSubscriptions(liveLocationId),
      client.listContacts(liveLocationId)
    ]);
    const result = reconcilePayMatch({ dateRange, invoices, transactions, subscriptions, contacts });

    return payMatchResponse("live", liveLocationId, result);
  }

  const result = reconcilePayMatch({ ...demoPayMatchInput, dateRange });

  return payMatchResponse("fixture", locationId, result);
}

function payMatchResponse(mode: "fixture" | "live", locationId: string, result: ReturnType<typeof reconcilePayMatch>) {
  return NextResponse.json({
    mode,
    locationId,
    result,
    csv: {
      paidWithoutCharge: toCsv(result.tables.paidWithoutCharge),
      chargeWithoutInvoice: toCsv(result.tables.chargeWithoutInvoice),
      activeSubFailedPayment: toCsv(result.tables.activeSubFailedPayment),
      amountCurrencyMismatch: toCsv(result.tables.amountCurrencyMismatch)
    }
  });
}
