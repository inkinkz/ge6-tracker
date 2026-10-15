"use client";

import { useState } from "react";
import type { WalletInfo } from "@/lib/types";
import { fmtDateTime, fmtNumber, fmtPercent, fmtTokens, shortAddr } from "@/lib/format";
import { useSavedWallet } from "@/lib/use-saved-wallet";
import { AddressLink, Section, TxLink } from "./ui";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type Result = { kind: "ok"; info: WalletInfo } | { kind: "error"; message: string } | null;

export function WalletLookup() {
  const [saved, save] = useSavedWallet();
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const input = draft ?? saved ?? "";

  async function lookup(raw: string) {
    const address = raw.trim();
    if (!ADDRESS_RE.test(address)) {
      setResult({ kind: "error", message: "ที่อยู่กระเป๋าต้องขึ้นต้นด้วย 0x และมีตัวอักษรอีก 40 ตัว" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/wallet/${address.toLowerCase()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult({ kind: "ok", info: json as WalletInfo });
    } catch (err) {
      setResult({ kind: "error", message: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" });
    } finally {
      setLoading(false);
    }
  }

  const info = result?.kind === "ok" ? result.info : null;
  const isSaved = info && saved === info.address;

  return (
    <Section id="lookup" title="เช็กยอดโหวตของกระเป๋า" subtitle="ดูยอดโหวตรวม อันดับ และประวัติการโหวตของกระเป๋าใดก็ได้">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(input);
        }}
      >
        <label htmlFor="wallet" className="sr-only">
          ที่อยู่กระเป๋า
        </label>
        <input
          id="wallet"
          value={input}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="วางที่อยู่กระเป๋า 0x…"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-page px-3 font-mono text-[15px] outline-none placeholder:font-sans placeholder:text-muted focus:border-data focus:ring-2 focus:ring-data/25"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-12 shrink-0 rounded-xl bg-data px-5 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "กำลังค้น…" : "ค้นหา"}
        </button>
      </form>

      {result?.kind === "error" ? (
        <p role="alert" className="mt-3 text-sm text-critical">
          {result.message}
        </p>
      ) : null}

      {info ? (
        <div className="mt-5 rounded-xl bg-surface-2 p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <AddressLink address={info.address} />
            <button
              type="button"
              onClick={() => save(isSaved ? null : info.address)}
              className="min-h-8 rounded-full px-3 text-xs font-medium ring-1 ring-line hover:bg-surface"
            >
              {isSaved ? "✓ กระเป๋าของฉัน (แตะเพื่อเลิกจำ)" : "จำเป็นกระเป๋าของฉัน"}
            </button>
          </div>

          {info.found ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-ink-2">อันดับ</div>
                  <div className="text-2xl font-semibold tabular">#{fmtNumber(info.rank ?? 0)}</div>
                  <div className="text-xs text-muted">จาก {fmtNumber(info.totalVoters)} กระเป๋า</div>
                </div>
                <div>
                  <div className="text-xs text-ink-2">โหวตแล้ว</div>
                  <div className="text-2xl font-semibold tabular">
                    {fmtTokens(info.tokens)} <span className="text-sm font-normal text-muted">GE6</span>
                  </div>
                  <div className="text-xs text-muted">{fmtPercent(info.share)} ของยอดทั้งหมด</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-2">
                โหวต {fmtNumber(info.votes)} ครั้ง · ครั้งแรก {info.firstVoteAt ? fmtDateTime(info.firstVoteAt) : "-"} · ล่าสุด{" "}
                {info.lastVoteAt ? fmtDateTime(info.lastVoteAt) : "-"}
              </p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer py-1 text-link">
                  ประวัติการโหวต{info.votes > info.recent.length ? ` (${info.recent.length} ครั้งล่าสุด)` : ""}
                </summary>
                <ul className="mt-1 divide-y divide-line">
                  {info.recent.map((v) => (
                    <li key={v.index} className="flex justify-between gap-2 py-1.5">
                      <TxLink hash={v.tx}>{fmtDateTime(v.at)}</TxLink>
                      <span className="font-medium tabular">{fmtTokens(v.tokens)} GE6</span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-2">
              ยังไม่พบการโหวตจากกระเป๋า {shortAddr(info.address)} — หากเพิ่งโหวต รอประมาณ 1 นาทีแล้วลองใหม่
            </p>
          )}
        </div>
      ) : null}
    </Section>
  );
}
