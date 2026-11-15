import Link from 'next/link';
import type { Ge6MemberSummary, Ge6Results } from '@/lib/types';
import { fmtNumber, fmtPercent, fmtTokens } from '@/lib/format';
import { MemberName, MemberLink, RankChange, Section, Tile } from './ui';

type Moved = { m: Ge6MemberSummary; d: number };

function MoveList({ title, rows }: { title: string; rows: Moved[] }) {
  return (
    <div>
      <h3 className='mb-1 text-sm font-semibold'>{title}</h3>
      <ol className='divide-y divide-line text-sm'>
        {rows.map(({ m }) => (
          <li key={m.slug} className='flex items-baseline justify-between gap-2 py-2'>
            <MemberLink name={m.name} slug={m.slug} />
            <span className='flex shrink-0 items-baseline gap-2 text-xs text-muted tabular'>
              {m.ge5!.rank} → {m.rank} <RankChange rank={m.rank} prev={m.ge5!.rank} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** GE5 → GE6: wallets that came back, members' rank moves, and where departed members' fans went. */
export function FromGe5({ data }: { data: Ge6Results }) {
  const { ge5, members, departed, totals } = data;
  const moved: Moved[] = members.filter((m) => m.ge5).map((m) => ({ m, d: m.ge5!.rank - m.rank }));
  const up = [...moved].sort((a, b) => b.d - a.d || a.m.rank - b.m.rank).slice(0, 5);
  const down = [...moved].sort((a, b) => a.d - b.d || a.m.rank - b.m.rank).slice(0, 5);
  const newcomers = members.filter((m) => !m.ge5);
  const newcomerTokens = newcomers.reduce((s, m) => s + m.tokens, 0);

  return (
    <Section
      id='ge5'
      title='จาก GE5 สู่ GE6'
      subtitle='เทียบกับผลโหวต GE5 รายกระเป๋า · เมมเบอร์จับคู่ด้วยชื่อที่ตรงกัน'
      action={
        <Link href='/compare' prefetch={false} className='shrink-0 text-sm font-medium text-link underline-offset-2 hover:underline'>
          เทียบ GE3–GE6 →
        </Link>
      }
    >
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
        <Tile
          label='กระเป๋า GE5 ที่กลับมาโหวต'
          value={fmtNumber(ge5.returning)}
          note={`${fmtPercent(ge5.returning / ge5.ge5Wallets)} ของ ${fmtNumber(ge5.ge5Wallets)} กระเป๋าใน GE5`}
        />
        <Tile
          label='กระเป๋าที่ไม่ได้โหวต GE5'
          value={fmtNumber(ge5.newWallets)}
          note={`${fmtPercent(ge5.newWallets / totals.wallets)} ของกระเป๋า GE6`}
        />
        <Tile
          label='เมมเบอร์ที่ไม่มีใน GE5'
          value={fmtNumber(newcomers.length)}
          unit='คน'
          note={`ได้รวม ${fmtTokens(newcomerTokens)} GE6 (${fmtPercent(newcomerTokens / totals.tokens)})`}
        />
      </div>

      <div className='mt-6 grid gap-6 sm:grid-cols-2'>
        <MoveList title='อันดับขึ้นมากที่สุด' rows={up} />
        <MoveList title='อันดับลงมากที่สุด' rows={down} />
      </div>

      {departed.length ? (
        <div className='mt-7'>
          <h3 className='text-sm font-semibold'>แฟนของเมมเบอร์ GE5 ที่ไม่ได้อยู่ใน GE6 ไปโหวตให้ใคร</h3>
          <p className='mt-1 text-xs leading-relaxed text-muted'>
            &ldquo;แฟน&rdquo; = กระเป๋าที่โหวตให้เธอมากที่สุดใน GE5 · แสดง 3 คนที่กระเป๋ากลุ่มนี้ให้โทเคนมากที่สุดใน GE6
          </p>
          <ul className='mt-3 divide-y divide-line'>
            {departed.map((d) => (
              <li key={d.name} className='py-3 text-sm'>
                <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5'>
                  <span>
                    <MemberName name={d.name} /> <span className='text-xs text-muted'>GE5 อันดับ {d.ge5Rank}</span>
                  </span>
                  <span className='text-xs text-muted tabular'>
                    กลับมาโหวต {fmtNumber(d.votedGe6)} จาก {fmtNumber(d.fans)} กระเป๋า · {fmtTokens(d.ge6Tokens)} GE6
                  </span>
                </div>
                {d.to.length ? (
                  <div className='mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px]'>
                    <span className='text-xs text-muted'>ไปที่</span>
                    {d.to.map((t) => (
                      <span key={t.name} className='inline-flex items-baseline gap-1'>
                        <MemberLink name={t.name} slug={t.slug} />
                        <span className='text-xs text-ink-2 tabular'>{fmtTokens(t.tokens)}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}
