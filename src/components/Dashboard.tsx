import Image from 'next/image';
import type { Ge6Results, SupplySnapshot, TokenFlow } from '@/lib/types';
import { fmtDateTime, fmtNumber, fmtTokens } from '@/lib/format';
import { Distributors } from './Distributors';
import { FromGe5 } from './FromGe5';
import { Header, SectionNav } from './Header';
import { Highlights } from './Highlights';
import { MemberRanking } from './MemberRanking';
import { Overlap, WalletSizes } from './Overlap';
import { ResultsOverview } from './ResultsOverview';
import { SiteFooter } from './SiteFooter';
import { TokenJourney } from './TokenJourney';
import { TokenTimeline } from './TokenTimeline';
import { TopVoterPerMember } from './TopVoterPerMember';
import { TopWallets } from './TopWallets';
import { VoteTimeline } from './VoteTimeline';
import { WalletLookup } from './WalletLookup';

/** The final GE6 results: fully static, prerendered at build time, no polling. */
export function Dashboard({ data, supply, flow }: { data: Ge6Results; supply: SupplySnapshot; flow: TokenFlow }) {
  const onChainExtra = Math.round((supply.voted - data.totals.tokens) * 100) / 100;
  return (
    <>
      <Header />
      <main className='mx-auto max-w-5xl px-4 pt-7 pb-14 sm:pt-10'>
        <div className='mb-7 space-y-5 sm:mb-9'>
          <div className='grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-8'>
            <div className='space-y-2.5'>
              <p className='text-sm font-medium text-data'>ปิดโหวตแล้ว · ผลอย่างเป็นทางการ</p>
              <h1 className='text-[22px] leading-snug font-bold text-balance sm:text-3xl'>
                ผลโหวต BNK48 &amp; CGM48 General Election ครั้งที่ 6
              </h1>
              <p className='text-[15px] leading-relaxed text-ink-2'>
                สถิติทั้งหมดจากไฟล์ผลโหวตรายกระเป๋า: ใครได้เท่าไร กระเป๋าไหนโหวตให้ใคร และแฟนโหวตกันตอนไหน
              </p>
            </div>
            <Image
              src='/images/election-placeholder.svg'
              alt=''
              width={360}
              height={240}
              loading='eager'
              className='mx-auto h-28 w-auto sm:h-auto sm:w-full'
            />
          </div>
          <SectionNav />
        </div>

        <div className='space-y-5 sm:space-y-6'>
          <ResultsOverview data={data} />
          <MemberRanking members={data.members} />
          <TopVoterPerMember members={data.members} />
          <Highlights data={data} />
          <TopWallets data={{ topWallets: data.topWallets, totals: data.totals }} />
          <VoteTimeline data={{ daily: data.daily, finalHours: data.finalHours, hourOfDay: data.hourOfDay, totals: data.totals }} />
          <Overlap data={data} />
          <FromGe5 data={data} />
          <div className='grid items-start gap-5 sm:gap-6 lg:grid-cols-2'>
            <WalletSizes data={data} />
            <WalletLookup totalWallets={data.totals.wallets} />
          </div>
          <TokenJourney supply={supply} />
          <TokenTimeline daily={flow.daily} />
          <Distributors flow={flow} />
        </div>

        <SiteFooter>
          <p>
            ผลโหวต GE6 จากไฟล์ผลโหวตรายกระเป๋าอย่างเป็นทางการ ({fmtNumber(data.totals.votes)} รายการ) · โหวตครั้งสุดท้าย{' '}
            {fmtDateTime(data.lastVoteAt)} น.
          </p>
          <p>
            เส้นทางโทเคนอ่านจากบล็อกเชน ณ ตอนปิดโหวต
            {onChainExtra > 0 ? ` · สัญญาโหวตบนบล็อกเชนมีโทเคนมากกว่าไฟล์ผล ${fmtTokens(onChainExtra)} GE6` : ''}
          </p>
        </SiteFooter>
      </main>
    </>
  );
}
