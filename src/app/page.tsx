import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { getInitialSnapshot } from "@/lib/initial";

async function DashboardWithData() {
  const initial = await getInitialSnapshot();
  return <Dashboard initial={initial} />;
}

export default function Page() {
  // The cached snapshot is resolved at build/revalidation time, so this boundary is normally
  // already filled in the prerendered HTML; the fallback only shows if that data isn't ready.
  return (
    <Suspense fallback={<Dashboard initial={null} />}>
      <DashboardWithData />
    </Suspense>
  );
}
