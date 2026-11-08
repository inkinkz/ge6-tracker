import type { SupplySnapshot } from "@/lib/types";
import { fmtPercent, fmtTokens } from "@/lib/format";
import { Swatch } from "./chart";
import { Section } from "./ui";

type Step = {
  label: string;
  value: number;
  /** The step before, so we can say how much of it carried on. */
  prev: number | null;
  /** What stopped at this step instead of moving on. */
  stopped: { label: string; value: number; color: string } | null;
};

/**
 * A left-aligned funnel: each row's bar is what made it to that step (blue) plus what stopped there
 * (grey = still with the organizer, light blue = in fans' wallets), so it is exactly as wide as the
 * step before. All bars share one scale: the full width is every GE6 created.
 */
export function TokenJourney({ supply }: { supply: SupplySnapshot }) {
  const { created, treasury, distributors, distributed, voted, inWallets } = supply;
  const leftTreasury = created - treasury;
  const steps: Step[] = [
    { label: "สร้างทั้งหมด", value: created, prev: null, stopped: null },
    {
      label: "ออกจากกระเป๋าหลัก",
      value: leftTreasury,
      prev: created,
      stopped: { label: "ยังอยู่ในกระเป๋าหลัก", value: treasury, color: "bg-supply-org" },
    },
    {
      label: "ถึงมือแฟน",
      value: distributed,
      prev: leftTreasury,
      stopped: { label: "ค้างในกระเป๋าแจกจ่าย", value: distributors, color: "bg-supply-org" },
    },
    {
      label: "ใช้โหวตแล้ว",
      value: voted,
      prev: distributed,
      stopped: { label: "ยังอยู่ในกระเป๋าแฟน", value: inWallets, color: "bg-supply-wallet" },
    },
  ];
  const pct = (n: number) => (created > 0 ? (n / created) * 100 : 0);

  return (
    <Section
      id="tokens"
      title="เส้นทางของโทเคน GE6"
      subtitle={`จากโทเคนที่สร้างขึ้น ${fmtTokens(created)} GE6 ไปถึงการโหวตได้ ${fmtPercent(created > 0 ? voted / created : 0)}`}
    >
      <ol className="space-y-5">
        {steps.map((st, i) => (
          <li key={st.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">
                <span className="mr-1.5 text-muted tabular">{i + 1}.</span>
                {st.label}
              </span>
              <span className="text-right whitespace-nowrap tabular">
                <span className="font-semibold">{fmtTokens(st.value)}</span>{" "}
                <span className="text-xs text-muted">GE6 · {fmtPercent(pct(st.value) / 100)}</span>
              </span>
            </div>
            <div
              className="mt-2 flex"
              role="img"
              aria-label={`${st.label} ${fmtTokens(st.value)} GE6${st.stopped ? `, ${st.stopped.label} ${fmtTokens(st.stopped.value)} GE6` : ""}`}
            >
              <div
                title={`${st.label} ${fmtTokens(st.value)} GE6`}
                className="h-3 rounded-full bg-data"
                style={{ width: `${pct(st.value)}%`, minWidth: st.value > 0 ? 4 : 0 }}
              />
              {st.stopped && st.stopped.value > 0 ? (
                <div
                  title={`${st.stopped.label} ${fmtTokens(st.stopped.value)} GE6`}
                  className={`ml-0.5 h-3 rounded-full ${st.stopped.color}`}
                  style={{ width: `calc(${pct(st.stopped.value)}% - 2px)`, minWidth: 4 }}
                />
              ) : null}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
              {st.stopped ? (
                <>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Swatch className={st.stopped.color} />
                    {st.stopped.label} {fmtTokens(st.stopped.value)}
                  </span>
                  {st.prev ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="whitespace-nowrap">ไปต่อได้ {fmtPercent(st.value / st.prev)} ของขั้นก่อน</span>
                    </>
                  ) : null}
                </>
              ) : (
                <span>โทเคน GE6 ทั้งหมดที่มีอยู่ เต็มความยาวแถบ</span>
              )}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
