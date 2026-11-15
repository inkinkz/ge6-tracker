'use client';

import { useState } from 'react';
import type { Ge6Results } from '@/lib/types';
import { fmtDay, fmtHour, fmtNumber, fmtPercent, fmtTokens, fmtWeekday } from '@/lib/format';
import { AreaChart, ColumnChart } from './chart';
import { Section, Segmented } from './ui';

type View = 'daily' | 'cumulative' | 'final' | 'hour';
type Metric = 'tokens' | 'votes' | 'newWallets';

const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: 'tokens', label: 'โทเคน', unit: 'GE6' },
  { value: 'votes', label: 'จำนวนครั้ง', unit: 'ครั้ง' },
  { value: 'newWallets', label: 'กระเป๋าใหม่', unit: 'กระเป๋า' },
];
const fmtMetric = (m: Metric, v: number) => (m === 'tokens' ? fmtTokens(v) : fmtNumber(v));

/** When people voted: by day, cumulative, the final 24 hours, and by hour of the day. */
export function VoteTimeline({
  data,
}: {
  data: Pick<Ge6Results, 'daily' | 'finalHours' | 'hourOfDay' | 'totals'>;
}) {
  const [view, setView] = useState<View>('daily');
  const [metric, setMetric] = useState<Metric>('tokens');
  const { daily, finalHours, hourOfDay, totals } = data;
  const unit = METRICS.find((m) => m.value === metric)!.unit;

  const finalTokens = finalHours.reduce((s, h) => s + h.tokens, 0);
  const lastWeek = daily.slice(-7).reduce((s, d) => s + d.tokens, 0);
  const firstDays = daily.slice(0, 3).reduce((s, d) => s + d.tokens, 0);
  const peakDay = daily.reduce((a, b) => (b.tokens > a.tokens ? b : a), daily[0]);
  const peakHour = finalHours.reduce((a, b) => (b.tokens > a.tokens ? b : a), finalHours[0]);
  const busiestHour = hourOfDay.reduce((a, b) => (b.votes > a.votes ? b : a), hourOfDay[0]);
  const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

  return (
    <Section
      id='activity'
      title='ช่วงเวลาที่โหวต'
      subtitle={`วันที่โหวตมากที่สุด ${fmtWeekday(peakDay.t)} · ${fmtTokens(peakDay.tokens)} GE6 (${fmtPercent(peakDay.tokens / totals.tokens)} ของทั้งหมด) · เวลาประเทศไทย`}
    >
      <div className='mb-5 grid grid-cols-3 gap-3 text-sm'>
        <div className='rounded-xl bg-surface-2 p-3'>
          <div className='text-xs text-ink-2'>3 วันแรก</div>
          <div className='mt-1 font-semibold tabular'>{fmtPercent(firstDays / totals.tokens)}</div>
        </div>
        <div className='rounded-xl bg-surface-2 p-3'>
          <div className='text-xs text-ink-2'>7 วันสุดท้าย</div>
          <div className='mt-1 font-semibold tabular'>{fmtPercent(lastWeek / totals.tokens)}</div>
        </div>
        <div className='rounded-xl bg-surface-2 p-3'>
          <div className='text-xs text-ink-2'>24 ชม. สุดท้าย</div>
          <div className='mt-1 font-semibold tabular'>{fmtPercent(finalTokens / totals.tokens)}</div>
        </div>
      </div>

      <div className='mb-5 flex flex-wrap gap-2.5'>
        <Segmented
          label='มุมมอง'
          value={view}
          onChange={setView}
          options={[
            { value: 'daily', label: 'รายวัน' },
            { value: 'cumulative', label: 'ยอดสะสม' },
            { value: 'final', label: '24 ชม. สุดท้าย' },
            { value: 'hour', label: 'ช่วงเวลาของวัน' },
          ]}
        />
        {view === 'daily' ? <Segmented label='ข้อมูลที่แสดง' value={metric} onChange={setMetric} options={METRICS} /> : null}
      </div>

      <div className='pt-6'>
        {view === 'daily' ? (
          <ColumnChart
            key={metric}
            values={daily.map((d) => d[metric])}
            xLabel={(i) => fmtDay(daily[i].t)}
            ariaLabel={`กราฟแท่ง${METRICS.find((m) => m.value === metric)!.label}รายวัน`}
            tooltip={(i) => (
              <>
                <div className='text-muted'>{fmtWeekday(daily[i].t)}</div>
                <div className='text-sm font-semibold tabular'>
                  {fmtMetric(metric, daily[i][metric])} {unit}
                </div>
                <div className='tabular text-ink-2'>
                  {fmtTokens(daily[i].tokens)} GE6 · {fmtNumber(daily[i].votes)} ครั้ง · {fmtNumber(daily[i].wallets)} กระเป๋า ·{' '}
                  {fmtNumber(daily[i].newWallets)} ใหม่
                </div>
              </>
            )}
          />
        ) : view === 'cumulative' ? (
          <AreaChart
            values={daily.map((d) => d.cumulativeTokens)}
            xLabel={(i) => fmtDay(daily[i].t)}
            ariaLabel='กราฟยอดโทเคนสะสมรายวัน'
            tooltip={(i) => (
              <>
                <div className='text-muted'>{fmtWeekday(daily[i].t)}</div>
                <div className='text-sm font-semibold tabular'>สะสม {fmtTokens(daily[i].cumulativeTokens)} GE6</div>
                <div className='tabular text-ink-2'>
                  {fmtPercent(daily[i].cumulativeTokens / totals.tokens)} ของยอดสุดท้าย · +{fmtTokens(daily[i].tokens)} วันนั้น
                </div>
              </>
            )}
          />
        ) : view === 'final' ? (
          <ColumnChart
            values={finalHours.map((h) => h.tokens)}
            xLabel={(i) => fmtHour(finalHours[i].t)}
            ariaLabel='กราฟแท่งโทเคนรายชั่วโมงใน 24 ชั่วโมงสุดท้าย'
            tooltip={(i) => (
              <>
                <div className='text-muted'>
                  {fmtDay(finalHours[i].t)} {fmtHour(finalHours[i].t)}–{fmtHour(finalHours[i].t + 3600)} น.
                </div>
                <div className='text-sm font-semibold tabular'>{fmtTokens(finalHours[i].tokens)} GE6</div>
                <div className='tabular text-ink-2'>{fmtNumber(finalHours[i].votes)} ครั้ง</div>
              </>
            )}
          />
        ) : (
          <ColumnChart
            values={hourOfDay.map((h) => h.votes)}
            xLabel={(i) => pad(hourOfDay[i].hour)}
            ariaLabel='กราฟแท่งจำนวนครั้งที่โหวตตามชั่วโมงของวัน'
            tooltip={(i) => (
              <>
                <div className='text-muted'>
                  {pad(hourOfDay[i].hour)}–{pad((hourOfDay[i].hour + 1) % 24)} น. (ทุกวันรวมกัน)
                </div>
                <div className='text-sm font-semibold tabular'>{fmtNumber(hourOfDay[i].votes)} ครั้ง</div>
                <div className='tabular text-ink-2'>{fmtTokens(hourOfDay[i].tokens)} GE6</div>
              </>
            )}
          />
        )}
      </div>
      <p className='mt-3 text-xs leading-relaxed text-muted'>
        {view === 'final'
          ? `ชั่วโมงที่โหวตมากที่สุดก่อนปิด: ${fmtHour(peakHour.t)}–${fmtHour(peakHour.t + 3600)} น. · ${fmtTokens(peakHour.tokens)} GE6`
          : view === 'hour'
            ? `นับจำนวนครั้งตลอดการโหวต · ช่วงที่โหวตบ่อยที่สุด ${pad(busiestHour.hour)}–${pad((busiestHour.hour + 1) % 24)} น.`
            : 'เวลาโหวตจากไฟล์ผลโหวต · แตะหรือเลื่อนนิ้วบนกราฟเพื่อดูตัวเลขแต่ละช่วง'}
      </p>
      <details className='mt-3 text-sm'>
        <summary className='cursor-pointer py-1 text-link'>ดูข้อมูลรายวันเป็นตาราง</summary>
        <div className='mt-2 max-h-72 overflow-auto rounded-lg border border-line'>
          <table className='w-full text-left text-[13px]'>
            <thead className='sticky top-0 bg-surface-2 text-ink-2'>
              <tr>
                <th className='px-2.5 py-2 font-medium'>วัน</th>
                <th className='px-2.5 py-2 text-right font-medium'>GE6</th>
                <th className='px-2.5 py-2 text-right font-medium'>ครั้ง</th>
                <th className='px-2.5 py-2 text-right font-medium'>กระเป๋าใหม่</th>
                <th className='px-2.5 py-2 text-right font-medium'>ยอดสะสม</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-line tabular'>
              {[...daily].reverse().map((d) => (
                <tr key={d.t}>
                  <td className='px-2.5 py-1.5 whitespace-nowrap'>{fmtWeekday(d.t)}</td>
                  <td className='px-2.5 py-1.5 text-right'>{fmtTokens(d.tokens)}</td>
                  <td className='px-2.5 py-1.5 text-right'>{fmtNumber(d.votes)}</td>
                  <td className='px-2.5 py-1.5 text-right'>{fmtNumber(d.newWallets)}</td>
                  <td className='px-2.5 py-1.5 text-right'>{fmtTokens(d.cumulativeTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Section>
  );
}
