import type { Metadata } from "next";
import { Suspense } from "react";
import { PastGeView } from "@/components/PastGeView";
import { getPastComparison } from "@/lib/past-ge";

export const metadata: Metadata = {
  title: "Top 300 กระเป๋าจาก GE4 ใน GE6 — GE6 Vote Tracker",
  description:
    "300 กระเป๋าที่โหวตมากที่สุดใน BNK48 & CGM48 General Election ครั้งที่ 4 เมมเบอร์ที่แต่ละกระเป๋าโหวตให้มากที่สุด และยอดโทเคนที่โหวตใน GE6 แล้ว",
};

// getPastComparison is cached (`use cache`), so this page is prerendered and regenerated in the
// background. It deliberately has no client polling (unlike the home page): the GE6 numbers are
// as of page load. The boundary is normally already filled in the prerendered HTML.
async function WithData() {
  const data = await getPastComparison("ge4");
  return <PastGeView data={data} />;
}

export default function Ge4Page() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-sm text-muted">กำลังโหลดข้อมูล…</p>}>
      <WithData />
    </Suspense>
  );
}
