import type { Metadata } from "next";
import { Suspense } from "react";
import { Ge5View } from "@/components/Ge5View";
import { getGe5Comparison } from "@/lib/ge5";

export const metadata: Metadata = {
  title: "Top 200 กระเป๋าจาก GE5 ใน GE6 — GE6 Vote Tracker",
  description:
    "200 กระเป๋าที่โหวตมากที่สุดใน BNK48 & CGM48 General Election ครั้งที่ 5 เมมเบอร์ที่แต่ละกระเป๋าโหวตให้มากที่สุด และยอดโทเคนที่โหวตใน GE6 แล้ว",
};

// getGe5Comparison is cached (`use cache`), so this page is prerendered and regenerated in the
// background. It deliberately has no client polling (unlike the home page): the GE6 numbers are
// as of page load. The boundary is normally already filled in the prerendered HTML.
async function Ge5WithData() {
  const data = await getGe5Comparison();
  return <Ge5View data={data} />;
}

export default function Ge5Page() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-sm text-muted">กำลังโหลดข้อมูล…</p>}>
      <Ge5WithData />
    </Suspense>
  );
}
