"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Ge5Comparison, Ge5Row } from "@/lib/types";
import { fmtDateTime, fmtNumber, fmtPercent, fmtTokens } from "@/lib/format";
import { useSavedWallet } from "@/lib/use-saved-wallet";
import { BrandHeader } from "./Header";
import { SiteFooter } from "./SiteFooter";
import { ThemeToggle } from "./ThemeToggle";
import { AddressLink, Section, Segmented } from "./ui";

type Sort = "ge5" | "ge6";
type Filter = "all" | "voted" | "not-voted";

const PAGE_SIZE = 25;
/** rank | wallet | GE5 | GE6 — shared by the header row and every wallet row. */
const COLUMNS = "grid grid-cols-[2.5rem_minmax(0,1fr)_4.25rem_4.25rem] gap-x-2";

/** "Nenie CGM48" → name + group, so the group can be de-emphasized. */
function MemberName({ name }: { name: string }) {
  const i = name.lastIndexOf(" ");
  const nick = i > 0 ? name.slice(0, i) : name;
  const group = i > 0 ? name.slice(i + 1) : "";
  return (
    <span>
      <span className="font-semibold text-ink">{nick}</span>
      {group ? <span className="ml-1 text-xs font-normal text-muted">{group}</span> : null}
    </span>
  );
}

function Tile({ label, value, unit, note }: { label: string; value: React.ReactNode; unit?: string; note?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="text-[13px] leading-snug text-ink-2">{label}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-1">
        <span className="text-2xl font-semibold tracking-tight sm:text-[28px]">{value}</span>
        {unit ? <span className="text-sm text-muted">{unit}</span> : null}
      </div>
      {note ? <div className="mt-1.5 text-xs leading-relaxed text-muted">{note}</div> : null}
    </div>
  );
}

/** Column header that doubles as the sort control. */
function SortHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`เรียงตามยอด ${label}`}
      className={`-my-1 inline-flex min-h-9 items-center justify-end gap-0.5 rounded-lg text-right ${
        active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"
      }`}
    >
      {label}
      <span aria-hidden className={active ? "" : "opacity-30"}>
        ↓
      </span>
    </button>
  );
}

