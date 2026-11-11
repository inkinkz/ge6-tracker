'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PastWalletResult, WalletHistory, WalletInfo } from '@/lib/types';
import { explorerAddressUrl } from '@/lib/config';
import { fmtDateTime, fmtNumber, fmtPercent, fmtTokens } from '@/lib/format';
import { useSavedWallet } from '@/lib/use-saved-wallet';
import { BrandHeader } from './Header';
import { SiteFooter } from './SiteFooter';
import { ThemeToggle } from './ThemeToggle';
import { MemberName, Section, ShareBar, TxLink } from './ui';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type Holdings = { ge6: number; bnk: number };
/** Each part loads on its own, so one failing upstream doesn't hide the others. */
type Part<T> = { ok: true; data: T } | { ok: false; error: string };
type Loaded = {
  address: string;
  ge6: Part<WalletInfo>;
  holdings: Part<Holdings>;
  history: Part<WalletHistory>;
};

async function getJson<T>(url: string): Promise<Part<T>> {
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง' };
  }
}

async function loadWallet(address: string): Promise<Loaded> {
  const [ge6, holdings, history] = await Promise.all([
    getJson<WalletInfo>(`/api/wallet/${address}`),
    getJson<Holdings>(`/api/balance/${address}`),
    getJson<WalletHistory>(`/api/history/${address}`),
  ]);
  return { address, ge6, holdings, history };
}

export function WalletHistoryView() {
  const router = useRouter();
  const params = useSearchParams();
  const queryRaw = params.get('address')?.trim() ?? '';
  const query = ADDRESS_RE.test(queryRaw) ? queryRaw.toLowerCase() : null;

  const [saved, save] = useSavedWallet();
  const [draft, setDraft] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [retry, setRetry] = useState(0);
  const value = draft ?? (queryRaw || saved || '');

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    loadWallet(query).then((r) => {
      if (!cancelled) setLoaded(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query, retry]);

  const result = query && loaded?.address === query ? loaded : null;
  const loading = Boolean(query) && !result;

  function submit() {
    const address = value.trim();
    if (!ADDRESS_RE.test(address)) {
      setFormError('ที่อยู่กระเป๋าต้องขึ้นต้นด้วย 0x และมีตัวอักษรอีก 40 ตัว');
      return;
    }
    setFormError(null);
    setDraft(null);
    const next = address.toLowerCase();
    if (next === query) setRetry((n) => n + 1);
    else router.replace(`/wallet?address=${next}`, { scroll: false });
  }

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
          <p className='text-sm font-medium text-data'>GE3 · GE4 · GE5 · GE6 · Thai-Japan</p>
          <h1 className='text-[22px] leading-snug font-bold text-balance sm:text-3xl'>
            ประวัติการโหวตของกระเป๋า
          </h1>
          <p className='text-[15px] leading-relaxed text-ink-2'>
            ใส่ที่อยู่กระเป๋าเพื่อดูว่าเคยโหวตให้เมมเบอร์คนไหนเท่าไรใน GE3–GE5 และ Thai-Japan ยอดที่โหวตใน GE6 แล้ว
            และโทเคนที่ยังถืออยู่
          </p>
        </div>

        <form
          className='flex gap-2'
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor='wallet-address' className='sr-only'>
            ที่อยู่กระเป๋า
          </label>
          <input
            id='wallet-address'
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='วางที่อยู่กระเป๋า 0x…'
            autoComplete='off'
            autoCapitalize='off'
            autoCorrect='off'
            spellCheck={false}
            className='min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 font-mono text-[15px] outline-none placeholder:font-sans placeholder:text-muted focus:border-data focus:ring-2 focus:ring-data/25'
          />
          <button
            type='submit'
            disabled={loading}
            className='min-h-12 shrink-0 rounded-xl bg-data px-5 font-semibold text-white disabled:opacity-60'
          >
            {loading ? 'กำลังค้น…' : 'ค้นหา'}
          </button>
        </form>
        {formError ? (
          <p role='alert' className='mt-3 text-sm text-critical'>
            {formError}
          </p>
        ) : null}
        {queryRaw && !query && !formError ? (
          <p role='alert' className='mt-3 text-sm text-critical'>
            ที่อยู่กระเป๋าในลิงก์ไม่ถูกต้อง
          </p>
        ) : null}

        {loading ? <p className='mt-8 text-center text-sm text-muted'>กำลังโหลดข้อมูลกระเป๋า…</p> : null}

        {result ? (
          <div className='mt-6 space-y-4' aria-live='polite'>
            <Summary
              result={result}
              isSaved={saved === result.address}
              onToggleSave={() => save(saved === result.address ? null : result.address)}
            />
            <Ge6Votes part={result.ge6} />
            <PastVotes part={result.history} />
          </div>
        ) : null}

        <SiteFooter>
          <p>ข้อมูล GE3–GE5 และ Thai-Japan มาจากผลโหวตรายกระเป๋าของแต่ละครั้ง · GE6 และยอดคงเหลืออ่านสดจากบล็อกเชน Token X</p>
        </SiteFooter>
      </main>
    </>
  );
}

