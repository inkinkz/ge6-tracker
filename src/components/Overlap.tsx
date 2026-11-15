import type { Ge6Results } from '@/lib/types';
import { fmtNumber, fmtPercent } from '@/lib/format';
import { memberSlug } from '@/lib/slug';
import { BucketTable, bucketHeadline } from './Distribution';
import { MemberLink, Section, ShareBar } from './ui';

/** How many members each wallet voted for, and which members share the most wallets. */
export function Overlap({ data }: { data: Ge6Results }) {
  const { membersPerWallet, pairs, totals } = data;
  const maxPair = Math.max(...pairs.map((p) => p.wallets), 0);
  return (
    <div className='grid items-start gap-5 sm:gap-6 lg:grid-cols-2'>
      <Section
        id='overlap'
        title='แต่ละกระเป๋าโหวตให้กี่คน'
        subtitle={`${fmtPercent(totals.singleMemberWallets / totals.wallets)} ของกระเป๋าโหวตให้เมมเบอร์คนเดียว และให้ ${fmtPercent(membersPerWallet[0].share)} ของยอดทั้งหมด`}
      >
        <BucketTable buckets={membersPerWallet} firstCol='โหวตให้' unit='' />
      </Section>

      <Section
        id='pairs'
        title='คู่เมมเบอร์ที่แฟนโหวตให้ด้วยกันบ่อยที่สุด'
        subtitle='นับกระเป๋าที่โหวตให้ทั้งสองคน · % = สัดส่วนจากฐานแฟนของคนที่มีกระเป๋าน้อยกว่า'
      >
        <ol className='divide-y divide-line'>
          {pairs.map((p, i) => (
            <li key={`${p.a}|${p.b}`} className='py-3'>
              <div className='flex items-baseline justify-between gap-3 text-sm'>
                <span className='flex min-w-0 flex-wrap items-baseline gap-x-1.5'>
                  <span className='w-5 shrink-0 text-xs text-muted tabular'>{i + 1}.</span>
                  <MemberLink name={p.a} slug={memberSlug(p.a)} />
                  <span className='text-muted'>+</span>
                  <MemberLink name={p.b} slug={memberSlug(p.b)} />
                </span>
                <span className='shrink-0 tabular'>
                  <span className='font-semibold'>{fmtNumber(p.wallets)}</span>{' '}
                  <span className='text-xs text-muted'>กระเป๋า · {fmtPercent(p.overlap)}</span>
                </span>
              </div>
              <div className='mt-1.5 pl-6'>
                <ShareBar value={p.wallets} max={maxPair} />
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

export function WalletSizes({ data }: { data: Ge6Results }) {
  return (
    <Section
      id='distribution'
      title='กระเป๋าแบ่งตามยอดโหวตรวม'
      subtitle={bucketHeadline(data.walletSize, (label) => `โหวตรวม ${label} GE6`)}
    >
      <BucketTable buckets={data.walletSize} firstCol='ยอดรวมต่อกระเป๋า' />
    </Section>
  );
}
