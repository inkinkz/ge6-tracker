"use client";

import { useState } from "react";
import type { RecentVote } from "@/lib/types";
import { fmtAgo, fmtDateTime, fmtNumber, fmtTokens } from "@/lib/format";
import { useNow } from "@/lib/use-live-stats";
import { AddressLink, Section, TxLink } from "./ui";

const COLLAPSED_COUNT = 10;

export function RecentVotes({ votes, myWallet, pollSeconds }: { votes: RecentVote[]; myWallet: string | null; pollSeconds: number }) {
  const now = useNow(5000);
  // Rows that arrive after page load mount fresh (keyed by vote index) and flash once.
  const [loadedUpTo] = useState(() => votes[0]?.index ?? -1);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? votes : votes.slice(0, COLLAPSED_COUNT);

  return (
    <Section
      id="recent"
      title="โหวตล่าสุด"
      subtitle={`อัปเดตอัตโนมัติทุก ~${pollSeconds} วินาทีขณะเปิดหน้านี้`}
    >
      <ul className="-mx-2 divide-y divide-line" aria-live="polite" aria-relevant="additions">
        {shown.map((v) => {
          const mine = myWallet === v.voter;
          return (
            <li
              key={v.index}
              className={`flex items-center justify-between gap-3 rounded-lg px-2 py-3 ${v.index > loadedUpTo ? "flash-in" : ""} ${mine ? "bg-data-wash" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <AddressLink address={v.voter} highlight={mine} />
                  {mine ? <span className="rounded bg-data px-1.5 text-[11px] font-semibold text-white">ของฉัน</span> : null}
                </div>
                <div className="mt-1 text-xs text-muted">
                  <TxLink hash={v.tx}>
                    <time dateTime={new Date(v.at * 1000).toISOString()} title={fmtDateTime(v.at)}>
                      {now ? fmtAgo(v.at, now) : fmtDateTime(v.at)}
                    </time>
                  </TxLink>{" "}
                  · โหวตที่ #{fmtNumber(v.index + 1)}
                </div>
              </div>
              <div className="shrink-0 text-right text-[15px] font-semibold tabular">
                {fmtTokens(v.tokens)} <span className="text-xs font-normal text-muted">GE6</span>
              </div>
            </li>
          );
        })}
      </ul>
      {votes.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-4 min-h-11 w-full rounded-xl text-sm font-medium text-link ring-1 ring-line hover:bg-surface-2"
        >
          {expanded ? "ย่อรายการ" : `ดูเพิ่ม (${fmtNumber(votes.length)} รายการล่าสุด)`}
        </button>
      ) : null}
    </Section>
  );
}
