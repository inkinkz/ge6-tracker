'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { WalletHistory } from '@/lib/types';
import { fmtNumber, fmtPercent, fmtTokens, shortAddr } from '@/lib/format';
import { memberSlug } from '@/lib/slug';
import { useSavedWallet } from '@/lib/use-saved-wallet';
import { AddressLink, MemberLink, Section, ShareBar } from './ui';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type Result = { kind: 'ok'; history: WalletHistory } | { kind: 'error'; message: string } | null;

/** GE6 result for any wallet: rank, total and every member it voted for. */
export function WalletLookup({ totalWallets }: { totalWallets: number }) {
  const [saved, save] = useSavedWallet();
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const input = draft ?? saved ?? '';

  async function lookup(raw: string) {
    const address = raw.trim();
    if (!ADDRESS_RE.test(address)) {
      setResult({ kind: 'error', message: 'ที่อยู่กระเป๋าต้องขึ้นต้นด้วย 0x และมีตัวอักษรอีก 40 ตัว' });
      return;
    }
    setLoading(true);
    try {
      // Static data behind a long CDN cache; one request per looked-up wallet.
      const res = await fetch(`/api/history/${address.toLowerCase()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult({ kind: 'ok', history: json as WalletHistory });
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setLoading(false);
    }
  }

  const history = result?.kind === 'ok' ? result.history : null;
  const ge6 = history?.elections.find((e) => e.id === 'ge6')?.votes ?? null;
  const pastCount = history?.elections.filter((e) => e.id !== 'ge6' && e.votes).length ?? 0;
  const isSaved = history && saved === history.address;

  return (
    <Section id='lookup' title='เช็กผลโหวตของกระเป๋า' subtitle='ดูอันดับ ยอดรวม และเมมเบอร์ที่กระเป๋าใดก็ได้โหวตให้ใน GE6'>
      <form
        className='flex gap-2'
        onSubmit={(e) => {
          e.preventDefault();
          lookup(input);
        }}
      >
        <label htmlFor='wallet' className='sr-only'>
          ที่อยู่กระเป๋า
        </label>
        <input
          id='wallet'
          value={input}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='วางที่อยู่กระเป๋า 0x…'
          autoComplete='off'
          autoCapitalize='off'
          autoCorrect='off'
          spellCheck={false}
          className='min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-page px-3 font-mono text-[15px] outline-none placeholder:font-sans placeholder:text-muted focus:border-data focus:ring-2 focus:ring-data/25'
        />
        <button type='submit' disabled={loading} className='min-h-12 shrink-0 rounded-xl bg-data px-5 font-semibold text-white disabled:opacity-60'>
          {loading ? 'กำลังค้น…' : 'ค้นหา'}
        </button>
      </form>

      {!result && !loading ? (
        <div className='mt-5 flex items-center gap-4 rounded-xl bg-surface-2 p-4'>
          <Image src='/images/wallet-placeholder.svg' alt='' width={96} height={72} className='w-24 shrink-0' />
          <p className='text-sm leading-relaxed text-ink-2'>ใส่ที่อยู่กระเป๋าเพื่อดูว่าโหวตให้ใครไปเท่าไร</p>
        </div>
      ) : null}

      {result?.kind === 'error' ? (
        <p role='alert' className='mt-3 text-sm text-critical'>
          {result.message}
        </p>
      ) : null}

      {history ? (
        <div className='mt-5 rounded-xl bg-surface-2 p-5' aria-live='polite'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <AddressLink address={history.address} />
            <button
              type='button'
              onClick={() => save(isSaved ? null : history.address)}
              className='min-h-8 rounded-full px-3 text-xs font-medium ring-1 ring-line hover:bg-surface'
            >
              {isSaved ? '✓ กระเป๋าของฉัน (แตะเพื่อเลิกจำ)' : 'จำเป็นกระเป๋าของฉัน'}
            </button>
          </div>

          {ge6 ? (
            <>
              <div className='mt-4 grid grid-cols-2 gap-4'>
                <div>
                  <div className='text-xs text-ink-2'>อันดับ</div>
                  <div className='text-2xl font-semibold tabular'>#{fmtNumber(ge6.rank)}</div>
                  <div className='text-xs text-muted'>จาก {fmtNumber(totalWallets)} กระเป๋า</div>
                </div>
                <div>
                  <div className='text-xs text-ink-2'>โหวตรวม</div>
                  <div className='text-2xl font-semibold tabular'>
                    {fmtTokens(ge6.tokens)} <span className='text-sm font-normal text-muted'>GE6</span>
                  </div>
                  <div className='text-xs text-muted'>ให้ {fmtNumber(ge6.members.length)} คน</div>
                </div>
              </div>
              <ul className='mt-4 space-y-3'>
                {ge6.members.map((m) => (
                  <li key={m.name}>
                    <div className='flex items-baseline justify-between gap-3 text-sm'>
                      <MemberLink name={m.name} slug={memberSlug(m.name)} />
                      <span className='shrink-0 tabular'>
                        <span className='font-medium'>{fmtTokens(m.tokens)}</span>
                        <span className='ml-1.5 text-xs text-muted'>{fmtPercent(ge6.tokens > 0 ? m.tokens / ge6.tokens : 0)}</span>
                      </span>
                    </div>
                    <div className='mt-1'>
                      <ShareBar value={m.tokens} max={ge6.members[0].tokens} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className='mt-3 text-sm text-ink-2'>กระเป๋า {shortAddr(history.address)} ไม่ได้โหวตใน GE6</p>
          )}

          <Link
            href={`/wallet?address=${history.address}`}
            prefetch={false}
            className='mt-4 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-link underline-offset-2 hover:underline'
          >
            {pastCount ? `ดูประวัติ GE3–GE5 (เคยโหวต ${pastCount} ครั้ง)` : 'ดูประวัติโหวตทั้งหมด'} และโทเคนที่ยังถืออยู่{' '}
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}
    </Section>
  );
}
