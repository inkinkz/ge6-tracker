import type { Metadata } from "next";
import { Suspense } from "react";
import { WalletHistoryView } from "@/components/WalletHistoryView";

export const metadata: Metadata = {
  title: "ประวัติการโหวตของกระเป๋า — GE6 Vote Tracker",
  description:
    "ดูประวัติการโหวตของกระเป๋าใดก็ได้: เมมเบอร์และยอดโทเคนที่โหวตใน GE3–GE5 ยอดที่โหวตใน GE6 แล้ว และโทเคน GE6 / BNK ที่ยังถืออยู่",
};

// The address lives in ?address=, read on the client (useSearchParams), so the page shell is
// prerendered and the wallet data comes from the API routes.
export default function WalletPage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-sm text-muted">กำลังโหลด…</p>}>
      <WalletHistoryView />
    </Suspense>
  );
}
