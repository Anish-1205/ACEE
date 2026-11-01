'use client';
import Link from 'next/link';
import { useRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const variants = {
  primary: 'bg-royal text-white hover:bg-navy',
  gold: 'bg-gold text-navy hover:brightness-95',
  outline: 'border border-line bg-white text-navy hover:border-royal',
  ghost: 'text-royal hover:bg-royal/10',
  danger: 'bg-danger text-white hover:brightness-110',
};
type Variant = keyof typeof variants;
const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';

export function Button({ variant = 'primary', loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button className={cx(base, variants[variant], className)} disabled={loading || p.disabled} aria-busy={loading} {...p}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = 'primary', className, children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return <Link href={href} className={cx(base, variants[variant], className)}>{children}</Link>;
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-card border border-line bg-white p-5 shadow-sm', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold text-navy">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type FieldProps = { label: ReactNode; error?: string; hint?: ReactNode; children: (id: string, describedBy?: string) => ReactNode };
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      {children(id, describedBy)}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

const inputCls = 'min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-base outline-none focus:border-royal aria-[invalid=true]:border-danger';
export function Input({ label, error, hint, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string; hint?: ReactNode }) {
  return <Field label={label} error={error} hint={hint}>{(id, d) => <input id={id} aria-describedby={d} aria-invalid={!!error} className={inputCls} {...p} />}</Field>;
}
export function Textarea({ label, error, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; error?: string }) {
  return <Field label={label} error={error}>{(id, d) => <textarea id={id} aria-describedby={d} aria-invalid={!!error} className={cx(inputCls, 'min-h-24')} {...p} />}</Field>;
}
export function Select({ label, error, hint, options, placeholder, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; error?: string; hint?: ReactNode; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, d) => (
        <select id={id} aria-describedby={d} aria-invalid={!!error} className={inputCls} {...p}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({ label, error, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }) {
  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-5 accent-royal" aria-invalid={!!error} {...p} />
        <span>{label}</span>
      </label>
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

/** Large tappable radio cards — easier than dropdowns on small screens. */
export function ChoiceGroup<T extends string>({ legend, value, onChange, options, name }: { legend: ReactNode; value: T | null; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; name: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-base font-semibold text-navy">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={cx('flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition', value === o.value ? 'border-royal bg-royal/5 font-semibold' : 'border-line bg-white')}>
          <input type="radio" name={name} className="size-5 accent-royal" checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

const tones = { neutral: 'bg-surface text-muted', info: 'bg-royal/10 text-royal', success: 'bg-success/10 text-success', warning: 'bg-gold/25 text-warning', danger: 'bg-danger/10 text-danger' };
export type Tone = keyof typeof tones;
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function Alert({ tone = 'info', children, title }: { tone?: Tone; children: ReactNode; title?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('rounded-xl px-4 py-3 text-sm', tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-line/70', className ?? 'h-24')} aria-hidden />;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return <div className="flex flex-col gap-3" role="status" aria-label={t('common:loading')}>{Array.from({ length: rows }, (_, i) => <Skeleton key={i} />)}</div>;
}

export function EmptyState({ children, action }: { children?: ReactNode; action?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      <p>{children ?? t('common:emptyTitle')}</p>
      {action}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useTranslation();
  return (
    <Alert tone="danger" title={t('common:errorTitle')}>
      <p>{message ?? t('common:errorBody')}</p>
      {onRetry && <Button variant="outline" className="mt-2" onClick={onRetry}>{t('common:retry')}</Button>}
    </Alert>
  );
}

/** Button that asks for confirmation in an accessible native <dialog> before running a destructive action. */
export function ConfirmButton({ message, onConfirm, children, variant = 'danger', loading }: { message: ReactNode; onConfirm: () => void; children: ReactNode; variant?: Variant; loading?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  return (
    <>
      <Button type="button" variant={variant === 'danger' ? 'outline' : variant} loading={loading} onClick={() => ref.current?.showModal()}>{children}</Button>
      <dialog ref={ref} className="m-auto max-w-sm rounded-card p-6 shadow-xl">
        <p className="mb-5 text-base text-ink">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => ref.current?.close()}>{t('common:cancel')}</Button>
          <Button variant={variant} onClick={() => { ref.current?.close(); onConfirm(); }}>{t('common:confirm')}</Button>
        </div>
      </dialog>
    </>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-navy md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('common:previous')}</Button>
      <span className="text-muted">{t('common:page', { page, pages })}</span>
      <Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t('common:next')}</Button>
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-surface text-xs uppercase text-muted"><tr>{head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line bg-white">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx('px-3 py-2 align-top', className)}>{children}</td>;

export { cx };
