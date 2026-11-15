'use client';

import { useMemo, useState } from 'react';
import type { Ge6MemberSummary } from '@/lib/types';
import { fmtNumber, fmtPercent, fmtTokens } from '@/lib/format';
import { MemberLink, Section, Segmented, ShareBar, WalletLink } from './ui';

type Sort = 'rank' | 'tokens' | 'share';

/** Each member's biggest wallet: how much it gave her and how much of her total that is. */
export function TopVoterPerMember({ members }: { members: Ge6MemberSummary[] }) {
  const [sort, setSort] = useState<Sort>('rank');

  // How many members each wallet is the #1 voter for.
  const topOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) map.set(m.topVoter.address, (map.get(m.topVoter.address) ?? 0) + 1);
    return map;
  }, [members]);

  const rows = useMemo(() => {
    const out = [...members];
    if (sort === 'tokens') out.sort((a, b) => b.topVoter.tokens - a.topVoter.tokens || a.rank - b.rank);
    if (sort === 'share') out.sort((a, b) => b.topVoter.share - a.topVoter.share || a.rank - b.rank);
    return out;
  }, [members, sort]);

  const overHalf = members.filter((m) => m.topVoter.share > 0.5).length;
  const multi = [...topOf.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  const maxTokens = Math.max(...members.map((m) => m.topVoter.tokens));

  return (
    <Section
      id='top-voter'
      title='กระเป๋าอันดับ 1 ของแต่ละเมมเบอร์'
      subtitle={`กระเป๋าที่โหวตให้แต่ละคนมากที่สุด · ${overHalf} จาก ${members.length} คนได้ยอดเกินครึ่งจากกระเป๋าเดียว`}
    >
      <div className='mb-4'>
        <Segmented
          label='เรียงตาม'
          value={sort}
          onChange={setSort}
          options={[
            { value: 'rank', label: 'อันดับเมมเบอร์' },
            { value: 'tokens', label: 'ยอดของกระเป๋า' },
            { value: 'share', label: 'สัดส่วนจากยอดเธอ' },
          ]}
        />
      </div>

      {multi.length ? (
        <p className='mb-4 rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2'>
          {multi.slice(0, 3).map(([address, n], i) => (
            <span key={address}>
              {i ? ' · ' : ''}
              <WalletLink address={address} /> เป็นอันดับ 1 ของ <b className='text-ink tabular'>{n} คน</b>
            </span>
          ))}
          {multi.length > 3 ? ` · และอีก ${multi.length - 3} กระเป๋าที่เป็นอันดับ 1 มากกว่า 1 คน` : ''}
        </p>
      ) : null}

      <div className='max-h-[34rem] overflow-y-auto pr-1'>
        <table className='w-full text-left text-sm'>
          <caption className='sr-only'>กระเป๋าที่โหวตให้แต่ละเมมเบอร์มากที่สุด</caption>
          <thead className='sticky top-0 z-10 bg-surface text-xs text-ink-2'>
            <tr>
              <th scope='col' className='py-2 pr-2 font-medium'>
                เมมเบอร์
              </th>
              <th scope='col' className='py-2 pr-2 font-medium'>
                กระเป๋าอันดับ 1
              </th>
              <th scope='col' className='py-2 text-right font-medium'>
                GE6 ที่ให้
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-line'>
            {rows.map((m) => (
              <tr key={m.slug} className='align-top'>
                <td className='py-2.5 pr-2'>
                  <div className='flex items-baseline gap-1.5'>
                    <span className='w-7 shrink-0 text-xs text-muted tabular'>#{m.rank}</span>
                    <MemberLink name={m.name} slug={m.slug} />
                  </div>
                </td>
                <td className='py-2.5 pr-2'>
                  <WalletLink address={m.topVoter.address} />
                  <div className='text-xs text-muted tabular'>
                    อันดับรวม #{fmtNumber(m.topVoter.rank)} · โหวต {fmtNumber(m.topVoter.memberCount)} คน
                  </div>
                </td>
                <td className='py-2.5 text-right'>
                  <div className='font-semibold tabular'>{fmtTokens(m.topVoter.tokens)}</div>
                  <div className='text-xs text-muted tabular'>{fmtPercent(m.topVoter.share)} ของยอดเธอ</div>
                  <div className='mt-1 ml-auto w-20'>
                    <ShareBar
                      value={sort === 'tokens' ? m.topVoter.tokens : m.topVoter.share}
                      max={sort === 'tokens' ? maxTokens : 1}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className='mt-4 text-xs leading-relaxed text-muted'>
        แถบ = สัดส่วนจากยอดของเมมเบอร์คนนั้น (เรียงตามยอดของกระเป๋า: เทียบกับกระเป๋าที่ให้มากที่สุด) · แตะที่อยู่กระเป๋าเพื่อดูว่าโหวตให้ใครบ้าง
      </p>
    </Section>
  );
}
