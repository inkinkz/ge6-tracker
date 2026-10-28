'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { GeCompare, GeEditionStats, GeMemberHistory, GeWalletRow } from '@/lib/types';
import { explorerAddressUrl } from '@/lib/config';
import { fmtCompact, fmtDateTime, fmtNumber, fmtPercent, fmtTokens } from '@/lib/format';
import { useSavedWallet } from '@/lib/use-saved-wallet';
import { BrandHeader } from './Header';
import { SiteFooter } from './SiteFooter';
import { ThemeToggle } from './ThemeToggle';
import { MemberName, Section, Segmented, ShareBar } from './ui';

type MemberSort = 'ge5' | 'ge4' | 'ge3';
const MEMBER_PAGE = 20;
// Newest election first everywhere on this page.
const PAST_IDS = ['ge5', 'ge4', 'ge3'] as const;

/** Short token amounts for narrow cells: 3,667 → "3.7K", 277,696 → "277.7K". */
const fmtK = (n: number) =>
  n >= 1e6 ? `${fmtNumber(n / 1e6, 2)}M` : n >= 1e3 ? `${fmtNumber(n / 1e3, 1)}K` : fmtNumber(n, 0);

/** label + one column per election; shared by the header and every metric row. */
const COLS = 'grid grid-cols-4 gap-2';

type Metric = {
  label: string;
  value: (e: GeEditionStats) => number | null;
  format: (n: number) => string;
};

const METRICS: Metric[] = [
  { label: 'โทเคนที่ใช้โหวต', value: (e) => e.tokens, format: fmtCompact },
  { label: 'กระเป๋าที่โหวต', value: (e) => e.wallets, format: (n) => fmtNumber(n) },
  { label: 'จำนวนครั้งที่โหวต', value: (e) => e.votes, format: fmtCompact },
  { label: 'เฉลี่ยต่อกระเป๋า', value: (e) => e.avgPerWallet, format: (n) => fmtNumber(n, 1) },
  {
    label: 'ค่ากลาง (มัธยฐาน) ต่อกระเป๋า',
    value: (e) => e.medianPerWallet,
    format: (n) => fmtNumber(n, 1),
  },
  { label: 'สัดส่วนของ Top 10 กระเป๋า', value: (e) => e.top10Share, format: fmtPercent },
  {
    label: 'กระเป๋าแรกที่รวมกันได้ครึ่งหนึ่งของยอด',
    value: (e) => e.walletsForHalf,
    format: (n) => fmtNumber(n),
  },
  { label: 'เมมเบอร์ที่ได้รับโหวต', value: (e) => e.members, format: (n) => fmtNumber(n) },
];

function EditionHeader({ editions }: { editions: GeEditionStats[] }) {
  return (
    <div className={`${COLS} border-b border-line pb-2 text-center`}>
      {editions.map((e) => (
        <div key={e.id}>
          <div className='text-sm font-semibold'>{e.label}</div>
          <div className='text-[11px] text-muted'>{e.live ? 'ตอนนี้' : 'ผลจริง'}</div>
        </div>
      ))}
    </div>
  );
}

