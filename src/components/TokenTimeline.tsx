"use client";

import { useMemo, useState } from "react";
import type { FlowDay } from "@/lib/types";
import { fmtTokens, fmtWeekday, niceTicks } from "@/lib/format";
import { ChartTooltip, Swatch, XLabels, YGrid, useSnapIndex } from "./chart";
import { Section, Segmented } from "./ui";

type View = "cumulative" | "daily";

type Point = FlowDay & { cumDistributed: number; cumVoted: number; inWallets: number };

function useCumulative(daily: FlowDay[]): Point[] {
  return useMemo(() => {
    const out: Point[] = [];
    for (const p of daily) {
      const prev = out[out.length - 1];
      const cumDistributed = (prev?.cumDistributed ?? 0) + p.distributed;
      const cumVoted = (prev?.cumVoted ?? 0) + p.voted;
      out.push({ ...p, cumDistributed, cumVoted, inWallets: Math.max(0, cumDistributed - cumVoted) });
    }
    return out;
  }, [daily]);
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtTokens(Math.abs(n))}`;

/** Voted (bottom) + still in fans' wallets (band above it); the top edge is everything handed out. */
function StackedArea({ points }: { points: Point[] }) {
  const n = points.length;
  const { max, ticks } = niceTicks(Math.max(...points.map((p) => p.cumDistributed), 0));
  const { ref, active, handlers } = useSnapIndex(n);
  const x = (i: number) => (n === 1 ? 50 : ((i + 0.5) / n) * 100);
  const y = (v: number) => 100 - (v / max) * 100;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i) * 10},${y(v)}`).join(" ");
  const votedLine = line(points.map((p) => p.cumVoted));
  const distLine = line(points.map((p) => p.cumDistributed));
  const votedArea = `${votedLine} L${x(n - 1) * 10},100 L${x(0) * 10},100 Z`;
  const back = points
    .map((p, i) => `L${x(i) * 10},${y(p.cumVoted)}`)
    .reverse()
    .join(" ");
  const band = `${distLine} ${back} Z`;
  const markIndex = active ?? n - 1;
  const mark = points[markIndex];

  return (
    <div className="pl-11">
      <div
        ref={ref}
        {...handlers}
        className="relative h-52 touch-pan-y select-none sm:h-64"
        role="img"
        aria-label="กราฟพื้นที่สะสมรายวัน: โทเคนที่แจกให้แฟน แบ่งเป็นโหวตแล้วกับยังอยู่ในกระเป๋าแฟน"
      >
        <YGrid ticks={ticks} max={max} />
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <path d={band} fill="var(--supply-wallet)" />
          <path d={votedArea} fill="var(--data)" />
          {/* 2px surface seam between the two fills */}
          <path d={votedLine} fill="none" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {active !== null ? <div className="pointer-events-none absolute inset-y-0 w-px bg-axis" style={{ left: `${x(active)}%` }} /> : null}
        {mark ? (
          <>
            <div
              className="pointer-events-none absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-supply-wallet ring-2 ring-surface"
              style={{ left: `${x(markIndex)}%`, bottom: `${(mark.cumDistributed / max) * 100}%` }}
            />
            <div
              className="pointer-events-none absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-data ring-2 ring-surface"
              style={{ left: `${x(markIndex)}%`, bottom: `${(mark.cumVoted / max) * 100}%` }}
            />
          </>
        ) : null}
        {active !== null ? (
          <ChartTooltip index={active} n={n}>
            <div className="text-muted">{fmtWeekday(points[active].t)}</div>
            <div className="text-sm font-semibold tabular">แจกแล้ว {fmtTokens(points[active].cumDistributed)} GE6</div>
            <div className="mt-0.5 flex items-center gap-1.5 tabular text-ink-2">
              <Swatch className="bg-data" />
              โหวตแล้ว {fmtTokens(points[active].cumVoted)}
            </div>
            <div className="flex items-center gap-1.5 tabular text-ink-2">
              <Swatch className="bg-supply-wallet" />
              ในกระเป๋าแฟน {fmtTokens(points[active].inWallets)}
            </div>
          </ChartTooltip>
        ) : null}
      </div>
      <XLabels points={points} />
    </div>
  );
}

/**
 * Fans' wallets as a tank: tokens handed out that day rise above the baseline, tokens voted that day
 * drop below it. One shared scale, so a taller bar is always more GE6.
 */