function WalletRow({ row, mine }: { row: Ge5Row; mine: boolean }) {
  const pick = row.members[0];
  const pickShare = row.tokens > 0 ? pick.tokens / row.tokens : 0;
  const ge6Tokens = row.ge6?.tokens ?? 0;
  return (
    <li className={`${COLUMNS} items-baseline gap-y-1.5 py-3.5 ${mine ? "-mx-3 rounded-xl bg-data-wash px-3" : ""}`}>
      <span className="text-right text-sm font-semibold text-ink-2 tabular">#{row.rank}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <AddressLink address={row.address} highlight={mine} />
        {mine ? <span className="rounded bg-data px-1.5 text-[11px] font-semibold text-white">ของฉัน</span> : null}
      </span>
      <span className="text-right text-[15px] font-semibold tabular">{fmtTokens(row.tokens)}</span>
      <span className={`text-right text-[15px] tabular ${ge6Tokens > 0 ? "font-semibold" : "text-muted"}`}>
        {fmtTokens(ge6Tokens)}
      </span>

      <div className="col-span-3 col-start-2 text-[13px] leading-relaxed text-ink-2">
        <span className="text-muted">โหวตให้มากที่สุด</span> <MemberName name={pick.name} />{" "}
        <span className="tabular text-muted">
          · {fmtPercent(pickShare)}
          {row.memberCount > 1 ? ` · รวม ${fmtNumber(row.memberCount)} เมมเบอร์` : ""}
        </span>
      </div>

      {row.ge6 ? (
        <div className="col-span-3 col-start-2 text-xs text-muted tabular">
          GE6 อันดับ #{fmtNumber(row.ge6.rank)} · {fmtNumber(row.ge6.votes)} ครั้ง · ล่าสุด {fmtDateTime(row.ge6.lastVoteAt)}
        </div>
      ) : null}

      {row.memberCount > 1 ? (
        <details className="col-span-3 col-start-2 text-[13px]">
          <summary className="cursor-pointer py-0.5 text-link">เมมเบอร์ที่โหวตใน GE5</summary>
          <ul className="mt-1 space-y-1">
            {row.members.map((m) => (
              <li key={m.name} className="flex justify-between gap-2">
                <MemberName name={m.name} />
                <span className="tabular text-ink-2">{fmtTokens(m.tokens)}</span>
              </li>
            ))}
            {row.memberCount > row.members.length ? (
              <li className="text-xs text-muted">และอีก {fmtNumber(row.memberCount - row.members.length)} เมมเบอร์</li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

export function Ge5View({ data }: { data: Ge5Comparison }) {
  const [myWallet] = useSavedWallet();
  const [sort, setSort] = useState<Sort>("ge5");
  const [filter, setFilter] = useState<Filter>("all");
  const [member, setMember] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { ge5, ge6, members } = data;
  const topN = data.rows.length;

  const rows = useMemo(() => {
    let out = data.rows;
    if (member) out = out.filter((r) => r.members[0].name === member);
    if (filter === "voted") out = out.filter((r) => r.ge6);
    if (filter === "not-voted") out = out.filter((r) => !r.ge6);
    if (sort === "ge6") out = [...out].sort((a, b) => (b.ge6?.tokens ?? 0) - (a.ge6?.tokens ?? 0) || a.rank - b.rank);
    return out;
  }, [data.rows, member, filter, sort]);

  const shown = rows.slice(0, limit);
  const sortBy = (s: Sort) => {
    setSort(s);
    setLimit(PAGE_SIZE);
  };

  return (
    <>
      <BrandHeader href="/">
        <Link
          href="/"
          prefetch={false}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-2 hover:text-ink"
        >
          <span aria-hidden>←</span> หน้าหลัก
        </Link>
        <ThemeToggle />
      </BrandHeader>

      <main className="mx-auto max-w-3xl px-5 pt-7 pb-14 sm:pt-10">
        <div className="mb-7 space-y-2.5 sm:mb-9">
          <p className="text-sm font-medium text-data">GE5 → GE6</p>
          <h1 className="text-[22px] leading-snug font-bold text-balance sm:text-3xl">
            Top {fmtNumber(topN)} กระเป๋าจาก GE5 โหวต GE6 ไปแล้วเท่าไร
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-2">
            กระเป๋าที่โหวตมากที่สุด {fmtNumber(topN)} อันดับแรกใน General Election ครั้งที่ 5
            เมมเบอร์ที่แต่ละกระเป๋าโหวตให้มากที่สุด และยอดที่กระเป๋าเดียวกันโหวตใน GE6 แล้ว
          </p>
          <p className="text-xs text-muted">
            {ge6.available && ge6.updatedAt
              ? `ข้อมูล GE6 ณ ${fmtDateTime(ge6.updatedAt / 1000)} น. · หน้านี้อัปเดตทุกไม่กี่นาที`
              : "ตอนนี้ดึงข้อมูล GE6 ไม่ได้ชั่วคราว ยอด GE6 จึงแสดงเป็น 0"}
          </p>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Tile
              label="กลับมาโหวต GE6 แล้ว"
              value={ge6.available ? fmtNumber(ge6.returning) : "–"}
              unit={`/ ${fmtNumber(topN)} กระเป๋า`}
              note={ge6.available ? `${fmtNumber(topN - ge6.returning)} กระเป๋ายังไม่ได้โหวต` : undefined}
            />
            <Tile
              label="ยอด GE6 จากกลุ่มนี้"
              value={ge6.available ? fmtTokens(ge6.topTokens) : "–"}
              unit="GE6"
              note={
                ge6.available && ge6.totalTokens > 0
                  ? `${fmtPercent(ge6.topTokens / ge6.totalTokens)} ของยอด GE6 ตอนนี้`
                  : undefined
              }
            />
          </div>

          <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-ink-2">
            ใน GE6 บนบล็อกเชนบันทึกแค่ “รหัสแฮช” ของแต่ละโหวต จึงยังดูไม่ได้ว่ากระเป๋าเหล่านี้โหวตให้ใครใน GE6
            ตัวเลข GE6 ในหน้านี้จึงเป็นจำนวนโทเคนที่โหวตไปแล้วเท่านั้น
          </p>

          <Section
            id="wallets"
            title={member ? `กระเป๋าที่โหวตให้ ${member} มากที่สุด` : `รายชื่อ Top ${fmtNumber(topN)} ของ GE5`}
            subtitle={`${fmtNumber(rows.length)} กระเป๋า · แตะหัวคอลัมน์ GE5 / GE6 เพื่อเรียงลำดับ`}
          >
            <div className="mb-3">
              <Segmented
                label="สถานะใน GE6"
                value={filter}
                onChange={(v) => {
                  setFilter(v);
                  setLimit(PAGE_SIZE);
                }}
                options={[
                  { value: "all", label: "ทั้งหมด" },
                  { value: "voted", label: "โหวต GE6 แล้ว" },
                  { value: "not-voted", label: "ยังไม่โหวต" },
                ]}
              />
            </div>
            <label className="mb-4 flex items-center gap-2 text-sm text-ink-2">
              <span className="shrink-0">เมมเบอร์</span>
              <select
                value={member ?? ""}
                onChange={(e) => {
                  setMember(e.target.value || null);
                  setLimit(PAGE_SIZE);
                }}
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-page px-3 text-ink"
              >
                <option value="">ทุกเมมเบอร์</option>
                {members.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.wallets})
                  </option>
                ))}
              </select>
            </label>

            <div className={`${COLUMNS} items-center border-b border-line pb-2 text-xs text-ink-2`}>
              <span className="text-right">อันดับ</span>
              <span>กระเป๋า</span>
              <SortHeader label="GE5" active={sort === "ge5"} onClick={() => sortBy("ge5")} />
              <SortHeader label="GE6" active={sort === "ge6"} onClick={() => sortBy("ge6")} />
            </div>

            {shown.length ? (
              <ol className="divide-y divide-line">
                {shown.map((r) => (
                  <WalletRow key={r.address} row={r} mine={myWallet === r.address} />
                ))}
              </ol>
            ) : (
              <p className="py-8 text-center text-sm text-muted">ไม่มีกระเป๋าที่ตรงกับตัวกรองนี้</p>
            )}

            {rows.length > limit ? (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
                className="mt-4 min-h-11 w-full rounded-xl text-sm font-medium text-link ring-1 ring-line hover:bg-surface-2"
              >
                ดูเพิ่ม ({fmtNumber(Math.min(PAGE_SIZE, rows.length - limit))} จาก {fmtNumber(rows.length - limit)} ที่เหลือ)
              </button>
            ) : null}
          </Section>
        </div>

        <SiteFooter>
          <p>
            ข้อมูล GE5 มาจากผลโหวตรายกระเป๋าแยกตามเมมเบอร์ ({fmtNumber(ge5.wallets)} กระเป๋า · {fmtNumber(ge5.members)} เมมเบอร์)
          </p>
        </SiteFooter>
      </main>
    </>
  );
}
