import type { ReactNode } from "react";
import type { SupplySnapshot } from "@/lib/types";
import { GE6_TREASURY } from "@/lib/config";
import { fmtNumber, fmtPercent, fmtTokens } from "@/lib/format";
import { AnimatedNumber } from "./AnimatedNumber";
import { AddressLink } from "./ui";

function Swatch({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-sm ring-1 ring-line ring-inset ${className}`} />;
}

/** Keeps a phrase on one line so notes wrap only at the " · " separators. */
function Nw({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

function Stat({ label, value, swatch, note }: { label: string; value: number; swatch?: string; note: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[13px] leading-snug text-ink-2">
        {swatch ? <Swatch className={swatch} /> : null}
        {label}
      </dt>
      <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-1">
        <span className="text-xl font-semibold tracking-tight tabular sm:text-2xl">
          <AnimatedNumber value={value} format={fmtTokens} />
        </span>
        <span className="text-sm text-muted">GE6</span>
      </dd>
      <dd className="mt-1 text-xs leading-relaxed text-muted">{note}</dd>
    </div>
  );
}

/** Where every GE6 token is: still with the organizer, voted, or sitting in fans' wallets. */
export function Supply({ supply }: { supply: SupplySnapshot }) {
  const { created, organizer, distributed, voted, inWallets } = supply;
  const ofCreated = (n: number) => (created > 0 ? n / created : 0);
  const ofDistributed = (n: number) => (distributed > 0 ? n / distributed : 0);

  // Left to right: what has reached fans (voted, then not yet voted), then what the organizer still holds.
  const parts = [
    { label: "โหวตแล้ว", value: voted, swatch: "bg-data" },
    { label: "ยังอยู่ในกระเป๋าแฟน", value: inWallets, swatch: "bg-supply-wallet" },
    { label: "ยังอยู่กับผู้จัด", value: organizer, swatch: "bg-supply-org" },
  ];
  const describe = (p: (typeof parts)[number]) => `${p.label} ${fmtTokens(p.value)} GE6 (${fmtPercent(ofCreated(p.value))})`;

  return (
    <section aria-labelledby="supply-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="supply-title" className="text-base font-semibold">
          โทเคน GE6 ทั้งหมดอยู่ที่ไหน
        </h2>
        <p className="text-xs text-muted">ยอดคงเหลือบนบล็อกเชน ณ บล็อก {fmtNumber(supply.block)}</p>
      </div>

      <div role="img" aria-label={`โทเคน GE6 ทั้งหมด ${fmtTokens(created)}: ${parts.map(describe).join(", ")}`} className="mt-4 flex gap-0.5">
        {parts.map((p) =>
          p.value > 0 ? (
            <div key={p.label} title={describe(p)} className="min-w-1 py-1.5" style={{ flex: `${p.value} 1 0%` }}>
              <div className={`h-2 rounded-full ${p.swatch}`} />
            </div>
          ) : null,
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        <Stat label="สร้างขึ้นทั้งหมด" value={created} note="โทเคน GE6 ทั้งหมดที่มีอยู่" />
        <Stat
          label="ยังอยู่กับผู้จัด"
          value={organizer}
          swatch="bg-supply-org"
          note={
            <>
              <Nw>{fmtPercent(ofCreated(organizer))} ของทั้งหมด</Nw> · <Nw>ยังไม่ได้แจก</Nw>
            </>
          }
        />
        <Stat
          label="แจกให้แฟนแล้ว"
          value={distributed}
          note={
            <>
              <Nw>{fmtPercent(ofCreated(distributed))} ของทั้งหมด</Nw> ·{" "}
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Swatch className="bg-data" />
                โหวตแล้ว {fmtPercent(ofDistributed(voted))}
              </span>
            </>
          }
        />
        <Stat
          label="ยังอยู่ในกระเป๋าแฟน"
          value={inWallets}
          swatch="bg-supply-wallet"
          note={
            <>
              <Nw>ยังไม่ได้โหวต</Nw> · <Nw>{fmtPercent(ofDistributed(inWallets))} ของที่แจก</Nw>
            </>
          }
        />
      </dl>

      <p className="mt-5 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        &ldquo;ผู้จัด&rdquo; คือกระเป๋าหลักที่ได้รับโทเคนทั้งหมดตอนสร้าง (<AddressLink address={GE6_TREASURY} />){" "}
        ถืออยู่ {fmtTokens(supply.treasury)} GE6 และกระเป๋าแจกจ่าย {supply.distributorWallets} กระเป๋าที่รับโทเคนจากกระเป๋าหลัก{" "}
        ถืออยู่ {fmtTokens(supply.distributors)} GE6
      </p>
    </section>
  );
}