function Stat({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className='min-w-0'>
      <div className='text-xs text-ink-2'>{label}</div>
      <div className='text-xl font-semibold tabular sm:text-2xl'>
        {value} {unit ? <span className='text-sm font-normal text-muted'>{unit}</span> : null}
      </div>
      {note ? <div className='text-xs text-muted'>{note}</div> : null}
    </div>
  );
}

function Summary({ result, isSaved, onToggleSave }: { result: Loaded; isSaved: boolean; onToggleSave: () => void }) {
  const ge6 = result.ge6.ok ? result.ge6.data : null;
  const holdings = result.holdings.ok ? result.holdings.data : null;
  return (
    <section aria-label='สรุปกระเป๋า' className='rounded-2xl border border-line bg-surface p-4 sm:p-6'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <a
          href={explorerAddressUrl(result.address)}
          target='_blank'
          rel='noopener noreferrer'
          className='min-w-0 font-mono text-[12px] break-all text-link underline-offset-2 hover:underline sm:text-[13px]'
        >
          {result.address}
        </a>
        <button
          type='button'
          onClick={onToggleSave}
          className='min-h-8 rounded-full px-3 text-xs font-medium ring-1 ring-line hover:bg-surface-2'
        >
          {isSaved ? '✓ กระเป๋าของฉัน (แตะเพื่อเลิกจำ)' : 'จำเป็นกระเป๋าของฉัน'}
        </button>
      </div>

      <div className='mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3'>
        <Stat
          label='โหวตใน GE6 แล้ว'
          value={ge6 ? fmtTokens(ge6.tokens) : '–'}
          unit='GE6'
          note={ge6 ? (ge6.found ? `อันดับ #${fmtNumber(ge6.rank ?? 0)} · ${fmtNumber(ge6.votes)} ครั้ง` : 'ยังไม่ได้โหวต') : 'ดึงข้อมูลไม่ได้'}
        />
        <Stat
          label='GE6 ที่ถืออยู่ (ยังไม่โหวต)'
          value={holdings ? fmtTokens(holdings.ge6) : '–'}
          unit='GE6'
          note={holdings ? undefined : 'ดึงยอดคงเหลือไม่ได้'}
        />
        <Stat
          label='BNK ที่ถืออยู่'
          value={holdings ? fmtTokens(holdings.bnk) : '–'}
          unit='BNK'
          note={holdings ? undefined : 'ดึงยอดคงเหลือไม่ได้'}
        />
      </div>
    </section>
  );
}

