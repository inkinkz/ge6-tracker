"use client";

import { useMemo, useState } from "react";
import type { SeriesPoint } from "@/lib/types";
import { fmtDay, fmtHour, fmtNumber, fmtTokens, fmtWeekday, niceTicks } from "@/lib/format";
import { ChartTooltip, XLabels, YGrid, useSnapIndex } from "./chart";
import { Section, Segmented } from "./ui";

type View = "daily" | "hourly" | "cumulative";
type Metric = "tokens" | "votes" | "newVoters";

const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: "tokens", label: "โทเคน", unit: "GE6" },
  { value: "votes", label: "จำนวนครั้ง", unit: "ครั้ง" },
  { value: "newVoters", label: "กระเป๋าใหม่", unit: "กระเป๋า" },
];

const fmtMetric = (m: Metric, v: number) => (m === "tokens" ? fmtTokens(v) : fmtNumber(v));

function bucketLabel(view: View, t: number) {
  return view === "hourly" ? `${fmtDay(t)} ${fmtHour(t)}–${fmtHour(t + 3600)} น.` : fmtWeekday(t);
}

function TooltipBody({ view, p, metric }: { view: View; p: SeriesPoint; metric: Metric | "cumulative" }) {
  return (
    <>
      <div className="text-muted">{bucketLabel(view, p.t)}</div>
      {metric === "cumulative" ? (
        <div className="text-sm font-semibold tabular">ยอดสะสม {fmtTokens(p.cumulativeTokens)} GE6</div>
      ) : (
        <div className="text-sm font-semibold tabular">
          {fmtMetric(metric, p[metric])} {METRICS.find((m) => m.value === metric)!.unit}
        </div>
      )}
      <div className="tabular text-ink-2">
        {metric !== "tokens" && metric !== "cumulative" ? `${fmtTokens(p.tokens)} GE6 · ` : ""}
        {metric === "cumulative" ? `+${fmtTokens(p.tokens)} GE6 · ` : ""}
        {metric !== "votes" ? `${fmtNumber(p.votes)} ครั้ง · ` : ""}
        {metric !== "newVoters" ? `${fmtNumber(p.newVoters)} กระเป๋าใหม่` : `${fmtNumber(p.votes)} ครั้ง`}
      </div>
    </>
  );
}

function Columns({ points, metric, view }: { points: SeriesPoint[]; metric: Metric; view: View }) {
  const n = points.length;
  const { max, ticks } = niceTicks(Math.max(...points.map((p) => p[metric]), 0));
  const { ref, active, handlers } = useSnapIndex(n);
  return (
    <div className="pl-11">
      <div
        ref={ref}
        {...handlers}
        className="relative h-48 touch-pan-y select-none sm:h-60"
        role="img"
        aria-label={`กราฟแท่ง ${METRICS.find((m) => m.value === metric)!.label} ${view === "hourly" ? "รายชั่วโมง" : "รายวัน"}`}
      >
        <YGrid ticks={ticks} max={max} />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {points.map((p, i) => {
            const v = p[metric];
            return (
              <div key={p.t} className="flex h-full min-w-0 flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-6 rounded-t-[4px] bg-data transition-opacity ${active !== null && active !== i ? "opacity-45" : ""}`}
                  style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                />
              </div>
            );
          })}
        </div>
        {active !== null ? (
          <ChartTooltip index={active} n={n}>
            <TooltipBody view={view} p={points[active]} metric={metric} />
          </ChartTooltip>
        ) : null}
      </div>
      <XLabels points={points} hourly={view === "hourly"} />
    </div>
  );
}

