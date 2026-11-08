"use client";

import type { TokenFlow } from "@/lib/types";
import { fmtAgo, fmtDateTime, fmtNumber, fmtPercent, fmtTokens } from "@/lib/format";
import { useNow } from "@/lib/use-live-stats";
import { Swatch } from "./chart";
import { AddressLink, Section } from "./ui";

/**
 * Each distribution wallet as a meter of its own allocation: blue = already passed on to fans,
 * grey = still in the wallet. Allocations range from ~2K to 800K GE6, so a shared scale would hide
 * most rows; the allocation itself is printed instead.
 */
export function Distributors({ flow }: { flow: TokenFlow }) {
  const now = useNow(60_000);
  const rows = flow.wallets.map((w) => {
    const remaining = w.balance ?? Math.max(0, w.allocated - w.sent);
    return { ...w, remaining, share: w.sent + remaining > 0 ? w.sent / (w.sent + remaining) : 0 };
  });
  const allocated = rows.reduce((a, w) => a + w.allocated, 0);
  const sent = rows.reduce((a, w) => a + w.sent, 0);

  return (
    <Section
      id="distributors"
      title="กระเป๋าแจกจ่ายของผู้จัด"
      subtitle={`${rows.length} กระเป๋าได้รับรวม ${fmtTokens(allocated)} GE6 จากกระเป๋าหลัก แจกต่อให้แฟนแล้ว ${fmtPercent(allocated > 0 ? sent / allocated : 0)}`}
    >
      <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="คำอธิบายสี">
        <li className="inline-flex items-center gap-1.5">
          <Swatch className="bg-data" />
          แจกให้แฟนแล้ว
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Swatch className="bg-supply-org" />
          ยังเหลือในกระเป๋า
        </li>
      </ul>
      <ul className="divide-y divide-line">
        {rows.map((w) => (
          <li key={w.address} className="py-3">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <AddressLink address={w.address} />
              <span className="whitespace-nowrap tabular">
                <span className="text-xs text-muted">ได้รับ </span>
                <span className="font-semibold">{fmtTokens(w.allocated)}</span> <span className="text-xs text-muted">GE6</span>
              </span>
            </div>
            <div
              className="mt-2 flex h-2 gap-0.5"
              role="img"
              aria-label={`แจกแล้ว ${fmtTokens(w.sent)} GE6 (${fmtPercent(w.share)}), เหลือ ${fmtTokens(w.remaining)} GE6`}
            >
              {w.sent > 0 ? (
                <div title={`แจกแล้ว ${fmtTokens(w.sent)} GE6`} className="min-w-1 rounded-full bg-data" style={{ flex: `${w.sent} 1 0%` }} />
              ) : null}
              {w.remaining > 0 ? (
                <div
                  title={`เหลือ ${fmtTokens(w.remaining)} GE6`}
                  className="min-w-1 rounded-full bg-supply-org"
                  style={{ flex: `${w.remaining} 1 0%` }}
                />
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted">
              <span className="whitespace-nowrap">
                แจกแล้ว <span className="font-medium text-ink-2">{fmtPercent(w.share)}</span>
              </span>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap">เหลือ {fmtTokens(w.remaining)}</span>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap">ถึงแฟน {fmtNumber(w.recipients)} กระเป๋า</span>
              {w.lastSentAt ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="whitespace-nowrap">ล่าสุด {now ? fmtAgo(w.lastSentAt, now) : fmtDateTime(w.lastSentAt)}</span>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        กระเป๋าหลักยังแจกให้แฟนโดยตรงอีก {fmtTokens(flow.direct.sent)} GE6 ({fmtNumber(flow.direct.recipients)} กระเป๋า) · รวมแล้วโทเคนถึงมือแฟน{" "}
        {fmtNumber(flow.recipients)} กระเป๋า
      </p>
    </Section>
  );
}