function Ge6Votes({ part }: { part: Part<WalletInfo> }) {
  return (
    <Section
      id='ge6'
      title='GE6 (กำลังโหวต)'
      subtitle='การโหวต GE6 บนบล็อกเชนเข้ารหัสชื่อเมมเบอร์ไว้จนกว่าจะประกาศผล จึงแสดงได้เฉพาะยอดโทเคน'
    >
      {!part.ok ? (
        <p className='text-sm text-critical'>{part.error}</p>
      ) : !part.data.found ? (
        <p className='text-sm text-ink-2'>ยังไม่พบการโหวต GE6 จากกระเป๋านี้ — หากเพิ่งโหวต รอประมาณ 1 นาทีแล้วลองใหม่</p>
      ) : (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <Stat
              label='อันดับ'
              value={`#${fmtNumber(part.data.rank ?? 0)}`}
              note={`จาก ${fmtNumber(part.data.totalVoters)} กระเป๋า`}
            />
            <Stat
              label='โหวตแล้ว'
              value={fmtTokens(part.data.tokens)}
              unit='GE6'
              note={`${fmtPercent(part.data.share)} ของยอดทั้งหมด`}
            />
          </div>
          <p className='mt-4 text-sm leading-relaxed text-ink-2'>
            โหวต {fmtNumber(part.data.votes)} ครั้ง · ครั้งแรก{' '}
            {part.data.firstVoteAt ? fmtDateTime(part.data.firstVoteAt) : '-'} · ล่าสุด{' '}
            {part.data.lastVoteAt ? fmtDateTime(part.data.lastVoteAt) : '-'}
          </p>
          <details className='mt-2 text-sm'>
            <summary className='cursor-pointer py-1 text-link'>
              รายการโหวต
              {part.data.votes > part.data.recent.length ? ` (${part.data.recent.length} ครั้งล่าสุด)` : ''}
            </summary>
            <ul className='mt-1 divide-y divide-line'>
              {part.data.recent.map((v) => (
                <li key={v.index} className='flex justify-between gap-2 py-1.5'>
                  <TxLink hash={v.tx}>{fmtDateTime(v.at)}</TxLink>
                  <span className='font-medium tabular'>{fmtTokens(v.tokens)} GE6</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </Section>
  );
}

function PastVotes({ part }: { part: Part<WalletHistory> }) {
  if (!part.ok) {
    return (
      <Section id='past' title='GE3–GE5 และ Thai-Japan'>
        <p className='text-sm text-critical'>{part.error}</p>
      </Section>
    );
  }
  // Newest election first.
  const past = [...part.data.elections].reverse();
  const votedIn = past.filter((p) => p.votes);
  const total = votedIn.reduce((s, p) => s + (p.votes?.tokens ?? 0), 0);
  return (
    <>
      <p className='px-1 pt-2 text-sm text-ink-2'>
        {votedIn.length
          ? `เคยโหวต ${votedIn.length} จาก 3 ครั้งที่ผ่านมา รวม ${fmtTokens(total)} โทเคน`
          : 'กระเป๋านี้ไม่ได้โหวตใน GE3–GE5'}
      </p>
      {past.map((p) => (
        <PastElection key={p.id} result={p} />
      ))}
      {part.data.others.map((p) => (
        <PastElection key={p.id} result={p} />
      ))}
    </>
  );
}

function PastElection({ result }: { result: PastWalletResult }) {
  const v = result.votes;
  return (
    <Section
      id={result.id}
      title={result.label}
      subtitle={
        v
          ? `อันดับ #${fmtNumber(v.rank)} จาก ${fmtNumber(result.totalWallets)} กระเป๋า · โหวตให้ ${fmtNumber(v.members.length)} คน`
          : undefined
      }
      action={
        v ? (
          <div className='shrink-0 text-right'>
            <div className='text-xl font-semibold tabular'>{fmtTokens(v.tokens)}</div>
            <div className='text-xs text-muted'>โทเคน</div>
          </div>
        ) : null
      }
    >
      {v ? (
        <ul className='space-y-3'>
          {v.members.map((m) => (
            <li key={m.name}>
              <div className='flex items-baseline justify-between gap-3 text-sm'>
                <MemberName name={m.name} />
                <span className='shrink-0 tabular'>
                  <span className='font-medium'>{fmtTokens(m.tokens)}</span>
                  <span className='ml-1.5 text-xs text-muted'>{fmtPercent(v.tokens > 0 ? m.tokens / v.tokens : 0)}</span>
                </span>
              </div>
              <div className='mt-1'>
                <ShareBar value={m.tokens} max={v.members[0].tokens} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className='text-sm text-muted'>ไม่ได้โหวตใน {result.label}</p>
      )}
    </Section>
  );
}
