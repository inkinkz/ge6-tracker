import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { id: "overview", label: "ภาพรวม" },
  { id: "ranking", label: "ผลอันดับ" },
  { id: "top-voter", label: "กระเป๋าอันดับ 1 ของเมมเบอร์" },
  { id: "highlights", label: "สถิติเด่น" },
  { id: "top", label: "อันดับกระเป๋า" },
  { id: "activity", label: "กราฟเวลาโหวต" },
  { id: "overlap", label: "โหวตกี่คน" },
  { id: "ge5", label: "จาก GE5" },
  { id: "distribution", label: "การกระจายตัว" },
  { id: "tokens", label: "เส้นทางโทเคน" },
  { id: "lookup", label: "เช็กกระเป๋า" },
];

/** Sticky bar with the brand on the left and page-specific controls on the right. */
export function BrandHeader({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md supports-[backdrop-filter]:bg-page/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
        <a href={href} className="flex min-w-0 items-center gap-3">
          {/* Same artwork as app/icon.svg, inlined so the header costs no extra request. */}
          <svg viewBox="0 0 64 64" fill="none" aria-hidden className="size-10 shrink-0 rounded-xl">
            <rect width="64" height="64" rx="16" fill="#2A78D6" />
            <path
              d="M39 17h-6c-8 0-13 7-13 16v3c0 7 5 11 12 11s12-4 12-11-5-11-12-11c-5 0-9 3-12 8"
              stroke="#FFF"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="49" cy="15" r="4" fill="#B9F2C8" />
          </svg>
          <span className="min-w-0 leading-snug">
            <span className="block truncate text-[15px] font-semibold">GE6 Vote Tracker</span>
            <span className="block truncate text-xs text-muted">BNK48 &amp; CGM48 Election 6</span>
          </span>
        </a>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </header>
  );
}

/** Home page header: brand and theme control. */
export function Header() {
  return (
    <BrandHeader href="#overview">
      <ThemeToggle />
    </BrandHeader>
  );
}

/** Jump links. Scrolls horizontally on phones; the faded edges hint that there is more. */
export function SectionNav() {
  return (
    <nav aria-label="ไปยังส่วนต่างๆ" className="-mx-4 sm:mx-0">
      <ul className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 py-1 [mask-image:linear-gradient(to_right,transparent,#000_20px,#000_calc(100%-28px),transparent)] sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        <li className="shrink-0">
          {/* No prefetch: otherwise every home-page visitor would also download these pages. */}
          <Link
            href="/compare"
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-data px-4 text-sm font-semibold whitespace-nowrap text-white hover:opacity-90"
          >
            เทียบ GE3–GE6 <span aria-hidden>→</span>
          </Link>
        </li>
        <li className="shrink-0">
          {/* /ge5 has a switch to /ge3 and /ge4. */}
          <Link
            href="/ge5"
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-data px-4 text-sm font-semibold whitespace-nowrap text-white hover:opacity-90"
          >
            Top 300 จาก GE ก่อนๆ <span aria-hidden>→</span>
          </Link>
        </li>
        <li className="shrink-0">
          <Link
            href="/wallet"
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-data px-4 text-sm font-semibold whitespace-nowrap text-white hover:opacity-90"
          >
            ประวัติโหวตของกระเป๋า <span aria-hidden>→</span>
          </Link>
        </li>
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
