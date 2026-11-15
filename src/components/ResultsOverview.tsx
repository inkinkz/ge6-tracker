import type { Ge6Results } from '@/lib/types';
import { fmtDateTime, fmtNumber, fmtPercent, fmtTokens } from '@/lib/format';
import { Swatch } from './chart';
import { MemberLink, Tile } from './ui';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Headline totals, the top 3, and the BNK48 / CGM48 split. */
export function ResultsOverview({ data }: { data: Ge6Results }) {
  const { totals, groups, members } = data;
  const podium = members.slice(0, 3);
  const [bnk, cgm] = groups;

  return (
    <div id='overview' className='space-y-4 sm:space-y-5'>
      <section aria-label='ยอดโหวตรวม' className='rounded-2xl border border-line bg-surface p-5 sm:p-7'>
        <p className='text-sm text-ink-2'>โทเคน GE6 ที่ใช้โหวตทั้งหมด (ผลอย่างเป็นทางการ)</p>
        <p className='mt-2 flex flex-wrap items-baseline gap-x-2'>
          <span className='text-[44px] leading-none font-bold tracking-tight tabular sm:text-6xl'>
            {fmtNumber(totals.tokens, 2)}
          </span>
          <span className='text-lg font-medium text-muted'>GE6</span>
        </p>
        <p className='mt-3 text-sm leading-relaxed text-ink-2'>
          โหวตครั้งแรก {fmtDateTime(data.firstVoteAt)} น. · ปิดโหวต {fmtDateTime(data.closeAt)} น. ·{' '}
          {fmtNumber(Math.round((data.closeAt - data.firstVoteAt) / 86400))} วัน
        </p>

        <ol className='mt-6 grid gap-3 sm:grid-cols-3'>
          {podium.map((m, i) => (
            <li key={m.slug} className='rounded-xl bg-surface-2 px-4 py-3.5'>
              <div className='flex items-center gap-2 text-sm'>
                <span aria-hidden className='text-lg leading-none'>
                  {MEDALS[i]}
                </span>
                <span className='sr-only'>อันดับ {m.rank}</span>
                <MemberLink name={m.name} slug={m.slug} className='text-base' />
              </div>
              <div className='mt-1.5 text-xl font-semibold tabular'>
                {fmtTokens(m.tokens)} <span className='text-sm font-normal text-muted'>GE6</span>
              </div>
              <div className='text-xs text-muted tabular'>
                {fmtPercent(m.share)} ของทั้งหมด · {fmtNumber(m.wallets)} กระเป๋า
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <Tile label='กระเป๋าที่โหวต' value={fmtNumber(totals.wallets)} unit='กระเป๋า' note={`${fmtNumber(totals.singleMemberWallets)} กระเป๋าโหวตให้เมมเบอร์คนเดียว`} />
        <Tile label='จำนวนครั้งที่โหวต' value={fmtNumber(totals.votes)} unit='ครั้ง' note={`เฉลี่ย ${fmtNumber(totals.avgPerVote, 2)} GE6 ต่อครั้ง · มัธยฐาน ${fmtNumber(totals.medianPerVote, 2)}`} />
        <Tile label='เมมเบอร์ที่ได้รับโหวต' value={fmtNumber(totals.members)} unit='คน' note={`BNK48 ${bnk.members} · CGM48 ${cgm.members}`} />
        <Tile label='เฉลี่ยต่อกระเป๋า' value={fmtNumber(totals.avgPerWallet, 1)} unit='GE6' note={`มัธยฐาน ${fmtNumber(totals.medianPerWallet, 2)} GE6`} />
      </div>

      <section aria-labelledby='groups-title' className='rounded-2xl border border-line bg-surface p-5 sm:p-6'>
        <h2 id='groups-title' className='text-base font-semibold'>
          BNK48 กับ CGM48
        </h2>
        <div
          role='img'
          aria-label={groups.map((g) => `${g.group} ${fmtTokens(g.tokens)} GE6 (${fmtPercent(g.share)})`).join(', ')}
          className='mt-4 flex gap-0.5'
        >
          {groups.map((g) => (
            <div key={g.group} className='min-w-1' style={{ flex: `${g.tokens} 1 0%` }}>
              <div className={`h-3 rounded-full ${g.group === 'CGM48' ? 'bg-cgm' : 'bg-bnk'}`} />
            </div>
          ))}
        </div>
        <dl className='mt-4 grid grid-cols-2 gap-x-4 gap-y-4'>
          {groups.map((g) => (
            <div key={g.group} className='min-w-0'>
              <dt className='flex items-center gap-1.5 text-[13px] text-ink-2'>
                <Swatch className={g.group === 'CGM48' ? 'bg-cgm' : 'bg-bnk'} />
                {g.group} · {g.members} คน
              </dt>
              <dd className='mt-1 text-xl font-semibold tabular sm:text-2xl'>
                {fmtTokens(g.tokens)} <span className='text-sm font-normal text-muted'>GE6</span>
              </dd>
              <dd className='text-xs leading-relaxed text-muted tabular'>
                {fmtPercent(g.share)} ของยอด · {fmtNumber(g.wallets)} กระเป๋า · เฉลี่ย {fmtTokens(g.tokens / g.members)} ต่อคน
              </dd>
            </div>
          ))}
        </dl>
        <p className='mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted'>
          {fmtNumber(totals.bothGroups)} กระเป๋า ({fmtPercent(totals.bothGroups / totals.wallets)}) โหวตให้ทั้งเมมเบอร์ BNK48 และ CGM48
        </p>
      </section>
    </div>
  );
}