function CumulativeLine({ points }: { points: SeriesPoint[] }) {
  const n = points.length;
  const { max, ticks } = niceTicks(Math.max(...points.map((p) => p.cumulativeTokens), 0));
  const { ref, active, handlers } = useSnapIndex(n);
  const x = (i: number) => (n === 1 ? 50 : ((i + 0.5) / n) * 100);
  const y = (v: number) => 100 - (v / max) * 100;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i) * 10},${y(p.cumulativeTokens)}`).join(" ");
  const area = `${line} L${x(n - 1) * 10},100 L${x(0) * 10},100 Z`;
  const markIndex = active ?? n - 1;
  const mark = points[markIndex];
  return (
    <div className="pl-11">
      <div ref={ref} {...handlers} className="relative h-48 touch-pan-y select-none sm:h-60" role="img" aria-label="กราฟเส้นยอดโทเคนสะสมรายวัน">
        <YGrid ticks={ticks} max={max} />
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <path d={area} fill="var(--data-wash)" />
          <path
            d={line}
            fill="none"
            stroke="var(--data)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {active !== null ? (
          <div className="pointer-events-none absolute inset-y-0 w-px bg-axis" style={{ left: `${x(active)}%` }} />
        ) : null}
        {mark ? (
          <div
            className="pointer-events-none absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-data ring-2 ring-surface"
            style={{ left: `${x(markIndex)}%`, bottom: `${(mark.cumulativeTokens / max) * 100}%` }}
          />
        ) : null}
        {active !== null ? (
          <ChartTooltip index={active} n={n}>
            <TooltipBody view="cumulative" p={points[active]} metric="cumulative" />
          </ChartTooltip>
        ) : null}
      </div>
      <XLabels points={points} />
    </div>
  );
}

function DataTable({ points, view }: { points: SeriesPoint[]; view: View }) {
  const rows = [...points].reverse();
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer py-1 text-link">ดูข้อมูลเป็นตาราง</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-surface-2 text-ink-2">
            <tr>
              <th className="px-2.5 py-2 font-medium">{view === "hourly" ? "ชั่วโมง" : "วัน"}</th>
              <th className="px-2.5 py-2 text-right font-medium">GE6</th>
              <th className="px-2.5 py-2 text-right font-medium">ครั้ง</th>
              <th className="px-2.5 py-2 text-right font-medium">กระเป๋าใหม่</th>
              <th className="px-2.5 py-2 text-right font-medium">ยอดสะสม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular">
            {rows.map((p) => (
              <tr key={p.t}>
                <td className="px-2.5 py-1.5 whitespace-nowrap">{view === "hourly" ? `${fmtDay(p.t)} ${fmtHour(p.t)}` : fmtWeekday(p.t)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtTokens(p.tokens)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtNumber(p.votes)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtNumber(p.newVoters)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtTokens(p.cumulativeTokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function ActivityChart({ daily, hourly }: { daily: SeriesPoint[]; hourly: SeriesPoint[] }) {
  const [view, setView] = useState<View>("daily");
  const [metric, setMetric] = useState<Metric>("tokens");
  const points = view === "hourly" ? hourly : daily;

  const peak = useMemo(() => {
    if (view === "cumulative" || !points.length) return null;
    return points.reduce((best, p) => (p[metric] > best[metric] ? p : best), points[0]);
  }, [points, metric, view]);
  const unit = METRICS.find((m) => m.value === metric)!.unit;

  return (
    <Section
      id="activity"
      title="ความเคลื่อนไหวการโหวต"
      subtitle={
        view === "cumulative"
          ? "ยอดโทเคน GE6 สะสมตั้งแต่เริ่มโหวต (เวลาประเทศไทย)"
          : peak && peak[metric] > 0
            ? `สูงสุด: ${bucketLabel(view, peak.t)} · ${fmtMetric(metric, peak[metric])} ${unit}`
            : "เวลาประเทศไทย"
      }
    >
      <div className="mb-5 flex flex-wrap gap-2.5">
        <Segmented
          label="ช่วงเวลา"
          value={view}
          onChange={setView}
          options={[
            { value: "daily", label: "รายวัน" },
            { value: "hourly", label: "48 ชม." },
            { value: "cumulative", label: "ยอดสะสม" },
          ]}
        />
        {view !== "cumulative" ? (
          <Segmented label="ข้อมูลที่แสดง" value={metric} onChange={setMetric} options={METRICS} />
        ) : null}
      </div>

      <div className="pt-6">
        {view === "cumulative" ? (
          <CumulativeLine points={daily} />
        ) : (
          <Columns key={view} points={points} metric={metric} view={view} />
        )}
      </div>
      <p className="mt-3 text-xs text-muted">แตะหรือเลื่อนนิ้วบนกราฟเพื่อดูตัวเลขแต่ละช่วง</p>
      <DataTable points={points} view={view === "hourly" ? "hourly" : "daily"} />
    </Section>
  );
}
