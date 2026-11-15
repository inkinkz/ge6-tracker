'use client';

import { useMemo, useState } from 'react';
import type { Ge6MemberSummary } from '@/lib/types';
import { fmtNumber, fmtPercent, fmtTokens } from '@/lib/format';
import { MemberLink, RankChange, Section, Segmented, ShareBar, WalletLink } from './ui';

type Group = 'all' | 'BNK48' | 'CGM48';
type Sort = 'tokens' | 'wallets' | 'votes' | 'avg' | 'change';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'tokens', label: 'ยอดโทเคน' },
  { value: 'wallets', label: 'จำนวนกระเป๋า' },
  { value: 'votes', label: 'จำนวนครั้ง' },
  { value: 'avg', label: 'เฉลี่ยต่อกระเป๋า' },
  { value: 'change', label: 'ขึ้นจาก GE5' },
];

const change = (m: Ge6MemberSummary) => (m.ge5 ? m.ge5.rank - m.rank : -Infinity);
const SORT_KEY: Record<Sort, (m: Ge6MemberSummary) => number> = {
  tokens: (m) => m.tokens,
  wallets: (m) => m.wallets,
  votes: (m) => m.votes,
  avg: (m) => m.avgPerWallet,
  change,
};

const INITIAL = 20;

export function MemberRanking({ members }: { members: Ge6MemberSummary[] }) {
  const [group, setGroup] = useState<Group>('all');
  const [sort, setSort] = useState<Sort>('tokens');
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(() => {
    const filtered = group === 'all' ? members : members.filter((m) => m.group === group);
    const key = SORT_KEY[sort];
    return [...filtered].sort((a, b) => key(b) - key(a) || a.rank - b.rank);
  }, [members, group, sort]);
  const rows = showAll ? list : list.slice(0, INITIAL);
  const max = Math.max(...list.map(SORT_KEY[sort === 'change' ? 'tokens' : sort]), 0);
  const groupRank = (m: Ge6MemberSummary) => list.filter((x) => x.tokens > m.tokens).length + 1;

  return (
    <Section
      id='ranking'
      title='ผลอันดับเมมเบอร์ GE6'
      subtitle='อันดับตามยอดโทเคนที่ได้รับ · แตะชื่อเพื่อดูสถิติทั้งหมดของเมมเบอร์คนนั้น'
    >
      <div className='mb-4 flex flex-wrap gap-2.5'>
        <Segmented
          label='วง'
          value={group}
          onChange={setGroup}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'BNK48', label: 'BNK48' },
            { value: 'CGM48', label: 'CGM48' },
          ]}
        />
        <label className='inline-flex items-center gap-2 text-sm text-ink-2'>
          เรียงตาม
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className='min-h-9 rounded-full border border-line bg-surface px-3 text-sm text-ink'
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className='divide-y divide-line'>
        {rows.map((m) => {
          const value = SORT_KEY[sort === 'change' ? 'tokens' : sort](m);
          return (
            <li key={m.slug} className='py-3.5'>
              <div className='flex items-baseline gap-3'>
                <span className='w-8 shrink-0 text-right text-sm font-semibold text-ink-2 tabular'>
                  #{m.rank}
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='flex min-w-0 items-baseline gap-2'>
                      <MemberLink name={m.name} slug={m.slug} />
                      <RankChange rank={m.rank} prev={m.ge5?.rank ?? null} />
                    </span>
                    <span className='shrink-0 text-[15px] font-semibold tabular'>
                      {sort === 'tokens' || sort === 'change' ? (
                        <>
                          {fmtTokens(m.tokens)} <span className='text-xs font-normal text-muted'>GE6</span>
                        </>
                      ) : sort === 'avg' ? (
                        <>
                          {fmtTokens(m.avgPerWallet)} <span className='text-xs font-normal text-muted'>GE6/กระเป๋า</span>
                        </>
                      ) : (
                        <>
                          {fmtNumber(value)}{' '}
                          <span className='text-xs font-normal text-muted'>{sort === 'wallets' ? 'กระเป๋า' : 'ครั้ง'}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className='mt-2'>
                    <ShareBar value={value} max={max} />
                  </div>
                  <div className='mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs text-muted tabular'>
                    <span>
                      {fmtPercent(m.share)} · {fmtNumber(m.wallets)} กระเป๋า · {fmtNumber(m.votes)} ครั้ง
                      {group !== 'all' ? ` · อันดับ ${groupRank(m)} ใน ${group}` : ''}
                    </span>
                    <span className='inline-flex items-baseline gap-1'>
                      อันดับ 1: <WalletLink address={m.topVoter.address} /> ({fmtPercent(m.topVoter.share)})
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {list.length > INITIAL ? (
        <button
          type='button'
          onClick={() => setShowAll((v) => !v)}
          className='mt-3 min-h-10 w-full rounded-xl bg-surface-2 text-sm font-medium text-ink-2 hover:text-ink'
        >
          {showAll ? 'แสดงน้อยลง' : `ดูทั้งหมด ${list.length} คน`}
        </button>
      ) : null}
      <p className='mt-4 text-xs leading-relaxed text-muted'>
        ▲▼ = อันดับที่ขยับจาก GE5 (เทียบชื่อเมมเบอร์ตรงกัน) · อันดับ 1 = กระเป๋าที่โหวตให้เมมเบอร์คนนั้นมากที่สุด
        และสัดส่วนจากยอดของเธอ
      </p>
    </Section>
  );
}
