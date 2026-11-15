import type { Metadata } from "next";
import { PastGeView } from "@/components/PastGeView";
import { getPastComparison } from "@/lib/past-ge";

export const metadata: Metadata = {
  title: "Top 300 กระเป๋าจาก GE5 ใน GE6 — GE6 Vote Tracker",
  description:
    "300 กระเป๋าที่โหวตมากที่สุดใน BNK48 & CGM48 General Election ครั้งที่ 5 เมมเบอร์ที่แต่ละกระเป๋าโหวตให้มากที่สุด และผลโหวต GE6",
};

// All static data, so the page is prerendered at build time.
export default function Ge5Page() {
  return <PastGeView data={getPastComparison("ge5")} />;
}
