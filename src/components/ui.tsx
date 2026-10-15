import type { ReactNode } from 'react';
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
