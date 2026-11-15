import { Dashboard } from "@/components/Dashboard";
import { getFlow, getResults, getSupply } from "@/lib/ge6";

// Everything is static (bundled result data), so this page is prerendered at build time.
export default function Page() {
  return <Dashboard data={getResults()} supply={getSupply()} flow={getFlow()} />;
}
