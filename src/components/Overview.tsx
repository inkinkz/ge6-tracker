import type { StatsSnapshot, WindowStats } from "@/lib/types";
import { fmtDateTime, fmtNumber, fmtTokens } from "@/lib/format";
import { AnimatedNumber } from "./AnimatedNumber";
import { AddressLink, TxLink } from "./ui";

function Delta({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-good-text">
      <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
        <path d="M5 1.5 9 8H1z" fill="currentColor" />
      </svg>
      {children}
    </span>
  );
}

function Tile({ label, value, unit, note }: { label: string; value: React.ReactNode; unit?: string; note?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="text-[13px] leading-snug text-ink-2">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight sm:text-[28px]">{value}</span>
        {unit ? <span className="text-sm text-muted">{unit}</span> : null}
      </div>
      {note ? <div className="mt-1.5 text-xs leading-relaxed text-muted">{note}</div> : null}
    </div>
  );
}

function WindowColumn({ title, w }: { title: string; w: WindowStats }) {
  const rows: [string, string][] = [
    ["โทเคน GE6", fmtTokens(w.tokens)],
    ["จำนวนครั้งที่โหวต", fmtNumber(w.votes)],
    ["กระเป๋าที่ร่วมโหวต", fmtNumber(w.activeVoters)],
    ["กระเป๋าใหม่", fmtNumber(w.newVoters)],
  ];
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 py-2.5">
            <dt className="text-ink-2">{k}</dt>
            <dd className="tabular font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Overview({ data }: { data: StatsSnapshot }) {
  const { totals, last24h, last1h } = data;
  const largest = totals.largestVote;
  return (
    <div id="overview" className="space-y-4 sm:space-y-5">
      <section aria-label="ยอดโหวตรวม" className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <p className="text-sm text-ink-2">โทเคน GE6 ที่ถูกใช้โหวตแล้วทั้งหมด</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[44px] leading-none font-bold tracking-tight sm:text-6xl">
            <AnimatedNumber value={totals.tokens} format={(n) => fmtNumber(n, 2)} />
          </span>
          <span className="text-lg font-medium text-muted">GE6</span>
        </p>
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          <Delta>+{fmtTokens(last24h.tokens)} ใน 24 ชม.</Delta>
          <Delta>+{fmtTokens(last1h.tokens)} ในชั่วโมงล่าสุด</Delta>
        </p>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label="กระเป๋าที่โหวตแล้ว"
          value={<AnimatedNumber value={totals.voters} format={(n) => fmtNumber(Math.round(n), 0)} />}
          unit="กระเป๋า"
          note={<>+{fmtNumber(last24h.newVoters)} ใหม่ใน 24 ชม.</>}
        />
        <Tile
          label="จำนวนครั้งที่โหวต"
          value={<AnimatedNumber value={totals.votes} format={(n) => fmtNumber(Math.round(n), 0)} />}
          unit="ครั้ง"
          note={<>+{fmtNumber(last24h.votes)} ใน 24 ชม.</>}
        />
        <Tile
          label="เฉลี่ยต่อกระเป๋า"
          value={fmtNumber(totals.avgPerVoter, 1)}
          unit="GE6"
          note={<>มัธยฐาน {fmtNumber(totals.medianPerVoter, 2)} GE6</>}
        />
        <Tile label="เฉลี่ยต่อครั้ง" value={fmtNumber(totals.avgPerVote, 2)} unit="GE6" note="ต่อ 1 ธุรกรรมโหวต" />
      </div>

      <section aria-label="ช่วงเวลาล่าสุด" className="grid gap-6 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 sm:gap-8 sm:p-6">
        <WindowColumn title="ชั่วโมงล่าสุด" w={last1h} />
        <WindowColumn title="24 ชั่วโมงล่าสุด" w={last24h} />
      </section>

      {largest ? (
        <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">โหวตครั้งใหญ่ที่สุด</span>{" "}
          <TxLink hash={largest.tx}>
            <span className="tabular font-semibold">{fmtTokens(largest.tokens)} GE6</span>
          </TxLink>{" "}
          จากกระเป๋า <AddressLink address={largest.voter} /> เมื่อ {fmtDateTime(largest.at)}
        </p>
      ) : null}
    </div>
  );
}
