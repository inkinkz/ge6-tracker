import Link from 'next/link';
import type { GeMemberHistory, Ge6MemberDetail } from '@/lib/types';
import { fmtDateTime, fmtNumber, fmtPercent, fmtTokens, fmtWeekday } from '@/lib/format';
import { BucketTable, bucketHeadline } from './Distribution';
import { BrandHeader } from './Header';
import { MemberDaily, MemberTopVoters } from './MemberIslands';
import { SiteFooter } from './SiteFooter';
import { ThemeToggle } from './ThemeToggle';
import { GroupDot, MemberLink, RankChange, Section, ShareBar, Tile, WalletLink } from './ui';

type Neighbor = { name: string; slug: string; rank: number } | null;

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className='flex items-baseline justify-between gap-3 py-2.5'>
      <dt className='text-ink-2'>{label}</dt>
      <dd className='text-right'>
        <span className='font-medium tabular'>{value}</span>
        {note ? <span className='block text-xs text-muted'>{note}</span> : null}
      </dd>
    </div>
  );
}

/** Everything about one member's GE6 result. */
export function MemberView({
  m,
  history,
  days,
  totalMembers,
  totalWallets,
  prev,
  next,
}: {
  m: Ge6MemberDetail;
  history: GeMemberHistory | null;
  days: number[];
  totalMembers: number;
  totalWallets: number;
  prev: Neighbor;
  next: Neighbor;
}) {
  const fans = m.ge5Wallets.fans;
  const multi = m.wallets - m.soleWallets;
  const past = (['ge5', 'ge4', 'ge3'] as const)
    .map((id) => ({ id, label: id.toUpperCase(), r: history?.results[id] ?? null }))
    .filter((p) => p.r);

  return (
    <>
      <BrandHeader href='/'>
        <Link
          href='/#ranking'
          prefetch={false}
          className='inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-2 hover:text-ink'
        >
          <span aria-hidden>←</span> ผลอันดับ
        </Link>
        <ThemeToggle />
      </BrandHeader>

      <main className='mx-auto max-w-3xl px-4 pt-7 pb-14 sm:pt-10'>
        <div className='mb-6 space-y-2'>
          <p className='flex items-center gap-2 text-sm font-medium text-data'>
            <GroupDot group={m.group} /> {m.group ?? ''} · ผล GE6 อันดับ {m.rank} จาก {totalMembers} คน
          </p>
          <h1 className='flex flex-wrap items-baseline gap-x-3 text-3xl leading-tight font-bold sm:text-4xl'>
            {m.nick}
            <RankChange rank={m.rank} prev={m.ge5?.rank ?? null} />
          </h1>
          <p className='text-[15px] leading-relaxed text-ink-2'>
            <span className='text-2xl font-semibold text-ink tabular'>{fmtTokens(m.tokens)}</span> GE6 ·{' '}
            {fmtPercent(m.share)} ของยอดทั้งหมด
          </p>
          {past.length ? (
            <p className='text-sm text-muted'>
              {past.map((p, i) => (
                <span key={p.id}>
                  {i ? ' · ' : ''}
                  {p.label} อันดับ {p.r!.rank} ({fmtTokens(p.r!.tokens)})
                </span>
              ))}
            </p>
          ) : (
            <p className='text-sm text-muted'>ไม่มีชื่อใน GE3–GE5</p>
          )}
        </div>

        <div className='space-y-5'>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            <Tile label='กระเป๋าที่โหวตให้' value={fmtNumber(m.wallets)} note={`${fmtPercent(m.wallets / totalWallets)} ของกระเป๋าทั้งหมด`} />
            <Tile label='จำนวนครั้ง' value={fmtNumber(m.votes)} note={`เฉลี่ย ${fmtTokens(m.tokens / m.votes)} GE6 ต่อครั้ง`} />
            <Tile label='เฉลี่ยต่อกระเป๋า' value={fmtTokens(m.avgPerWallet)} unit='GE6' note={`มัธยฐาน ${fmtNumber(m.medianPerWallet, 2)} GE6`} />
            <Tile
              label='กระเป๋าที่ทำยอดครึ่งหนึ่ง'
              value={fmtNumber(m.walletsForHalf)}
              note={`Top 10 กระเป๋า = ${fmtPercent(m.top10Share)} ของยอด`}
            />
          </div>

          <section aria-labelledby='top1-title' className='rounded-2xl border border-line bg-surface p-5 sm:p-6'>
            <h2 id='top1-title' className='text-sm text-ink-2'>
              กระเป๋าอันดับ 1 ของ {m.nick}
            </h2>
            <div className='mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
              <span className='text-lg'>
                <WalletLink address={m.topVoter.address} />
              </span>
              <span className='text-2xl font-semibold tabular'>
                {fmtTokens(m.topVoter.tokens)} <span className='text-sm font-normal text-muted'>GE6</span>
              </span>
            </div>
            <div className='mt-3'>
              <ShareBar value={m.topVoter.share} label={`${fmtPercent(m.topVoter.share)} ของยอดเธอ`} />
            </div>
            <p className='mt-2 text-xs leading-relaxed text-muted'>
              {fmtPercent(m.topVoter.share)} ของยอด {m.nick} · อันดับรวม #{fmtNumber(m.topVoter.rank)} ของ GE6 ·{' '}
              {m.topVoter.memberCount === 1 ? 'โหวตให้เธอคนเดียว' : `โหวตให้ ${m.topVoter.memberCount} คน`} · โหวตครั้งเดียวมากที่สุด{' '}
              {fmtTokens(m.largestVote.tokens)} GE6 เมื่อ {fmtDateTime(m.largestVote.at)} น.
            </p>
          </section>

          <MemberTopVoters nick={m.nick} voters={m.topVoters} wallets={m.wallets} />

          <Section
            id='timeline'
            title={`${m.nick} ได้รับโหวตเมื่อไร`}
            subtitle={`วันที่ได้มากที่สุด ${fmtWeekday(m.peakDay.t)} · ${fmtTokens(m.peakDay.tokens)} GE6 · ${fmtPercent(m.finalDayShare)} ของยอดเข้ามาใน 24 ชม. สุดท้าย`}
          >
            <MemberDaily nick={m.nick} days={days} daily={m.daily} tokens={m.tokens} />
            <p className='mt-3 text-xs text-muted'>โหวตแรกให้เธอ {fmtDateTime(m.firstVoteAt)} น. · เวลาประเทศไทย</p>
          </Section>

          <Section id='fans' title='ฐานแฟน' subtitle='มาจากกระเป๋าแบบไหน'>
            <dl className='divide-y divide-line text-sm'>
              <Row
                label='โหวตให้เธอคนเดียว'
                value={`${fmtNumber(m.soleWallets)} กระเป๋า`}
                note={`${fmtPercent(m.soleShare)} ของยอดเธอ`}
              />
              <Row label='โหวตให้คนอื่นด้วย' value={`${fmtNumber(multi)} กระเป๋า`} note={`${fmtPercent(1 - m.soleShare)} ของยอดเธอ`} />
              <Row
                label='ไม่ได้โหวต GE5'
                value={`${fmtNumber(m.newWallets)} กระเป๋า`}
                note={`${fmtPercent(m.wallets ? m.newWallets / m.wallets : 0)} ของกระเป๋าที่โหวตให้เธอ`}
              />
              <Row
                label='เคยโหวตให้เธอใน GE5 ด้วย'
                value={`${fmtNumber(m.ge5Wallets.votedHerInGe5)} กระเป๋า`}
              />
              {fans ? (
                <Row
                  label='แฟน GE5 (ให้เธอมากที่สุด) ที่กลับมาโหวตให้เธอ'
                  value={`${fmtNumber(fans.stayed)} จาก ${fmtNumber(fans.fans)}`}
                  note={`${fmtNumber(fans.votedGe6)} กระเป๋ากลับมาโหวต GE6 · ${fmtNumber(fans.stayedTop)} ยังให้เธอมากที่สุด`}
                />
              ) : null}
            </dl>
          </Section>

          {m.alsoVoted.length ? (
            <Section id='also' title={`แฟน ${m.nick} โหวตให้ใครอีก`} subtitle='เมมเบอร์ที่กระเป๋าของเธอโหวตให้ด้วยมากที่สุด (นับกระเป๋า)'>
              <ol className='divide-y divide-line'>
                {m.alsoVoted.map((a) => (
                  <li key={a.slug} className='py-2.5'>
                    <div className='flex items-baseline justify-between gap-3 text-sm'>
                      <MemberLink name={a.name} slug={a.slug} />
                      <span className='shrink-0 tabular'>
                        <span className='font-medium'>{fmtNumber(a.wallets)}</span>{' '}
                        <span className='text-xs text-muted'>
                          กระเป๋า ({fmtPercent(a.wallets / m.wallets)}) · ให้ {fmtTokens(a.tokens)}
                        </span>
                      </span>
                    </div>
                    <div className='mt-1.5'>
                      <ShareBar value={a.wallets} max={m.alsoVoted[0].wallets} />
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          <Section
            id='sizes'
            title={`กระเป๋าแบ่งตามยอดที่ให้ ${m.nick}`}
            subtitle={bucketHeadline(m.walletSize, (label) => `ให้ ${label} GE6`)}
          >
            <BucketTable buckets={m.walletSize} firstCol='ยอดที่ให้เธอ' />
          </Section>

          <nav aria-label='เมมเบอร์ก่อนหน้าและถัดไป' className='grid grid-cols-2 gap-3 text-sm'>
            {prev ? (
              <Link href={`/member/${prev.slug}`} prefetch={false} className='rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2'>
                <span className='text-xs text-muted'>← อันดับ {prev.rank}</span>
                <span className='mt-0.5 block font-semibold'>{prev.name}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/member/${next.slug}`}
                prefetch={false}
                className='rounded-2xl border border-line bg-surface p-4 text-right hover:bg-surface-2'
              >
                <span className='text-xs text-muted'>อันดับ {next.rank} →</span>
                <span className='mt-0.5 block font-semibold'>{next.name}</span>
              </Link>
            ) : null}
          </nav>
        </div>

        <SiteFooter>
          <p>ข้อมูลจากไฟล์ผลโหวต GE6 รายกระเป๋าอย่างเป็นทางการ · GE3–GE5 จากผลโหวตของแต่ละครั้ง (จับคู่ด้วยชื่อเมมเบอร์)</p>
        </SiteFooter>
      </main>
    </>
  );
}
