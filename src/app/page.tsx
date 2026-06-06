import { PayMatchDashboard } from "@/components/PayMatchDashboard";
import { scanPayMatch } from "@/lib/paymatch/scan";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams } = {}) {
  const params = searchParams ? await searchParams : {};
  const scan = await scanPayMatch({
    installationId: firstParam(params.installationId),
    locationId: firstParam(params.locationId),
    from: firstParam(params.from),
    to: firstParam(params.to)
  });

  return <PayMatchDashboard result={scan.result} mode={scan.mode} />;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
