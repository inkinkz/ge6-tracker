"use client";

import { useState } from "react";
import type { StatsSnapshot } from "@/lib/types";
import { fmtDateTime, fmtNumber, fmtPercent, fmtTokens } from "@/lib/format";
import { AddressLink, Section, Segmented, ShareBar } from "./ui";

const SIZES = [10, 25, 50, 100] as const;

export function TopVoters({ data, myWallet }: { data: StatsSnapshot; myWallet: string | null }) {
  const [n, setN] = useState<(typeof SIZES)[number]>(10);
  const { topVoters, concentration, totals } = data;
  const rows = topVoters.slice(0, n);
  const maxShare = topVoters[0]?.share ?? 0;
  const topNShare = rows.reduce((acc, v) => acc + v.share, 0);

  return (
    <Section
      id="top"
      title={`Top ${n} กระเป๋าที่โหวตมากที่สุด`}
      subtitle={`รวมกัน ${fmtPercent(topNShare)} ของโทเคนที่โหวตทั้งหมด`}
    >
      <p className="mb-5 rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
        แค่ <b className="text-ink tabular">{fmtNumber(concentration.walletsForHalf)} กระเป๋า</b> แรกก็โหวตรวมกันเกินครึ่งหนึ่งของยอดทั้งหมดแล้ว ·
        Top 10 = <b className="text-ink tabular">{fmtPercent(concentration.top10Share)}</b> · Top 100 ={" "}
        <b className="text-ink tabular">{fmtPercent(concentration.top100Share)}</b>
      </p>

      <div className="mb-2">
        <Segmented
          label="จำนวนอันดับที่แสดง"
          value={n}
          onChange={setN}
          options={SIZES.map((s) => ({ value: s, label: `Top ${s}` }))}
        />
      </div>

      <ol className="divide-y divide-line">
        {rows.map((v) => {
          const mine = myWallet === v.address;
          return (
            <li key={v.address} className={`py-3.5 ${mine ? "-mx-3 rounded-xl bg-data-wash px-3" : ""}`}>
              <div className="flex items-baseline gap-3">
                <span className="w-8 shrink-0 text-right text-sm font-semibold text-ink-2 tabular">#{v.rank}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <AddressLink address={v.address} highlight={mine} />
                      {mine ? <span className="rounded bg-data px-1.5 text-[11px] font-semibold text-white">ของฉัน</span> : null}
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold tabular">
                      {fmtTokens(v.tokens)} <span className="text-xs font-normal text-muted">GE6</span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <ShareBar value={v.share} max={maxShare} />
                  </div>
                  <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted tabular">
                    <span>
                      {fmtPercent(v.share)} · {fmtNumber(v.votes)} ครั้ง
                    </span>
                    <span>ล่าสุด {fmtDateTime(v.lastVoteAt)}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        จากทั้งหมด {fmtNumber(totals.voters)} กระเป๋า · แตะที่อยู่กระเป๋าเพื่อดูบน Token X Scan
      </p>
    </Section>
  );
}
