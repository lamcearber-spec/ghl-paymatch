import { PayMatchDashboard } from "@/components/PayMatchDashboard";
import { demoPayMatchResult } from "@/lib/reconcile/fixtures";

export default function Home() {
  return <PayMatchDashboard result={demoPayMatchResult} mode="fixture" />;
}
