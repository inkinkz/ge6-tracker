import type { Metadata } from "next";
import { CompareView } from "@/components/CompareView";
import { getGeCompare } from "@/lib/compare";

export const metadata: Metadata = {
  title: "เทียบ GE3–GE6 — GE6 Vote Tracker",
  description:
    "เทียบ BNK48 & CGM48 General Election ครั้งที่ 3–6: ยอดโทเคน จำนวนกระเป๋า กระเป๋าที่กลับมาโหวต และอันดับเมมเบอร์ของแต่ละครั้ง",
};

// All static data, so the page is prerendered at build time.
export default function ComparePage() {
  return <CompareView data={getGeCompare()} />;
}
