import type { ReactNode } from 'react';
import type { Ge6MemberSummary, Ge6Results } from '@/lib/types';
import { fmtDateTime, fmtNumber, fmtPercent, fmtTime, fmtTokens } from '@/lib/format';
import { memberSlug } from '@/lib/slug';
import { MemberLink, Section, WalletLink } from './ui';

function Card({ title, value, children }: { title: string; value: ReactNode; children: ReactNode }) {
  return (
    <li className='rounded-xl bg-surface-2 p-4'>
      <div className='text-[13px] text-ink-2'>{title}</div>
      <div className='mt-1.5 text-lg leading-snug font-semibold'>{value}</div>
      <div className='mt-1 text-xs leading-relaxed text-muted'>{children}</div>
    </li>
  );
}

const best = (list: Ge6MemberSummary[], key: (m: Ge6MemberSummary) => number) =>
  list.reduce((a, b) => (key(b) > key(a) ? b : a), list[0]);

const Member = ({ name }: { name: string }) => <MemberLink name={name} slug={memberSlug(name)} />;

/** Records and the most telling per-member numbers, one card each. */
export function Highlights({ data }: { data: Ge6Results }) {
  const { members, records, topWallets } = data;
  const inGe5 = members.filter((m) => m.ge5);
  const climber = best(inGe5, (m) => m.ge5!.rank - m.rank);
  const broadest = best(members, (m) => m.wallets);
  const mostVotes = best(members, (m) => m.votes);
  const whale = best(members, (m) => m.top1Share);
  const loyal = best(members, (m) => m.soleShare);
  const lateSurge = best(members, (m) => m.finalDayShare);
  const avg = best(members, (m) => m.avgPerWallet);
  const top = topWallets[0];
  const { largestVote, mostVotes: busiest, mostMembers, firstVote, lastVote } = records;

  return (
    <Section id='highlights' title='สถิติเด่นของ GE6' subtitle='สถิติที่น่าสนใจจากผลโหวตรายกระเป๋า'>
      <ul className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        <Card title='กระเป๋าที่โหวตมากที่สุด' value={<WalletLink address={top.address} />}>
          {fmtTokens(top.tokens)} GE6 ({fmtPercent(top.share)} ของทั้งหมด) ให้ {fmtNumber(top.memberCount)} คน มากสุด{' '}
          {top.members[0].name} {fmtTokens(top.members[0].tokens)}
        </Card>
        <Card title='โหวตครั้งเดียวมากที่สุด' value={<span className='tabular'>{fmtTokens(largestVote.tokens)} GE6</span>}>
          ให้ <Member name={largestVote.member} /> จาก <WalletLink address={largestVote.address} /> เมื่อ{' '}
          {fmtDateTime(largestVote.at)} น.
        </Card>
        <Card title='ขยับอันดับขึ้นมากที่สุดจาก GE5' value={<Member name={climber.name} />}>
          จากอันดับ {climber.ge5!.rank} ใน GE5 ขึ้นมาอันดับ {climber.rank} (▲{climber.ge5!.rank - climber.rank}) ·{' '}
          {fmtTokens(climber.tokens)} GE6
        </Card>
        <Card title='ฐานแฟนกว้างที่สุด' value={<Member name={broadest.name} />}>
          {fmtNumber(broadest.wallets)} กระเป๋าโหวตให้ · อันดับ {broadest.rank}
        </Card>
        <Card title='ถูกโหวตบ่อยที่สุด' value={<Member name={mostVotes.name} />}>
          {fmtNumber(mostVotes.votes)} ครั้ง ({fmtPercent(mostVotes.votes / data.totals.votes)} ของทุกครั้งที่โหวต)
        </Card>
        <Card title='เฉลี่ยต่อกระเป๋าสูงสุด' value={<Member name={avg.name} />}>
          เฉลี่ย {fmtTokens(avg.avgPerWallet)} GE6 ต่อกระเป๋า จาก {fmtNumber(avg.wallets)} กระเป๋า
        </Card>
        <Card title='พึ่งกระเป๋าเดียวมากที่สุด' value={<Member name={whale.name} />}>
          กระเป๋าอันดับ 1 ให้ {fmtPercent(whale.top1Share)} ของยอดเธอ ({fmtTokens(whale.topVoter.tokens)} GE6)
        </Card>
        <Card title='แฟนเหนียวแน่นที่สุด' value={<Member name={loyal.name} />}>
          {fmtPercent(loyal.soleShare)} ของยอดมาจากกระเป๋าที่โหวตให้เธอคนเดียว ({fmtNumber(loyal.soleWallets)} กระเป๋า)
        </Card>
        <Card title='เร่งช่วงโค้งสุดท้ายมากที่สุด' value={<Member name={lateSurge.name} />}>
          {fmtPercent(lateSurge.finalDayShare)} ของยอดเธอเข้ามาใน 24 ชั่วโมงสุดท้าย
        </Card>
        <Card title='กระเป๋าที่โหวตบ่อยที่สุด' value={<WalletLink address={busiest.address} />}>
          {fmtNumber(busiest.votes)} ครั้ง รวม {fmtTokens(busiest.tokens)} GE6
        </Card>
        <Card title='โหวตให้เมมเบอร์มากที่สุด' value={<WalletLink address={mostMembers.address} />}>
          โหวตให้ {fmtNumber(mostMembers.members)} คน{mostMembers.members === data.totals.members ? ' (ครบทุกคน)' : ''} รวม{' '}
          {fmtTokens(mostMembers.tokens)} GE6
        </Card>
        <Card title='โหวตแรก · โหวตสุดท้าย' value={<span className='tabular'>{fmtTime(lastVote.at)} น.</span>}>
          โหวตแรก {fmtDateTime(firstVote.at)} น. ให้ <Member name={firstVote.member} /> · โหวตสุดท้ายก่อนปิด{' '}
          {Math.max(0, data.closeAt - lastVote.at)} วินาที ให้ <Member name={lastVote.member} />
        </Card>
      </ul>
    </Section>
  );
}
