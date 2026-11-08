"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { fmtCompact, fmtDay, fmtHour } from "@/lib/format";

/** Maps a pointer x-position to the nearest bucket (the crosshair snaps; nobody has to hit a 4px bar). */
export function useSnapIndex(n: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const update = (clientX: number) => {
    const el = ref.current;
    if (!el || n === 0) return;
    const r = el.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left) / r.width) * n);
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const handlers = {
    onPointerMove: (e: PointerEvent) => update(e.clientX),
    onPointerDown: (e: PointerEvent) => update(e.clientX),
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === "mouse") setActive(null);
    },
  };
  return { ref, active, setActive, handlers };
}

export function ChartTooltip({ index, n, children }: { index: number; n: number; children: ReactNode }) {
  const pct = ((index + 0.5) / n) * 100;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 w-max max-w-[230px] -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: `clamp(90px, ${pct}%, calc(100% - 90px))` }}
    >
      {children}
    </div>
  );
}

/** Horizontal gridlines with labels in the left gutter. `min` below 0 makes a diverging axis (labels show magnitude). */
export function YGrid({ ticks, max, min = 0 }: { ticks: number[]; max: number; min?: number }) {
  const span = max - min || 1;
  return (
    <>
      {ticks.map((v) => (
        <div
          key={v}
          className={`pointer-events-none absolute inset-x-0 border-t ${v === 0 && min < 0 ? "border-axis" : "border-grid"}`}
          style={{ bottom: `${((v - min) / span) * 100}%` }}
        >
          <span className="absolute right-full mr-1.5 -translate-y-1/2 text-[11px] leading-none whitespace-nowrap text-muted tabular">
            {fmtCompact(Math.abs(v))}
          </span>
        </div>
      ))}
    </>
  );
}

export function XLabels({ points, hourly = false }: { points: { t: number }[]; hourly?: boolean }) {
  const n = points.length;
  const idx = n <= 4 ? points.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];
  return (
    <div className="relative mt-1.5 h-4 text-[11px] text-muted" aria-hidden>
      {idx.map((i, k) => (
        <span
          key={i}
          className="absolute whitespace-nowrap tabular"
          style={{
            left: `${((i + 0.5) / n) * 100}%`,
            transform: k === 0 ? "translateX(-25%)" : k === idx.length - 1 ? "translateX(-75%)" : "translateX(-50%)",
          }}
        >
          {hourly ? fmtHour(points[i].t) : fmtDay(points[i].t)}
        </span>
      ))}
    </div>
  );
}

/** Small color key used in legends and next to figures; the hairline keeps pale fills visible. */
export function Swatch({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-sm ring-1 ring-line ring-inset ${className}`} />;
}
