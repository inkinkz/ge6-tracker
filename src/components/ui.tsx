import type { ReactNode } from 'react';
import Link from 'next/link';
import { explorerAddressUrl, explorerTxUrl } from '@/lib/config';
import { shortAddr } from '@/lib/format';

export function Section({
  id,
  title,
  subtitle,
  action,
  children,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className='rounded-2xl border border-line bg-surface p-3 sm:p-6'
    >
      <div className='mb-5 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h2 id={`${id}-title`} className='text-lg font-semibold leading-snug'>
            {title}
          </h2>
          {subtitle ? (
            <p className='mt-1.5 text-sm leading-relaxed text-muted'>{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role='radiogroup'
      aria-label={label}
      className='no-scrollbar inline-flex max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 text-sm'
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type='button'
            role='radio'
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-9 shrink-0 rounded-full px-3.5 font-medium whitespace-nowrap transition-colors ${
              active ? 'bg-ink text-page shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function AddressLink({ address, highlight }: { address: string; highlight?: boolean }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target='_blank'
      rel='noopener noreferrer'
      title={address}
      className={`font-mono text-[13px] tabular underline-offset-2 hover:underline ${highlight ? 'font-semibold text-ink' : 'text-link'}`}
    >
      {shortAddr(address)}
    </a>
  );
}

export function TxLink({ hash, children }: { hash: string; children: ReactNode }) {
  return (
    <a
      href={explorerTxUrl(hash)}
      target='_blank'
      rel='noopener noreferrer'
      className='text-link underline-offset-2 hover:underline'
    >
      {children}
    </a>
  );
}

/** Thin horizontal share bar: track + data fill, 4px rounded end. */
export function ShareBar({
  value,
  max = 1,
  label,
}: {
  value: number;
  max?: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className='h-1.5 w-full rounded-full bg-surface-2'
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <div
        className='h-full rounded-full bg-data'
        style={{ width: `${pct > 0 ? Math.max(pct, 1) : 0}%` }}
      />
    </div>
  );
}

/** "Nenie CGM48" → name + group, so the group can be de-emphasized (GE4 names have no group). */
export function MemberName({ name }: { name: string }) {
  const i = name.lastIndexOf(' ');
  const nick = i > 0 ? name.slice(0, i) : name;
  const group = i > 0 ? name.slice(i + 1) : '';
  return (
    <span>
      <span className='font-semibold text-ink'>{nick}</span>
      {group ? <span className='ml-1 text-xs font-normal text-muted'>{group}</span> : null}
    </span>
  );
}

/** Small group color key (BNK48 blue / CGM48 orange) next to a member's name. */
export function GroupDot({ group }: { group: string | null }) {
  if (!group) return null;
  return (
    <span
      aria-hidden
      className={`inline-block size-2 shrink-0 rounded-full ${group === 'CGM48' ? 'bg-cgm' : 'bg-bnk'}`}
    />
  );
}

/** A GE6 member's name linking to her results page: nickname, then the group de-emphasized. */
export function MemberLink({
  name,
  slug,
  className = '',
}: {
  name: string;
  slug: string;
  className?: string;
}) {
  const i = name.lastIndexOf(' ');
  const nick = i > 0 ? name.slice(0, i) : name;
  const group = i > 0 ? name.slice(i + 1) : '';
  return (
    <Link
      href={`/member/${slug}`}
      prefetch={false}
      className={`inline-flex min-w-0 items-baseline gap-1.5 underline-offset-2 hover:underline ${className}`}
    >
      <span className='self-center'>
        <GroupDot group={group || null} />
      </span>
      <span className='truncate font-semibold text-ink'>{nick}</span>
      {group ? <span className='shrink-0 text-xs font-normal text-muted'>{group}</span> : null}
    </Link>
  );
}

/** A wallet linking to its full vote history (/wallet) rather than the explorer. */
export function WalletLink({ address, highlight }: { address: string; highlight?: boolean }) {
  return (
    <Link
      href={`/wallet?address=${address}`}
      prefetch={false}
      title={address}
      className={`font-mono text-[13px] tabular underline-offset-2 hover:underline ${highlight ? 'font-semibold text-ink' : 'text-link'}`}
    >
      {shortAddr(address)}
    </Link>
  );
}

/** Rank movement since GE5: ▲3 / ▼2 / – / ใหม่ (not in GE5). Arrow + number, never color alone. */
export function RankChange({ rank, prev }: { rank: number; prev: number | null }) {
  if (prev === null) {
    return <span className='rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2'>ไม่มีใน GE5</span>;
  }
  const d = prev - rank;
  if (d === 0) return <span className='text-xs text-muted tabular' title='อันดับเท่าเดิมจาก GE5'>= GE5</span>;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium tabular ${d > 0 ? 'text-good-text' : 'text-critical'}`}
      title={`GE5 อันดับ ${prev}`}
    >
      <span aria-hidden>{d > 0 ? '▲' : '▼'}</span>
      <span className='sr-only'>{d > 0 ? 'ขึ้น' : 'ลง'}</span>
      {Math.abs(d)}
    </span>
  );
}

/** Label + big number + note, the stat tile used across the results pages. */
export function Tile({
  label,
  value,
  unit,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
}) {
  return (
    <div className='rounded-2xl border border-line bg-surface p-4 sm:p-5'>
      <div className='text-[13px] leading-snug text-ink-2'>{label}</div>
      <div className='mt-2 flex flex-wrap items-baseline gap-x-1'>
        <span className='text-2xl font-semibold tracking-tight tabular sm:text-[28px]'>{value}</span>
        {unit ? <span className='text-sm text-muted'>{unit}</span> : null}
      </div>
      {note ? <div className='mt-1.5 text-xs leading-relaxed text-muted'>{note}</div> : null}
    </div>
  );
}
