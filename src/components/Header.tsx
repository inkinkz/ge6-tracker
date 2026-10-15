"use client";

import { useNow, type LiveStatus } from "@/lib/use-live-stats";

const NAV = [
  { id: "overview", label: "ภาพรวม" },
  { id: "activity", label: "กราฟ" },
  { id: "top", label: "อันดับกระเป๋า" },
  { id: "recent", label: "โหวตล่าสุด" },
  { id: "lookup", label: "เช็กกระเป๋า" },
  { id: "distribution", label: "การกระจายตัว" },
  { id: "about", label: "เกี่ยวกับข้อมูล" },
];

function agoShort(updatedAt: number, now: number) {
  const s = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (s < 60) return `${s} วิ.ที่แล้ว`;
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
}

function LivePill({
  status,
  updatedAt,
  refreshing,
  onRefresh,
}: {
  status: LiveStatus;
  updatedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const now = useNow(1000);
  const dot =
    status === "live" ? "bg-good live-pulse" : status === "error" ? "bg-critical" : status === "paused" ? "bg-warning" : "bg-axis";
  const label =
    status === "live"
      ? "อัปเดตสด"
      : status === "paused"
        ? "หยุดอัปเดตชั่วคราว"
        : status === "error"
          ? "เชื่อมต่อไม่ได้"
          : "กำลังเชื่อมต่อ";
  const hint =
    status === "paused" ? "แตะเพื่ออัปเดตต่อ" : status === "error" ? "แตะเพื่อลองใหม่" : updatedAt && now ? agoShort(updatedAt, now) : "";

  return (
    <button
      type="button"
      onClick={onRefresh}
      aria-label={`${label} ${hint} — แตะเพื่อรีเฟรชข้อมูล`}
      className="flex min-h-10 shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pr-4 pl-3.5 text-xs sm:text-sm"
    >
      <span className={`size-2 rounded-full ${dot} ${refreshing ? "opacity-40" : ""}`} aria-hidden />
      <span className="flex flex-col items-start gap-0.5 leading-tight sm:flex-row sm:items-center sm:gap-1.5">
        <span className="font-semibold text-ink">{label}</span>
        {hint ? <span className="tabular text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}

/** Slim sticky bar: brand + live status only, so it doesn't eat the top of a phone screen. */
export function Header(props: {
  status: LiveStatus;
  updatedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md supports-[backdrop-filter]:bg-page/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <a href="#overview" className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-data text-sm font-bold tracking-tight text-white"
          >
            GE6
          </span>
          <span className="min-w-0 leading-snug">
            <span className="block truncate text-[15px] font-semibold">GE6 Vote Tracker</span>
            <span className="block truncate text-xs text-muted">BNK48 &amp; CGM48 Election 6</span>
          </span>
        </a>
        <LivePill {...props} />
      </div>
    </header>
  );
}

/** Jump links. Scrolls horizontally on phones; the faded edges hint that there is more. */
export function SectionNav() {
  return (
    <nav aria-label="ไปยังส่วนต่างๆ" className="-mx-5 sm:mx-0">
      <ul className="no-scrollbar flex gap-2.5 overflow-x-auto px-5 py-1 [mask-image:linear-gradient(to_right,transparent,#000_20px,#000_calc(100%-28px),transparent)] sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {NAV.map((n) => (
          <li key={n.id} className="shrink-0">
            <a
              href={`#${n.id}`}
              className="inline-flex min-h-10 items-center rounded-full bg-surface px-4 text-sm whitespace-nowrap text-ink-2 ring-1 ring-line hover:text-ink"
            >
              {n.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
