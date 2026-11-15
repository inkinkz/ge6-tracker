'use client';

import { useState } from 'react';
import type { Ge6MemberVoter } from '@/lib/types';
import { fmtDay, fmtNumber, fmtPercent, fmtTokens, fmtWeekday } from '@/lib/format';
import { useSavedWallet } from '@/lib/use-saved-wallet';
import { AreaChart, ColumnChart } from './chart';
import { Section, Segmented, ShareBar, WalletLink } from './ui';

const SIZES = [10, 25, 50] as const;

/** One member's biggest wallets: what each gave her and its share of her total. */
export function MemberTopVoters({ nick, voters, wallets }: { nick: string; voters: Ge6MemberVoter[]; wallets: number }) {
  const [n, setN] = useState<(typeof SIZES)[number]>(10);
  const [myWallet] = useSavedWallet();
  const rows = voters.slice(0, n);
  const shown = rows.reduce((s, v) => s + v.share, 0);
  const max = voters[0]?.share ?? 0;
  const mine = myWallet ? voters.find((v) => v.address === myWallet) : undefined;
  return (
    <Section
      id='voters'
      title={`กระเป๋าที่โหวตให้ ${nick} มากที่สุด`}
      subtitle={`Top ${Math.min(n, voters.length)} รวมกัน ${fmtPercent(shown)} ของยอด ${nick} · จาก ${fmtNumber(wallets)} กระเป๋า`}
    >
      {voters.length > 10 ? (
        <div className='mb-2'>
          <Segmented
            label='จำนวนอันดับที่แสดง'
            value={n}
            onChange={setN}
            options={SIZES.filter((s) => s <= Math.max(10, voters.length)).map((s) => ({ value: s, label: `Top ${s}` }))}
          />
        </div>
      ) : null}
      {mine && mine.rank > n ? (
        <p className='mb-2 rounded-xl bg-data-wash px-4 py-2.5 text-sm'>
          กระเป๋าของคุณอยู่อันดับ <b className='tabular'>#{mine.rank}</b> ของ {nick} · {fmtTokens(mine.tokens)} GE6
        </p>
      ) : null}
      <ol className='divide-y divide-line'>
        {rows.map((v) => {
          const isMine = myWallet === v.address;
          return (
            <li key={v.address} className={`py-3 ${isMine ? '-mx-3 rounded-xl bg-data-wash px-3' : ''}`}>
              <div className='flex items-baseline gap-3'>
                <span className='w-8 shrink-0 text-right text-sm font-semibold text-ink-2 tabular'>#{v.rank}</span>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='flex min-w-0 items-baseline gap-1.5'>
                      <WalletLink address={v.address} highlight={isMine} />
                      {isMine ? <span className='rounded bg-data px-1.5 text-[11px] font-semibold text-white'>ของฉัน</span> : null}
                    </span>
                    <span className='shrink-0 text-[15px] font-semibold tabular'>
                      {fmtTokens(v.tokens)} <span className='text-xs font-normal text-muted'>GE6</span>
                    </span>
                  </div>
                  <div className='mt-2'>
                    <ShareBar value={v.share} max={max} />
                  </div>
                  <div className='mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted tabular'>
                    <span>{fmtPercent(v.share)} ของยอดเธอ</span>
                    <span>
                      {v.memberCount === 1
                        ? 'โหวตให้เธอคนเดียว'
                        : `โหวตรวม ${fmtTokens(v.walletTokens)} ให้ ${fmtNumber(v.memberCount)} คน`}{' '}
                      · อันดับรวม #{fmtNumber(v.walletRank)}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/** Her tokens per day (or cumulative) across the voting period. */
export function MemberDaily({ nick, days, daily, tokens }: { nick: string; days: number[]; daily: number[]; tokens: number }) {
  const [view, setView] = useState<'daily' | 'cumulative'>('daily');
  const cumulative = daily.reduce<number[]>((out, v) => [...out, (out[out.length - 1] ?? 0) + v], []);
  return (
    <>
      <div className='mb-4'>
        <Segmented
          label='มุมมอง'
          value={view}
          onChange={setView}
          options={[
            { value: 'daily', label: 'รายวัน' },
            { value: 'cumulative', label: 'ยอดสะสม' },
          ]}
        />
      </div>
      <div className='pt-6'>
        {view === 'daily' ? (
          <ColumnChart
            values={daily}
            xLabel={(i) => fmtDay(days[i])}
            ariaLabel={`กราฟแท่งโทเคนที่ ${nick} ได้รับรายวัน`}
            tooltip={(i) => (
              <>
                <div className='text-muted'>{fmtWeekday(days[i])}</div>
                <div className='text-sm font-semibold tabular'>{fmtTokens(daily[i])} GE6</div>
                <div className='tabular text-ink-2'>{fmtPercent(tokens > 0 ? daily[i] / tokens : 0)} ของยอดเธอ</div>
              </>
            )}
          />
        ) : (
          <AreaChart
            values={cumulative}
            xLabel={(i) => fmtDay(days[i])}
            ariaLabel={`กราฟยอดสะสมของ ${nick}`}
            tooltip={(i) => (
              <>
                <div className='text-muted'>{fmtWeekday(days[i])}</div>
                <div className='text-sm font-semibold tabular'>สะสม {fmtTokens(cumulative[i])} GE6</div>
                <div className='tabular text-ink-2'>{fmtPercent(tokens > 0 ? cumulative[i] / tokens : 0)} ของยอดสุดท้าย</div>
              </>
            )}
          />
        )}
      </div>
    </>
  );
}
