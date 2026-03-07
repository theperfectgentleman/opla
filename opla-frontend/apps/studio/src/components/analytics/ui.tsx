import type { ReactNode } from 'react';

export const analyticsPanelClass = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm';
export const analyticsInsetClass = 'rounded-lg border border-slate-200 bg-slate-50';
export const analyticsInputClass = 'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';
export const analyticsLabelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500';
export const analyticsButtonClass = 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-700 bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60';
export const analyticsGhostButtonClass = 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50';

interface AnalyticsPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function AnalyticsPageHeader({ eyebrow, title, description, actions }: AnalyticsPageHeaderProps) {
  return (
    <div className="border-b border-slate-200 pb-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-1 text-xl font-bold text-slate-800">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

interface AnalyticsSkeletonLineProps {
  className?: string;
}

export function AnalyticsSkeletonLine({ className = '' }: AnalyticsSkeletonLineProps) {
  return <div className={`h-3 rounded bg-slate-200/65 animate-pulse ${className}`.trim()} />;
}

interface AnalyticsPanelSkeletonProps {
  withSidebar?: boolean;
  rows?: number;
}

export function AnalyticsPanelSkeleton({ withSidebar = false, rows = 6 }: AnalyticsPanelSkeletonProps) {
  const content = (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <AnalyticsSkeletonLine className="h-2.5 w-24" />
        <AnalyticsSkeletonLine className="mt-3 h-6 w-48" />
        <AnalyticsSkeletonLine className="mt-3 w-full max-w-xl" />
        <AnalyticsSkeletonLine className="mt-2 w-3/4 max-w-lg" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <AnalyticsSkeletonLine className="h-3 w-20" />
            <AnalyticsSkeletonLine className="mt-3 h-4 w-2/3" />
            <AnalyticsSkeletonLine className="mt-2 w-full" />
            <AnalyticsSkeletonLine className="mt-2 w-5/6" />
          </div>
        ))}
      </div>
      <div className="rounded-md border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5">
          <AnalyticsSkeletonLine className="h-3 w-32" />
        </div>
        <div className="space-y-3 px-3 py-3">
          {Array.from({ length: rows }).map((_, index) => (
            <AnalyticsSkeletonLine key={index} className={index % 2 === 0 ? 'w-full' : 'w-11/12'} />
          ))}
        </div>
      </div>
    </div>
  );

  if (!withSidebar) {
    return <div className={analyticsPanelClass}>{content}</div>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className={analyticsPanelClass}>
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <AnalyticsSkeletonLine className="h-2.5 w-20" />
            <AnalyticsSkeletonLine className="mt-3 h-6 w-32" />
            <AnalyticsSkeletonLine className="mt-3 w-full" />
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index}>
              <AnalyticsSkeletonLine className="mb-2 h-2.5 w-16" />
              <AnalyticsSkeletonLine className="h-9 w-full rounded-md" />
            </div>
          ))}
          <AnalyticsSkeletonLine className="h-9 w-full rounded-md" />
        </div>
      </div>
      {content}
    </div>
  );
}

export function AnalyticsHubSkeleton() {
  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <AnalyticsSkeletonLine className="h-2.5 w-28" />
        <AnalyticsSkeletonLine className="mt-3 h-6 w-40" />
        <AnalyticsSkeletonLine className="mt-3 w-full max-w-2xl" />
        <AnalyticsSkeletonLine className="mt-2 w-5/6 max-w-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <AnalyticsSkeletonLine className="h-10 w-10 rounded-md" />
            <AnalyticsSkeletonLine className="mt-4 h-4 w-28" />
            <AnalyticsSkeletonLine className="mt-3 w-full" />
            <AnalyticsSkeletonLine className="mt-2 w-5/6" />
            <AnalyticsSkeletonLine className="mt-8 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className={analyticsPanelClass}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <AnalyticsSkeletonLine className="h-2.5 w-24" />
            <AnalyticsSkeletonLine className="mt-3 h-5 w-40" />
            <AnalyticsSkeletonLine className="mt-3 w-full max-w-2xl" />
          </div>
          <AnalyticsSkeletonLine className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <AnalyticsPanelSkeleton withSidebar />
    </div>
  );
}

export function AnalyticsTableSkeleton({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="grid gap-0 border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className="px-3 py-2.5">
            <AnalyticsSkeletonLine className="h-2.5 w-16" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="px-3 py-3">
                <AnalyticsSkeletonLine className={colIndex % 2 === 0 ? 'w-11/12' : 'w-4/5'} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsChartSkeleton() {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex h-[520px] items-end gap-3 rounded-md bg-slate-50 px-4 pb-6 pt-8">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2">
            <div
              className="w-full max-w-[44px] rounded-t-md bg-slate-200/65 animate-pulse"
              style={{ height: `${120 + ((index * 37) % 180)}px` }}
            />
            <AnalyticsSkeletonLine className="h-2.5 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsSheetSkeleton() {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white p-2">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
        <div className="mb-2 flex gap-2 border-b border-slate-200 pb-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <AnalyticsSkeletonLine key={index} className="h-6 w-16 rounded-md" />
          ))}
        </div>
        <AnalyticsTableSkeleton columns={6} rows={8} />
      </div>
    </div>
  );
}

export function AnalyticsPivotSkeleton() {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white p-2">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <AnalyticsSkeletonLine className="h-2.5 w-14" />
                <AnalyticsSkeletonLine className="mt-2 h-8 w-full rounded-md" />
              </div>
            ))}
          </div>
          <AnalyticsTableSkeleton columns={5} rows={7} />
        </div>
      </div>
    </div>
  );
}