import type { SizeBucket } from '@/lib/types';
import { fmtNumber, fmtPercent, fmtTokens } from '@/lib/format';
import { ShareBar } from './ui';

/** Buckets of wallets: how many wallets fall in each, and their share of the tokens. */
export function BucketTable({ buckets, firstCol, unit = 'GE6' }: { buckets: SizeBucket[]; firstCol: string; unit?: string }) {
  const wallets = buckets.reduce((s, b) => s + b.wallets, 0);
  const walletShare = (n: number) => (wallets ? n / wallets : 0);
  const maxWalletShare = Math.max(...buckets.map((b) => walletShare(b.wallets)), 0);
  const maxTokenShare = Math.max(...buckets.map((b) => b.share), 0);
  return (
    <>
      <div className='mb-1 grid grid-cols-[minmax(0,7.5rem)_1fr_1fr] gap-4 text-xs font-medium text-ink-2'>
        <span>{firstCol}</span>
        <span>จำนวนกระเป๋า</span>
        <span>สัดส่วนโทเคน</span>
      </div>
      <ul className='divide-y divide-line'>
        {buckets.map((b) => (
          <li key={b.label} className='grid grid-cols-[minmax(0,7.5rem)_1fr_1fr] items-center gap-4 py-3.5 text-sm'>
            <span className='font-medium'>
              {b.label} {unit ? <span className='text-xs font-normal text-muted'>{unit}</span> : null}
            </span>
            <span>
              <span className='block tabular'>
                {fmtNumber(b.wallets)} <span className='text-xs text-muted'>({fmtPercent(walletShare(b.wallets))})</span>
              </span>
              <span className='mt-1.5 block'>
                <ShareBar value={walletShare(b.wallets)} max={maxWalletShare} />
              </span>
            </span>
            <span>
              <span className='block tabular' title={`${fmtTokens(b.tokens)} GE6`}>
                {fmtPercent(b.share)}
              </span>
              <span className='mt-1.5 block'>
                <ShareBar value={b.share} max={maxTokenShare} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className='mt-4 text-xs leading-relaxed text-muted'>แต่ละคอลัมน์ใช้สเกลของตัวเอง แถบที่ยาวที่สุดคือค่าสูงสุดในคอลัมน์นั้น</p>
    </>
  );
}

/** The most common bucket vs how much of the total it actually contributes. */
export function bucketHeadline(buckets: SizeBucket[], what: (label: string) => string) {
  const wallets = buckets.reduce((s, b) => s + b.wallets, 0);
  const common = buckets.reduce((a, b) => (b.wallets > a.wallets ? b : a), buckets[0]);
  if (!common || !wallets) return undefined;
  return `${fmtPercent(common.wallets / wallets)} ของกระเป๋า${what(common.label)} แต่คิดเป็น ${fmtPercent(common.share)} ของยอด`;
}
