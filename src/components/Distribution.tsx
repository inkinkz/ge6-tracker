import type { StatsSnapshot } from "@/lib/types";
import { fmtNumber, fmtPercent, fmtTokens } from "@/lib/format";
import { Section, ShareBar } from "./ui";

export function Distribution({ data }: { data: StatsSnapshot }) {
  const { distribution, totals } = data;
  const voterShare = (n: number) => (totals.voters ? n / totals.voters : 0);
  const maxVoterShare = Math.max(...distribution.map((d) => voterShare(d.voters)), 0);
  const maxTokenShare = Math.max(...distribution.map((d) => d.share), 0);

  // Headline: the most common bucket vs. how much of the total it actually contributes.
  const common = distribution.reduce((a, b) => (b.voters > a.voters ? b : a), distribution[0]);

  return (
    <Section
      id="distribution"
      title="กระเป๋าแบ่งตามยอดโหวตรวม"
      subtitle={
        common && common.voters > 0
          ? `${fmtPercent(voterShare(common.voters))} ของกระเป๋าโหวตรวม ${common.label} GE6 แต่คิดเป็น ${fmtPercent(common.share)} ของยอดทั้งหมด`
          : undefined
      }
    >
      <div className="mb-1 grid grid-cols-[minmax(0,7.5rem)_1fr_1fr] gap-4 text-xs font-medium text-ink-2">
        <span>ยอดรวมต่อกระเป๋า</span>
        <span>จำนวนกระเป๋า</span>
        <span>สัดส่วนโทเคน</span>
      </div>
      <ul className="divide-y divide-line">
        {distribution.map((d) => (
          <li key={d.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_1fr] items-center gap-4 py-3.5 text-sm">
            <span className="font-medium">
              {d.label} <span className="text-xs font-normal text-muted">GE6</span>
            </span>
            <span>
              <span className="block tabular">
                {fmtNumber(d.voters)} <span className="text-xs text-muted">({fmtPercent(voterShare(d.voters))})</span>
              </span>
              <span className="mt-1.5 block">
                <ShareBar value={voterShare(d.voters)} max={maxVoterShare} />
              </span>
            </span>
            <span>
              <span className="block tabular" title={`${fmtTokens(d.tokens)} GE6`}>
                {fmtPercent(d.share)}
              </span>
              <span className="mt-1.5 block">
                <ShareBar value={d.share} max={maxTokenShare} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted">แต่ละคอลัมน์ใช้สเกลของตัวเอง แถบที่ยาวที่สุดคือค่าสูงสุดในคอลัมน์นั้น</p>
    </Section>
  );
}