function MetricRow({ metric, editions }: { metric: Metric; editions: GeEditionStats[] }) {
  const values = editions.map((e) => metric.value(e));
  const max = Math.max(...values.map((v) => v ?? 0), 0);
  return (
    <div className='py-3.5'>
      <div className='mb-2 text-[13px] text-ink-2'>{metric.label}</div>
      <div className={COLS}>
        {values.map((v, i) => (
          <div key={editions[i].id} className='min-w-0 text-center'>
            <div className={`text-[15px] tabular ${v === null ? 'text-muted' : 'font-semibold'}`}>
              {v === null ? '–' : metric.format(v)}
            </div>
            {v !== null ? (
              <div className='mt-1.5'>
                <ShareBar value={v} max={max} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview({ data }: { data: GeCompare }) {
  const editions = [...data.editions].reverse();
  return (
    <Section
      id='overview'
      title='ภาพรวมแต่ละครั้ง'
      subtitle='แถบใต้ตัวเลขเทียบกันในแถวเดียวกัน · GE6 ยังโหวตอยู่ จึงเป็นยอด ณ ตอนนี้'
    >
      <EditionHeader editions={editions} />
      <div className='divide-y divide-line'>
        {METRICS.map((m) => (
          <MetricRow key={m.label} metric={m} editions={editions} />
        ))}
        <div className='py-3.5'>
          <div className='mb-2 text-[13px] text-ink-2'>เมมเบอร์อันดับ 1 (ตามยอดโทเคน)</div>
          <div className={COLS}>
            {editions.map((e) => (
              <div key={e.id} className='min-w-0 text-center'>
                <div
                  className={`truncate text-[15px] ${e.topMember ? 'font-semibold' : 'text-muted'}`}
                >
                  {e.topMember?.name ?? '–'}
                </div>
                {e.topMember ? (
                  <div className='text-[11px] text-muted tabular'>{fmtK(e.topMember.tokens)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className='mt-3 text-xs leading-relaxed text-muted'>
        GE5 ไม่มีข้อมูลรายครั้ง · ผลรายเมมเบอร์ของ GE6 จะรู้หลังประกาศผล
      </p>
    </Section>
  );
}

type WalletSort = 'ge6' | 'ge5' | 'ge4' | 'ge3';
type WalletFilter = 'all' | 'ge6' | 'no-ge6' | 'every';
const WALLET_COLS: WalletSort[] = ['ge6', 'ge5', 'ge4', 'ge3'];
const WALLET_PAGE = 25;
/** GE6 | GE5 | GE4 | GE3 | expand chevron — shared by the header and every wallet row. */
const WALLET_GRID = 'grid grid-cols-[repeat(4,minmax(0,1fr))_1rem] gap-2';
const tokensIn = (r: GeWalletRow, id: WalletSort) => r[id]?.tokens ?? 0;

/** Column header that doubles as the sort control. */
function ColumnSort({
  id,
  active,
  onClick,
}: {
  id: WalletSort;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      aria-label={`เรียงตามยอด ${id.toUpperCase()}`}
      className={`-my-1 inline-flex min-h-9 items-center justify-center gap-0.5 rounded-lg ${
        active ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink'
      }`}
    >
      {id.toUpperCase()}
      <span aria-hidden className={active ? '' : 'opacity-30'}>
        ↓
      </span>
    </button>
  );
}

type Holdings = { ge6: number; bnk: number };
const Amount = ({ value, unit }: { value: number; unit: string }) => (
  <span className='font-semibold text-ink tabular'>
    {fmtTokens(value)} <span className='text-xs font-normal text-muted'>{unit}</span>
  </span>
);

/** GE6 (not yet voted) and BNK tokens the wallet holds now, fetched when the row is first opened. */
function Holdings({ address }: { address: string }) {
  const [state, setState] = useState<Holdings | 'loading' | 'error'>('loading');
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/balance/${address}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: Holdings) => !cancelled && setState({ ge6: json.ge6, bnk: json.bnk }))
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [address]);
  return (
    <div>
      <span className='mr-2 text-xs text-muted'>ในกระเป๋าตอนนี้</span>
      {state === 'loading' ? (
        <span className='text-muted'>กำลังโหลด…</span>
      ) : state === 'error' ? (
        <span className='text-muted'>ดึงข้อมูลไม่ได้</span>
      ) : (
        <>
          <Amount value={state.ge6} unit='GE6' />
          <span className='mx-1.5 text-muted'>·</span>
          <Amount value={state.bnk} unit='BNK' />
        </>
      )}
    </div>
  );
}

function WalletDetail({ row, opened }: { row: GeWalletRow; opened: boolean }) {
  return (
    <div className='mb-3.5 space-y-2 rounded-xl bg-surface-2 p-3.5 text-[13px] leading-relaxed'>
      <div>
        <span className='mr-2 text-xs text-muted'>GE6</span>
        <span className='text-ink-2 tabular'>
          {row.ge6
            ? `อันดับ #${fmtNumber(row.ge6.rank)} · ${fmtNumber(row.ge6.votes)} ครั้ง`
            : 'ยังไม่ได้โหวต'}
        </span>
      </div>
      {opened ? <Holdings address={row.address} /> : null}
      {PAST_IDS.map((id) => {
        const r = row[id];
        return (
          <div key={id}>
            <span className='mr-2 text-xs text-muted'>{id.toUpperCase()}</span>
            {r ? (
              <span className='text-ink-2 tabular'>
                อันดับ #{fmtNumber(r.rank)}
                {r.top ? (
                  <>
                    {' · '}
                    <MemberName name={r.top.name} />{' '}
                    <span className='text-xs text-muted'>{fmtPercent(r.top.share)}</span>
                  </>
                ) : null}
              </span>
            ) : (
              <span className='text-muted'>ไม่ได้โหวต</span>
            )}
          </div>
        );
      })}
      <a
        href={explorerAddressUrl(row.address)}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-block pt-1 text-link underline underline-offset-2'
      >
        ดูกระเป๋านี้บน Token X Scan ↗
      </a>
    </div>
  );
}

/** Copy text, with a fallback for browsers without the async Clipboard API (older iOS, http). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  // Off-screen but selectable; 16px avoids iOS zooming into the field.
  el.style.cssText = 'position:fixed;top:0;left:-9999px;font-size:16px;opacity:0';
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  el.remove();
  return ok;
}

/** Full wallet address; tapping copies it (and doesn't expand the row). */
function CopyAddress({ address, mine }: { address: string; mine: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type='button'
      onClick={async (e) => {
        // Inside <summary>: keep the tap from toggling the row.
        e.preventDefault();
        e.stopPropagation();
        setState((await copyText(address)) ? 'copied' : 'failed');
      }}
      aria-label={`คัดลอกที่อยู่กระเป๋า ${address}`}
      className={`group/copy relative -my-1 inline-flex min-w-0 items-center gap-1 rounded-md py-1 text-left font-mono text-[11px] break-all hover:text-ink sm:text-[13px] ${
        mine ? 'font-semibold text-ink' : 'text-ink-2'
      }`}
    >
      <span>{address}</span>
      {/* Same-size icon in every state so the line never reflows; the message floats above. */}
      {state === 'copied' ? (
        <svg viewBox='0 0 16 16' aria-hidden className='size-3 shrink-0 text-good-text'>
          <path d='m3 8.5 3 3 7-7' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        </svg>
      ) : (
        <svg viewBox='0 0 16 16' aria-hidden className='size-3 shrink-0 text-muted group-hover/copy:text-ink'>
          <rect x='5' y='5' width='8.5' height='8.5' rx='1.5' fill='none' stroke='currentColor' strokeWidth='1.3' />
          <path d='M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h6' fill='none' stroke='currentColor' strokeWidth='1.3' strokeLinecap='round' />
        </svg>
      )}
      <span
        role='status'
        className={`pointer-events-none absolute bottom-full left-0 mb-1 rounded-md px-2 py-0.5 font-sans text-[11px] font-semibold whitespace-nowrap shadow-sm transition-opacity ${
          state === 'idle' ? 'opacity-0' : 'opacity-100'
        } ${state === 'failed' ? 'bg-critical text-white' : 'bg-ink text-page'}`}
      >
        {state === 'idle' ? '' : state === 'failed' ? 'คัดลอกไม่ได้' : 'คัดลอกแล้ว'}
      </span>
    </button>
  );
}

/** Every election's top wallets in one list, with GE6 → GE3 amounts side by side. */
function WalletTable({ rows, topN }: { rows: GeWalletRow[]; topN: number }) {
  const [myWallet] = useSavedWallet();
  const [sort, setSort] = useState<WalletSort>('ge6');
  const [filter, setFilter] = useState<WalletFilter>('all');
  const [limit, setLimit] = useState(WALLET_PAGE);
  // Rows opened at least once; their balance stays loaded after collapsing.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());

  const list = useMemo(() => {
    let out = rows;
    if (filter === 'ge6') out = out.filter((r) => r.ge6);
    if (filter === 'no-ge6') out = out.filter((r) => !r.ge6);
    if (filter === 'every') out = out.filter((r) => r.ge6 && r.ge5 && r.ge4 && r.ge3);
    // Sorted column first, then the other elections newest-first as tie-breakers.
    return [...out].sort(
      (a, b) =>
        tokensIn(b, sort) - tokensIn(a, sort) ||
        WALLET_COLS.reduce((d, id) => d || tokensIn(b, id) - tokensIn(a, id), 0) ||
        a.address.localeCompare(b.address),
    );
  }, [rows, sort, filter]);
  const shown = list.slice(0, limit);
  const reset = () => setLimit(WALLET_PAGE);

  return (
    <Section
      id='wallets'
      title='กระเป๋าที่โหวตมากที่สุดในทุกครั้ง'
      subtitle={`รวม Top ${fmtNumber(topN)} ของ GE3–GE6 · ${fmtNumber(list.length)} กระเป๋า`}
    >
      <div className='mb-3'>
        <Segmented
          label='ตัวกรอง'
          value={filter}
          onChange={(v) => {
            setFilter(v);
            reset();
          }}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'ge6', label: 'โหวต GE6 แล้ว' },
            { value: 'no-ge6', label: 'ยังไม่โหวต GE6' },
            { value: 'every', label: 'โหวตครบทุกครั้ง' },
          ]}
        />
      </div>
      <p className='mb-3 text-xs leading-relaxed text-muted'>
        แตะ GE6 / GE5 / GE4 / GE3 เพื่อเรียง ·
        แตะแถวเพื่อดูอันดับและเมมเบอร์ที่โหวตให้มากที่สุดของแต่ละครั้ง
      </p>
      <div className={`${WALLET_GRID} border-b border-line pb-2 text-xs`}>
        {WALLET_COLS.map((id) => (
          <ColumnSort
            key={id}
            id={id}
            active={sort === id}
            onClick={() => {
              setSort(id);
              reset();
            }}
          />
        ))}
        <span aria-hidden />
      </div>

      {shown.length ? (
        <ol className='divide-y divide-line'>
          {shown.map((r, i) => {
            const mine = myWallet === r.address;
            return (
              <li key={r.address} className={mine ? '-mx-3 rounded-xl bg-data-wash px-3' : ''}>
                <details
                  className='group'
                  onToggle={(e) => {
                    if (e.currentTarget.open && !opened.has(r.address)) {
                      setOpened((prev) => new Set(prev).add(r.address));
                    }
                  }}
                >
                  <summary className='cursor-pointer list-none py-3.5 [&::-webkit-details-marker]:hidden'>
                    {/* Full address on its own line; the chevron sits with the amounts to leave room. */}
                    <div className='flex min-w-0 flex-wrap items-center gap-x-1.5'>
                      <span className='text-xs text-muted tabular'>{i + 1}</span>
                      <CopyAddress address={r.address} mine={mine} />
                      {mine ? (
                        <span className='shrink-0 rounded bg-data px-1.5 text-[11px] font-semibold text-white'>
                          ของฉัน
                        </span>
                      ) : null}
                    </div>
                    <div className={`${WALLET_GRID} mt-1.5 items-center`}>
                      {WALLET_COLS.map((id) => {
                        const t = tokensIn(r, id);
                        return (
                          <span
                            key={id}
                            className={`text-center text-[15px] tabular ${
                              t === 0
                                ? 'text-muted'
                                : id === sort
                                  ? 'font-semibold text-ink'
                                  : 'text-ink-2'
                            }`}
                          >
                            {fmtTokens(t)}
                          </span>
                        );
                      })}
                      <svg
                        viewBox='0 0 16 16'
                        aria-hidden
                        className='size-4 shrink-0 text-muted transition-transform group-open:rotate-180'
                      >
                        <path
                          d='m4 6 4 4 4-4'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='1.5'
                          strokeLinecap='round'
                        />
                      </svg>
                    </div>
                  </summary>
                  <WalletDetail row={r} opened={opened.has(r.address)} />
                </details>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className='py-8 text-center text-sm text-muted'>ไม่มีกระเป๋าที่ตรงกับตัวกรองนี้</p>
      )}

      {list.length > limit ? (
        <button
          type='button'
          onClick={() => setLimit((l) => l + WALLET_PAGE)}
          className='mt-4 min-h-11 w-full rounded-xl text-sm font-medium text-link ring-1 ring-line hover:bg-surface-2'
        >
          ดูเพิ่ม ({fmtNumber(Math.min(WALLET_PAGE, list.length - limit))} จาก{' '}
          {fmtNumber(list.length - limit)} ที่เหลือ)
        </button>
      ) : null}
    </Section>
  );
}

function FlowRow({
  title,
  value,
  of,
  live,
  caption,
}: {
  title: string;
  value: number;
  of: number;
  live: boolean;
  caption: string;
}) {
  const share = of > 0 ? value / of : 0;
  return (
    <li className='py-3.5'>
      <div className='flex items-baseline justify-between gap-3'>
        <span className='text-sm font-semibold'>
          {title}
          {live ? <span className='ml-1.5 text-[11px] font-normal text-muted'>ตอนนี้</span> : null}
        </span>
        <span className='shrink-0 text-[15px] font-semibold tabular'>{fmtPercent(share)}</span>
      </div>
      <div className='mt-2'>
        <ShareBar value={share} max={1} />
      </div>
      <div className='mt-1.5 text-xs text-muted tabular'>
        {fmtNumber(value)} จาก {fmtNumber(of)} {caption}
      </div>
    </li>
  );
}

function Returning({ data }: { data: GeCompare }) {
  const flows = [...data.flows].reverse();
  const newWallets = [...data.newWallets].reverse();
  const { loyal } = data;
  return (
    <Section
      id='returning'
      title='กระเป๋าที่กลับมาโหวต'
      subtitle='นับจากที่อยู่กระเป๋าที่ตรงกันในแต่ละครั้ง'
    >
      <h3 className='text-sm font-medium text-ink-2'>โหวตต่อในครั้งถัดไป</h3>
      <ul className='divide-y divide-line'>
        {flows.map((f) => (
          <FlowRow
            key={f.from}
            title={`${f.from} → ${f.to}`}
            value={f.returning}
            of={f.fromWallets}
            live={f.live}
            caption={`กระเป๋าของ ${f.from} กลับมาโหวต ${f.to}`}
          />
        ))}
      </ul>

      <h3 className='mt-5 text-sm font-medium text-ink-2'>กระเป๋าใหม่ (ไม่เคยโหวตตั้งแต่ GE3)</h3>
      <ul className='divide-y divide-line'>
        {newWallets.map((n) => (
          <FlowRow
            key={n.label}
            title={n.label}
            value={n.newWallets}
            of={n.wallets}
            live={n.live}
            caption={`กระเป๋าของ ${n.label} เป็นกระเป๋าใหม่`}
          />
        ))}
      </ul>

      <div className='mt-5 grid grid-cols-2 gap-3'>
        <div className='rounded-xl bg-surface-2 px-3.5 py-3'>
          <div className='text-xs text-ink-2'>โหวตครบ GE3–GE5</div>
          <div className='mt-1 text-xl font-semibold tabular'>
            {fmtNumber(loyal.ge3to5)}{' '}
            <span className='text-sm font-normal text-muted'>กระเป๋า</span>
          </div>
        </div>
        <div className='rounded-xl bg-surface-2 px-3.5 py-3'>
          <div className='text-xs text-ink-2'>โหวตครบ GE3–GE6 (ตอนนี้)</div>
          <div className='mt-1 text-xl font-semibold tabular'>
            {loyal.ge3to6 === null ? '–' : fmtNumber(loyal.ge3to6)}{' '}
            <span className='text-sm font-normal text-muted'>กระเป๋า</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function RankCell({
  result,
  sorted,
}: {
  result: GeMemberHistory['results']['ge3'];
  sorted: boolean;
}) {
  if (!result) return <div className='text-center text-sm text-muted'>–</div>;
  return (
    <div className='text-center'>
      <div className={`text-[15px] tabular ${sorted ? 'font-semibold text-ink' : 'text-ink-2'}`}>
        #{result.rank}
      </div>
      <div className='text-[11px] text-muted tabular'>{fmtK(result.tokens)}</div>
    </div>
  );
}

function Members({ members }: { members: GeMemberHistory[] }) {
  const [sort, setSort] = useState<MemberSort>('ge5');
  const [limit, setLimit] = useState(MEMBER_PAGE);
  const rows = useMemo(() => {
    const others = PAST_IDS.filter((id) => id !== sort);
    const rank = (m: GeMemberHistory, id: (typeof PAST_IDS)[number]) => m.results[id]?.rank ?? 999;
    return [...members].sort(
      (a, b) =>
        rank(a, sort) - rank(b, sort) ||
        rank(a, others[0]) - rank(b, others[0]) ||
        rank(a, others[1]) - rank(b, others[1]) ||
        a.nick.localeCompare(b.nick),
    );
  }, [members, sort]);
  const shown = rows.slice(0, limit);
  const grid = 'grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem] items-center gap-x-2';

  return (
    <Section
      id='members'
      title='อันดับเมมเบอร์ GE3–GE5'
      subtitle='อันดับตามยอดโทเคนที่ได้รับในแต่ละครั้ง · GE6 จะรู้หลังประกาศผล'
    >
      <div className='mb-4'>
        <Segmented
          label='เรียงตามอันดับใน'
          value={sort}
          onChange={(v) => {
            setSort(v);
            setLimit(MEMBER_PAGE);
          }}
          options={[
            { value: 'ge5', label: 'GE5' },
            { value: 'ge4', label: 'GE4' },
            { value: 'ge3', label: 'GE3' },
          ]}
        />
      </div>
      <div className={`${grid} border-b border-line pb-2 text-xs text-ink-2`}>
        <span>เมมเบอร์</span>
        {PAST_IDS.map((id) => (
          <span key={id} className={`text-center ${id === sort ? 'font-semibold text-ink' : ''}`}>
            {id.toUpperCase()}
          </span>
        ))}
      </div>
      <ol className='divide-y divide-line'>
        {shown.map((m) => (
          <li key={m.key} className={`${grid} py-3`}>
            <span className='min-w-0 truncate'>
              <span className='font-semibold'>{m.nick}</span>
              {m.group ? <span className='ml-1 text-xs text-muted'>{m.group}</span> : null}
              {m.groupUnknown ? <span className='ml-1 text-xs text-muted'>(ไม่ระบุวง)</span> : null}
            </span>
            {PAST_IDS.map((id) => (
              <RankCell key={id} result={m.results[id]} sorted={id === sort} />
            ))}
          </li>
        ))}
      </ol>
      {rows.length > limit ? (
        <button
          type='button'
          onClick={() => setLimit((l) => l + MEMBER_PAGE)}
          className='mt-4 min-h-11 w-full rounded-xl text-sm font-medium text-link ring-1 ring-line hover:bg-surface-2'
        >
          ดูเพิ่ม ({fmtNumber(Math.min(MEMBER_PAGE, rows.length - limit))} จาก{' '}
          {fmtNumber(rows.length - limit)} ที่เหลือ)
        </button>
      ) : null}
      <p className='mt-4 text-xs leading-relaxed text-muted'>
        จับคู่เมมเบอร์ข้ามครั้งจากชื่อที่สะกดตรงกัน · GE4 ระบุแค่ชื่อเล่น จึงแยก Pim ของ GE4
        ไว้ต่างหาก
      </p>
    </Section>
  );
}

export function CompareView({ data }: { data: GeCompare }) {
  return (
    <>
      <BrandHeader href='/'>
        <Link
          href='/'
          prefetch={false}
          className='inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-2 hover:text-ink'
        >
          <span aria-hidden>←</span> หน้าหลัก
        </Link>
        <ThemeToggle />
      </BrandHeader>

      <main className='mx-auto max-w-3xl px-4 pt-7 pb-14 sm:pt-10'>
        <div className='mb-7 space-y-2.5 sm:mb-9'>
          <p className='text-sm font-medium text-data'>GE3 · GE4 · GE5 · GE6</p>
          <h1 className='text-[22px] leading-snug font-bold text-balance sm:text-3xl'>
            เทียบ General Election ครั้งที่ 3–6
          </h1>
          <p className='text-[15px] leading-relaxed text-ink-2'>
            ยอดโทเคน จำนวนกระเป๋า กระเป๋าที่กลับมาโหวต และอันดับเมมเบอร์ของแต่ละครั้ง
          </p>
          <p className='text-xs text-muted'>
            {data.ge6Available && data.updatedAt
              ? `ข้อมูล GE6 ณ ${fmtDateTime(data.updatedAt / 1000)} น.`
              : 'ตอนนี้ดึงข้อมูล GE6 ไม่ได้ชั่วคราว จึงแสดงเฉพาะ GE3–GE5'}
          </p>
          <nav aria-label='Top กระเป๋าของแต่ละครั้ง' className='flex flex-wrap gap-2 pt-1'>
            {PAST_IDS.map((id) => (
              <Link
                key={id}
                href={`/${id}`}
                prefetch={false}
                className='inline-flex min-h-10 items-center rounded-full bg-surface px-4 text-sm text-ink-2 ring-1 ring-line hover:text-ink'
              >
                Top {fmtNumber(data.topPerEdition)} จาก {id.toUpperCase()} →
              </Link>
            ))}
          </nav>
        </div>

        <div className='space-y-5 sm:space-y-6'>
          <WalletTable rows={data.wallets} topN={data.topPerEdition} />
          <Overview data={data} />
          <Returning data={data} />
          <Members members={data.members} />
        </div>

        <SiteFooter>
          <p>ข้อมูล GE3–GE5 มาจากผลโหวตรายกระเป๋าของแต่ละครั้ง · GE6 อ่านสดจากบล็อกเชน Token X</p>
        </SiteFooter>
      </main>
    </>
  );
}
