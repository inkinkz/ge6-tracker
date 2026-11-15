import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberView } from "@/components/MemberView";
import { getMember, getResults, memberSlugs } from "@/lib/ge6";
import { fmtPercent, fmtTokens } from "@/lib/format";

// Every member's page is prerendered at build time from the static result data.
export function generateStaticParams() {
  return memberSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/member/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const m = getMember(slug);
  if (!m) return {};
  return {
    title: `${m.name} — ผล GE6 อันดับ ${m.rank} — GE6 Vote Tracker`,
    description: `${m.name} ได้ ${fmtTokens(m.tokens)} GE6 (${fmtPercent(m.share)}) จาก ${m.wallets} กระเป๋าใน BNK48 & CGM48 General Election ครั้งที่ 6: กระเป๋าที่โหวตให้มากที่สุด ช่วงเวลาที่ได้รับโหวต และฐานแฟน`,
  };
}

export default async function MemberPage({ params }: PageProps<"/member/[slug]">) {
  // Awaited outside Suspense so unknown slugs still get an ISR entry (a 404 here).
  const { slug } = await params;
  const m = getMember(slug);
  if (!m) notFound();
  const { members, daily, totals } = getResults();
  const i = members.findIndex((x) => x.slug === slug);
  const neighbor = (x: (typeof members)[number] | undefined) => (x ? { name: x.name, slug: x.slug, rank: x.rank } : null);
  const { history, ...detail } = m;
  return (
    <MemberView
      m={detail}
      history={history}
      days={daily.map((d) => d.t)}
      totalMembers={totals.members}
      totalWallets={totals.wallets}
      prev={neighbor(members[i - 1])}
      next={neighbor(members[i + 1])}
    />
  );
}