function InOutColumns({ points }: { points: Point[] }) {
  const n = points.length;
  const maxIn = Math.max(...points.map((p) => p.distributed), 0);
  const maxOut = Math.max(...points.map((p) => p.voted), 0);
  const { ticks: base } = niceTicks(Math.max(maxIn, maxOut), 2);
  const step = base[1] ?? 1;
  const top = Math.max(step, Math.ceil(maxIn / step) * step);
  const bottom = Math.max(step, Math.ceil(maxOut / step) * step);
  const ticks: number[] = [];
  for (let v = -bottom; v <= top + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  const span = top + bottom;
  const zero = (bottom / span) * 100;
  const { ref, active, handlers } = useSnapIndex(n);

  return (
    <div className="pl-11">
      <div
        ref={ref}
        {...handlers}
        className="relative h-52 touch-pan-y select-none sm:h-64"
        role="img"
        aria-label="กราฟแท่งรายวัน: โทเคนที่แจกให้แฟน (ด้านบน) และโทเคนที่ใช้โหวต (ด้านล่าง)"
      >
        <YGrid ticks={ticks} max={top} min={-bottom} />
        <div className="absolute inset-0 flex gap-[2px]">
          {points.map((p, i) => {
            const dim = active !== null && active !== i ? "opacity-45" : "";
            return (
              <div key={p.t} className="relative h-full min-w-0 flex-1">
                <div
                  className={`absolute inset-x-0 mx-auto max-w-6 rounded-t-[4px] bg-supply-wallet transition-opacity ${dim}`}
                  style={{ bottom: `${zero}%`, height: `${(p.distributed / span) * 100}%`, minHeight: p.distributed > 0 ? 2 : 0 }}
                />
                <div
                  className={`absolute inset-x-0 mx-auto max-w-6 rounded-b-[4px] bg-data transition-opacity ${dim}`}
                  style={{ top: `${100 - zero}%`, height: `${(p.voted / span) * 100}%`, minHeight: p.voted > 0 ? 2 : 0 }}
                />
              </div>
            );
          })}
        </div>
        {active !== null ? (
          <ChartTooltip index={active} n={n}>
            <div className="text-muted">{fmtWeekday(points[active].t)}</div>
            <div className="text-sm font-semibold tabular">สุทธิ {signed(points[active].distributed - points[active].voted)} GE6</div>
            <div className="mt-0.5 flex items-center gap-1.5 tabular text-ink-2">
              <Swatch className="bg-supply-wallet" />
              แจกเข้า +{fmtTokens(points[active].distributed)}
            </div>
            <div className="flex items-center gap-1.5 tabular text-ink-2">
              <Swatch className="bg-data" />
              โหวตออก −{fmtTokens(points[active].voted)}
            </div>
          </ChartTooltip>
        ) : null}
      </div>
      <XLabels points={points} />
    </div>
  );
}

function DataTable({ points }: { points: Point[] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer py-1 text-link">ดูข้อมูลเป็นตาราง</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-surface-2 text-ink-2">
            <tr>
              <th className="px-2.5 py-2 font-medium">วัน</th>
              <th className="px-2.5 py-2 text-right font-medium">แจกเข้า</th>
              <th className="px-2.5 py-2 text-right font-medium">โหวตออก</th>
              <th className="px-2.5 py-2 text-right font-medium">ในกระเป๋าแฟน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular">
            {[...points].reverse().map((p) => (
              <tr key={p.t}>
                <td className="px-2.5 py-1.5 whitespace-nowrap">{fmtWeekday(p.t)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtTokens(p.distributed)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtTokens(p.voted)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtTokens(p.inWallets)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function TokenTimeline({ daily }: { daily: FlowDay[] }) {
  const [view, setView] = useState<View>("cumulative");
  const points = useCumulative(daily);
  const last = points[points.length - 1];
  const peak = points.reduce<Point | null>((best, p) => (!best || p.inWallets > best.inWallets ? p : best), null);
  const busiest = points.reduce<Point | null>((best, p) => (!best || p.distributed > best.distributed ? p : best), null);
  if (!last) return null;

  return (
    <Section
      id="token-timeline"
      title="แจกให้แฟน vs ใช้โหวต"
      subtitle={
        view === "cumulative"
          ? peak && peak.inWallets > last.inWallets
            ? `โทเคนที่ค้างในกระเป๋าแฟนสูงสุด ${fmtTokens(peak.inWallets)} GE6 เมื่อ ${fmtWeekday(peak.t)} · ตอนนี้ ${fmtTokens(last.inWallets)} GE6`
            : `โทเคนที่แฟนได้รับแล้วแต่ยังไม่โหวต ${fmtTokens(last.inWallets)} GE6 (เวลาประเทศไทย)`
          : busiest && busiest.distributed > 0
            ? `วันที่แจกมากที่สุด: ${fmtWeekday(busiest.t)} · ${fmtTokens(busiest.distributed)} GE6`
            : "เวลาประเทศไทย"
      }
    >
      <div className="mb-4">
        <Segmented
          label="มุมมอง"
          value={view}
          onChange={setView}
          options={[
            { value: "cumulative", label: "ยอดสะสม" },
            { value: "daily", label: "เข้า-ออกรายวัน" },
          ]}
        />
      </div>

      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="คำอธิบายสี">
        {view === "cumulative" ? (
          <>
            <li className="inline-flex items-center gap-1.5">
              <Swatch className="bg-data" />
              โหวตแล้ว <span className="tabular font-medium text-ink">{fmtTokens(last.cumVoted)}</span>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Swatch className="bg-supply-wallet" />
              ยังอยู่ในกระเป๋าแฟน <span className="tabular font-medium text-ink">{fmtTokens(last.inWallets)}</span>
            </li>
            <li className="text-muted">ขอบบน = แจกให้แฟนแล้วทั้งหมด {fmtTokens(last.cumDistributed)}</li>
          </>
        ) : (
          <>
            <li className="inline-flex items-center gap-1.5">
              <Swatch className="bg-supply-wallet" />
              แจกเข้ากระเป๋าแฟน (บน)
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Swatch className="bg-data" />
              ใช้โหวตออกไป (ล่าง)
            </li>
          </>
        )}
      </ul>

      <div className="pt-6">{view === "cumulative" ? <StackedArea points={points} /> : <InOutColumns points={points} />}</div>
      <p className="mt-3 text-xs text-muted">
        นับเฉพาะโทเคนที่ส่งจากกระเป๋าผู้จัดถึงกระเป๋าแฟน การโอนต่อระหว่างแฟนด้วยกันไม่นับซ้ำ · แตะหรือเลื่อนนิ้วบนกราฟเพื่อดูตัวเลขแต่ละวัน
      </p>
      <DataTable points={points} />
    </Section>
  );
}
