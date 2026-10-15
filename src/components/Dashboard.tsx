'use client';

import Image from 'next/image';
import type { StatsSnapshot } from '@/lib/types';
import { explorerTransfersUrl } from '@/lib/config';
import { fmtNumber } from '@/lib/format';
import { useLiveStats } from '@/lib/use-live-stats';
import { useSavedWallet } from '@/lib/use-saved-wallet';
import { ActivityChart } from './ActivityChart';
import { Distribution } from './Distribution';
import { Header, SectionNav } from './Header';
import { Overview } from './Overview';
import { RecentVotes } from './RecentVotes';
import { TopVoters } from './TopVoters';
import { WalletLookup } from './WalletLookup';

function Skeleton({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <div className='space-y-5' aria-busy={!failed}>
      <div className='rounded-2xl border border-line bg-surface p-5'>
        {failed ? (
          <div className='text-sm'>
            <p className='font-medium'>ยังดึงข้อมูลจากบล็อกเชนไม่ได้</p>
            <p className='mt-1 text-ink-2'>
              อาจเป็นเพราะ Token X Scan ขัดข้องชั่วคราว ระบบจะลองใหม่อัตโนมัติ
            </p>
            <button
              type='button'
              onClick={onRetry}
              className='mt-3 min-h-10 rounded-xl bg-data px-4 font-semibold text-white'
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : (
          <div className='animate-pulse space-y-3'>
            <div className='h-4 w-48 rounded bg-surface-2' />
            <div className='h-12 w-64 rounded bg-surface-2' />
            <div className='h-4 w-40 rounded bg-surface-2' />
          </div>
        )}
      </div>
      <div className='grid grid-cols-2 gap-4'>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className='h-24 animate-pulse rounded-2xl border border-line bg-surface' />
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ initial }: { initial: StatsSnapshot | null }) {
  const { data, status, refreshing, refresh, pollSeconds } = useLiveStats(initial);
  const [myWallet] = useSavedWallet();

  return (
    <>
      <Header
        status={status}
        updatedAt={data?.updatedAt ?? null}
        refreshing={refreshing}
        onRefresh={refresh}
      />
      <main className='mx-auto max-w-5xl px-5 pt-7 pb-14 sm:pt-10'>
        <div className='mb-7 space-y-5 sm:mb-9'>
          <div className='grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-8'>
            <div className='space-y-2.5'>
              <h1 className='text-[22px] leading-snug font-bold text-balance sm:text-3xl'>
                ติดตามยอดโหวต BNK48 &amp; CGM48 General Election ครั้งที่ 6
              </h1>
              <p className='text-[15px] leading-relaxed text-ink-2'>
                นับจากโทเคน GE6 ที่ส่งเข้ากระเป๋าโหวตบนบล็อกเชน Token X แบบเรียลไทม์ ·{' '}
                <a
                  href={explorerTransfersUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-link underline underline-offset-2'
                >
                  ดูข้อมูลต้นทาง
                </a>
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

        {!data ? (
          <Skeleton failed={status === 'error'} onRetry={refresh} />
        ) : (
          <div className='space-y-5 sm:space-y-6'>
            {data.integrity.missingVotes > 0 ? (
              <p
                role='status'
                className='rounded-xl border border-warning/50 bg-warning/10 px-4 py-2.5 text-sm'
              >
                ⚠️ ขาดข้อมูลโหวต {fmtNumber(data.integrity.missingVotes)} รายการจาก Token X Scan
                ระบบกำลังดึงซ้ำอัตโนมัติ ตัวเลขอาจต่ำกว่าความจริงเล็กน้อย
              </p>
            ) : null}
            <Overview data={data} />
            <ActivityChart daily={data.daily} hourly={data.hourly} />
            <div className='grid items-start gap-5 sm:gap-6 lg:grid-cols-2'>
              <TopVoters data={data} myWallet={myWallet} />
              <RecentVotes votes={data.recent} myWallet={myWallet} pollSeconds={pollSeconds} />
              <WalletLookup />
              <Distribution data={data} />
            </div>
            {/* <About data={data} pollSeconds={pollSeconds} /> */}
          </div>
        )}

        <footer className='mt-12 space-y-1.5 text-center text-xs leading-relaxed text-muted'>
          <p>
            เว็บไซต์นี้จัดทำโดยแฟนคลับเพื่อความสะดวกในการติดตาม ไม่ใช่ช่องทางทางการของ BNK48 / CGM48
            หรือผู้จัดงาน
          </p>
          <p>ข้อมูลทั้งหมดอ่านจากบล็อกเชนสาธารณะ Token X ผ่าน Token X Scan</p>
        </footer>
      </main>
    </>
  );
}
