import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/CompareView";
import { getGeCompare } from "@/lib/compare";

export const metadata: Metadata = {
  title: "เทียบ GE3–GE6 — GE6 Vote Tracker",
  description:
    "เทียบ BNK48 & CGM48 General Election ครั้งที่ 3–6: ยอดโทเคน จำนวนกระเป๋า กระเป๋าที่กลับมาโหวต และอันดับเมมเบอร์ของแต่ละครั้ง",
};

// Cached (`use cache`) and prerendered like the GE3–GE5 pages; no client polling.
async function WithData() {
  const data = await getGeCompare();
  return <CompareView data={data} />;
}

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-sm text-muted">กำลังโหลดข้อมูล…</p>}>
      <WithData />
    </Suspense>
  );
}
