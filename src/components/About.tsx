import { EXPLORER_URL, GE6_TOKEN, VOTE_CONTRACT, explorerAddressUrl, explorerTransfersUrl } from "@/lib/config";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import type { StatsSnapshot } from "@/lib/types";
import { Section } from "./ui";

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
        {q}
        <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

const ext = { target: "_blank", rel: "noopener noreferrer", className: "text-link underline underline-offset-2" } as const;

export function About({ data, pollSeconds }: { data: StatsSnapshot; pollSeconds: number }) {
  return (
    <Section id="about" title="เกี่ยวกับข้อมูล">
      <div className="divide-y divide-line">
        <Faq q="ข้อมูลนี้มาจากไหน?">
          <p>
            ทุกครั้งที่มีการโหวต สัญญาอัจฉริยะ (smart contract) สำหรับโหวตบนบล็อกเชน Token X จะรับโทเคน GE6 และบันทึกเหตุการณ์{" "}
            <code className="rounded bg-surface-2 px-1">Voted</code> ไว้บนเชน เว็บนี้อ่านเหตุการณ์ทั้งหมดผ่าน{" "}
            <a href={EXPLORER_URL} {...ext}>
              Token X Scan
            </a>{" "}
            แล้วคำนวณสถิติให้อัตโนมัติ ตรวจสอบรายการทั้งหมดได้ที่{" "}
            <a href={explorerTransfersUrl} {...ext}>
              หน้ารายการโอนโทเคนของกระเป๋าโหวต
            </a>
          </p>
        </Faq>
        <Faq q="ทำไมไม่มีคะแนนแยกรายเมมเบอร์?">
          <p>
            บนบล็อกเชนแต่ละโหวตบันทึกไว้แค่ “รหัสแฮช” ที่เข้ารหัสไว้ และไม่มีโหวตไหนที่ใช้แฮชซ้ำกันเลย จึงระบุไม่ได้ว่าโหวตนั้นให้เมมเบอร์คนไหน
            เว็บนี้แสดงได้เฉพาะยอดรวม ผลคะแนนรายเมมเบอร์จะประกาศอย่างเป็นทางการโดยผู้จัดเท่านั้น
          </p>
        </Faq>
        <Faq q="อัปเดตบ่อยแค่ไหน?">
          <p>
            ขณะที่เปิดหน้านี้อยู่ ข้อมูลจะรีเฟรชเองทุก ~{pollSeconds} วินาที ตัวเลขบนเซิร์ฟเวอร์อาจช้ากว่าบล็อกเชนจริงไม่เกินประมาณ 30 วินาที
            ถ้าไม่ได้แตะหน้าจอนานๆ หรือสลับไปแท็บอื่น การอัปเดตจะหยุดชั่วคราวเพื่อประหยัดแบตเตอรี่และเน็ต แตะที่ปุ่มสถานะด้านบนเพื่ออัปเดตต่อได้ทันที
          </p>
        </Faq>
        <Faq q="ตัวเลขแต่ละตัวหมายถึงอะไร?">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>โทเคนที่โหวต</b> — จำนวนโทเคน GE6 ทั้งหมดที่ส่งเข้าสัญญาโหวต (หนึ่งธุรกรรมใช้โทเคนได้มากกว่า 1 และมีเศษทศนิยมได้)
            </li>
            <li>
              <b>จำนวนครั้งที่โหวต</b> — จำนวนธุรกรรมโหวต
            </li>
            <li>
              <b>กระเป๋าที่โหวต</b> — จำนวนที่อยู่กระเป๋าที่ไม่ซ้ำกัน (คนหนึ่งอาจมีหลายกระเป๋า)
            </li>
            <li>
              <b>กระเป๋าใหม่</b> — กระเป๋าที่โหวตเป็นครั้งแรกในช่วงเวลานั้น
            </li>
            <li>
              <b>ค่ากลาง (มัธยฐาน)</b> — ครึ่งหนึ่งของกระเป๋าโหวตรวมน้อยกว่าหรือเท่ากับค่านี้
            </li>
          </ul>
        </Faq>
        <Faq q="ข้อมูลทางเทคนิค">
          <ul className="space-y-1 break-all">
            <li>
              สัญญาโหวต:{" "}
              <a href={explorerAddressUrl(VOTE_CONTRACT)} {...ext}>
                {VOTE_CONTRACT}
              </a>
            </li>
            <li>
              โทเคน GE6:{" "}
              <a href={explorerAddressUrl(GE6_TOKEN)} {...ext}>
                {GE6_TOKEN}
              </a>
            </li>
            <li>
              ซิงก์ถึงบล็อก #{fmtNumber(data.syncedBlock)} ({fmtDateTime(data.syncedBlockAt)})
            </li>
            <li>
              โหวตครั้งแรก: {data.firstVoteAt ? fmtDateTime(data.firstVoteAt) : "-"} · ตรวจพบโหวตตามลำดับครบ{" "}
              {fmtNumber(data.integrity.expectedVotes - data.integrity.missingVotes)} / {fmtNumber(data.integrity.expectedVotes)} รายการ
            </li>
          </ul>
        </Faq>
      </div>
    </Section>
  );
}
