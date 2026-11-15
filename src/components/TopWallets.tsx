'use client';

import { useState } from 'react';
import type { Ge6Results } from '@/lib/types';
import { fmtNumber, fmtPercent, fmtTokens } from '@/lib/format';
import { memberSlug } from '@/lib/slug';
import { useSavedWallet } from '@/lib/use-saved-wallet';
import { MemberLink, Section, Segmented, ShareBar, WalletLink } from './ui';

const SIZES = [10, 25, 50, 100] as const;

/** The biggest wallets, now with who they voted for. */
export function TopWallets({ data }: { data: Pick<Ge6Results, 'topWallets' | 'totals'> }) {
  const [n, setN] = useState<(typeof SIZES)[number]>(10);
  const [myWallet] = useSavedWallet();
  const { topWallets, totals } = data;
  const rows = topWallets.slice(0, n);
  const maxShare = topWallets[0]?.share ?? 0;
  const topNShare = rows.reduce((acc, v) => acc + v.share, 0);
  const returning = rows.filter((r) => r.ge5).length;

  return (
    <Section
      id='top'
      title={`Top ${n} กระเป๋าที่โหวตมากที่สุด`}
      subtitle={`รวมกัน ${fmtPercent(topNShare)} ของยอดทั้งหมด · ${returning} จาก ${rows.length} กระเป๋าเคยโหวตใน GE5`}
    >
      <p className='mb-5 rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2'>
        แค่ <b className='text-ink tabular'>{fmtNumber(totals.walletsForHalf)} กระเป๋า</b> แรกก็โหวตรวมกันเกินครึ่งของยอดทั้งหมด · Top 10 ={' '}
        <b className='text-ink tabular'>{fmtPercent(totals.top10Share)}</b> · Top 100 ={' '}
        <b className='text-ink tabular'>{fmtPercent(totals.top100Share)}</b>
      </p>

      <div className='mb-2'>
        <Segmented
          label='จำนวนอันดับที่แสดง'
          value={n}
          onChange={setN}
          options={SIZES.map((s) => ({ value: s, label: `Top ${s}` }))}
        />
      </div>

      <ol className='divide-y divide-line'>
        {rows.map((v) => {
          const mine = myWallet === v.address;
          return (
            <li key={v.address} className={`py-3.5 ${mine ? '-mx-3 rounded-xl bg-data-wash px-3' : ''}`}>
              <div className='flex items-baseline gap-3'>
                <span className='w-8 shrink-0 text-right text-sm font-semibold text-ink-2 tabular'>#{v.rank}</span>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='flex min-w-0 items-baseline gap-1.5'>
                      <WalletLink address={v.address} highlight={mine} />
                      {mine ? <span className='rounded bg-data px-1.5 text-[11px] font-semibold text-white'>ของฉัน</span> : null}
                    </span>
                    <span className='shrink-0 text-[15px] font-semibold tabular'>
                      {fmtTokens(v.tokens)} <span className='text-xs font-normal text-muted'>GE6</span>
                    </span>
                  </div>
                  <div className='mt-2'>
                    <ShareBar value={v.share} max={maxShare} />
                  </div>
                  <div className='mt-1.5 text-xs text-muted tabular'>
                    {fmtPercent(v.share)} · {fmtNumber(v.votes)} ครั้ง · โหวตให้ {fmtNumber(v.memberCount)} คน
                    {v.ge5 ? '' : ' · ไม่ได้โหวต GE5'}
                  </div>
                  <ul className='mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]'>
                    {v.members.map((m) => (
                      <li key={m.name} className='inline-flex items-baseline gap-1'>
                        <MemberLink name={m.name} slug={memberSlug(m.name)} />
                        <span className='text-xs text-ink-2 tabular'>{fmtTokens(m.tokens)}</span>
                      </li>
                    ))}
                    {v.memberCount > v.members.length ? (
                      <li className='text-xs text-muted'>+ อีก {v.memberCount - v.members.length} คน</li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className='mt-4 text-xs leading-relaxed text-muted'>
        จากทั้งหมด {fmtNumber(totals.wallets)} กระเป๋า · แตะที่อยู่กระเป๋าเพื่อดูว่าโหวตให้ใครบ้างใน GE3–GE6
      </p>
    </Section>
  );
}
