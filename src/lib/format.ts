// Thai display helpers. All times are shown in Asia/Bangkok (UTC+7, no DST).
// Dates are formatted by hand: Node and browsers ship different ICU data (e.g. "พฤ." vs "พฤหัส"),
// which would break hydration if we used Intl date formatting during SSR.

const BKK_OFFSET_SEC = 7 * 3600;
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const numberFmt = new Map<number, Intl.NumberFormat>();
export function fmtNumber(n: number, maxFractionDigits = 2): string {
  let f = numberFmt.get(maxFractionDigits);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFractionDigits });
    numberFmt.set(maxFractionDigits, f);
  }
  return f.format(n);
}

/** Token amount: 2 decimals for small values, whole numbers once it's big. */
export const fmtTokens = (n: number) => fmtNumber(n, Math.abs(n) >= 1000 ? 0 : 2);

/** Short axis labels: 2,500 → "2,500", 75,000 → "75K", 1,250,000 → "1.25M". */
export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1e6) return `${fmtNumber(n / 1e6, 2)}M`;
  if (Math.abs(n) >= 1e4) return `${fmtNumber(n / 1e3, 1)}K`;
  return fmtNumber(n, 1);
}

export function fmtPercent(x: number): string {
  const pct = x * 100;
  if (pct > 0 && pct < 0.01) return "<0.01%";
  const digits = pct === 0 ? 0 : pct < 0.1 ? 2 : pct < 10 ? 1 : 0;
  return `${fmtNumber(pct, digits)}%`;
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function bkk(ts: number) {
  const d = new Date((ts + BKK_OFFSET_SEC) * 1000);
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
    weekday: d.getUTCDay(),
    hh: String(d.getUTCHours()).padStart(2, "0"),
    mm: String(d.getUTCMinutes()).padStart(2, "0"),
    ss: String(d.getUTCSeconds()).padStart(2, "0"),
  };
}

/** unix seconds → "15 ต.ค." */
export function fmtDay(ts: number) {
  const d = bkk(ts);
  return `${d.day} ${MONTHS[d.month]}`;
}
/** unix seconds → "พฤ. 15 ต.ค." */
export function fmtWeekday(ts: number) {
  const d = bkk(ts);
  return `${WEEKDAYS[d.weekday]} ${d.day} ${MONTHS[d.month]}`;
}
/** unix seconds → "21:00" */
export function fmtHour(ts: number) {
  const d = bkk(ts);
  return `${d.hh}:${d.mm}`;
}
/** unix seconds → "21:45:07" */
export function fmtTime(ts: number) {
  const d = bkk(ts);
  return `${d.hh}:${d.mm}:${d.ss}`;
}
/** unix seconds → "15 ต.ค. 21:45" */
export const fmtDateTime = (ts: number) => `${fmtDay(ts)} ${fmtHour(ts)}`;

/** "เมื่อสักครู่", "12 วินาทีที่แล้ว", "3 นาทีที่แล้ว", "2 ชั่วโมงที่แล้ว", then a date. */
export function fmtAgo(tsSec: number, nowMs: number): string {
  const diff = Math.max(0, Math.round(nowMs / 1000 - tsSec));
  if (diff < 5) return "เมื่อสักครู่";
  if (diff < 60) return `${diff} วินาทีที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return fmtDateTime(tsSec);
}

/** Round an axis maximum up to a clean 1/2/2.5/5 × 10^n step and return evenly spaced ticks. */
export function niceTicks(max: number, count = 3): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const rough = max / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { max: niceMax, ticks };
}
