import React from 'react';

/**
 * High-performance, accessible skeleton primitives for GoShipping portals.
 * Uses Tailwind animate-pulse with subtle slate tones conforming to Kumo & Hallmark design standards.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200/80 rounded ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs space-y-2 animate-pulse">
      <div className="h-3 w-28 bg-slate-200 rounded" />
      <div className="h-8 w-20 bg-slate-200 rounded mt-2" />
      <div className="h-3 w-36 bg-slate-100 rounded mt-1.5" />
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 4 Top KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Split Grid: Recent Orders & Recent Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Consignments Skeleton */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-52 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="h-7 w-28 bg-slate-100 rounded-md animate-pulse" />
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-[150px]"><div className="h-3 w-20 bg-slate-200 rounded animate-pulse" /></th>
                  <th className="py-2.5 px-3"><div className="h-3 w-24 bg-slate-200 rounded animate-pulse" /></th>
                  <th className="py-2.5 px-3"><div className="h-3 w-20 bg-slate-200 rounded animate-pulse" /></th>
                  <th className="py-2.5 px-3 w-[140px]"><div className="h-3 w-16 bg-slate-200 rounded animate-pulse" /></th>
                  <th className="py-2.5 px-3 w-[120px] text-right"><div className="h-3 w-14 bg-slate-200 rounded ml-auto animate-pulse" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3">
                      <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2.5 w-16 bg-slate-100 rounded mt-1.5 animate-pulse" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3.5 w-36 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2.5 w-24 bg-slate-100 rounded mt-1.5 animate-pulse" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2.5 w-16 bg-slate-100 rounded mt-1.5 animate-pulse" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-6 w-28 bg-slate-100 rounded-md animate-pulse" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-7 w-14 bg-slate-100 rounded-md animate-pulse" />
                        <div className="h-7 w-16 bg-slate-200/80 rounded-md animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Recent Quotes Queue Skeleton */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3, 4].map((q) => (
              <div key={q} className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 space-y-2 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-100 rounded" />
                </div>
                <div className="h-3 w-40 bg-slate-100 rounded" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-2.5 w-20 bg-slate-100 rounded" />
                  <div className="h-5 w-16 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableTabSkeleton({
  columns = 6,
  rows = 5,
  hasFilters = true
}: {
  columns?: number;
  rows?: number;
  hasFilters?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg p-5 sm:p-6 border border-slate-200 space-y-5 shadow-xs animate-in fade-in duration-150">
      {/* Header & Filter Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="h-5 w-44 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-8 w-32 bg-slate-200 rounded-md animate-pulse" />
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="h-8 flex-1 min-w-[200px] bg-slate-100 rounded-md border border-slate-200 animate-pulse" />
          <div className="h-8 w-44 bg-slate-100 rounded-md border border-slate-200 animate-pulse" />
          <div className="h-8 w-36 bg-slate-100 rounded-md border border-slate-200 animate-pulse" />
          <div className="h-8 w-16 bg-slate-100 rounded-md border border-slate-200 animate-pulse" />
        </div>
      )}

      {/* Table Skeleton */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="py-2.5 px-3">
                  <div className={`h-3.5 bg-slate-200 rounded animate-pulse ${i === columns - 1 ? 'w-14 ml-auto' : 'w-24'}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/50">
                {Array.from({ length: columns }).map((_, cIdx) => (
                  <td key={cIdx} className={`py-3 px-3 ${cIdx === columns - 1 ? 'text-right' : ''}`}>
                    {cIdx === 0 ? (
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0 animate-pulse" />
                        <div className="space-y-1 flex-1">
                          <div className="h-3.5 w-32 bg-slate-200 rounded animate-pulse" />
                          <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
                        </div>
                      </div>
                    ) : cIdx === columns - 1 ? (
                      <div className="h-7 w-7 rounded-md bg-slate-100 ml-auto animate-pulse" />
                    ) : (
                      <div className="space-y-1">
                        <div className={`h-3 bg-slate-200 rounded animate-pulse ${cIdx % 2 === 0 ? 'w-24' : 'w-28'}`} />
                        <div className={`h-2.5 bg-slate-100 rounded animate-pulse ${cIdx % 2 === 0 ? 'w-16' : 'w-20'}`} />
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WarehousesSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-72 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-8 w-36 bg-slate-200 rounded-md animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 animate-pulse">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-200" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-2.5 w-20 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-5 w-16 bg-slate-100 rounded-full" />
            </div>

            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-100 rounded" />
              <div className="h-3 w-4/5 bg-slate-100 rounded" />
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="h-3 w-28 bg-slate-100 rounded" />
              <div className="h-6 w-20 bg-slate-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InvoicesTabSkeleton() {
  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-6 shadow-xs animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-44 bg-slate-200 rounded-md animate-pulse" />
          <div className="h-8 w-24 bg-slate-100 rounded-md animate-pulse" />
        </div>
      </div>

      {/* KPI 4 Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5 animate-pulse">
            <div className="h-2.5 w-24 bg-slate-200 rounded" />
            <div className="h-6 w-28 bg-slate-200 rounded mt-1" />
            <div className="h-2.5 w-20 bg-slate-100 rounded mt-1" />
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="h-8 flex-1 min-w-[200px] bg-slate-100 rounded-md border border-slate-200 animate-pulse" />
        <div className="h-8 w-36 bg-slate-100 rounded-md border border-slate-200 animate-pulse" />
        <div className="h-8 w-16 bg-slate-100 rounded-md border border-slate-200 animate-pulse" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Invoice #', 'Customer & Company', 'Route & Mode', 'Amount BDT', 'Status', 'Actions'].map((name, i) => (
                <th key={name} className={`py-2.5 px-3 ${i === 5 ? 'text-right' : ''}`}>
                  <div className={`h-3 bg-slate-200 rounded animate-pulse ${i === 5 ? 'w-14 ml-auto' : 'w-20'}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-3 px-3">
                  <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />
                  <div className="h-2.5 w-16 bg-slate-100 rounded mt-1 animate-pulse" />
                </td>
                <td className="py-3 px-3">
                  <div className="h-3.5 w-36 bg-slate-200 rounded animate-pulse" />
                  <div className="h-2.5 w-24 bg-slate-100 rounded mt-1 animate-pulse" />
                </td>
                <td className="py-3 px-3">
                  <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-2.5 w-16 bg-slate-100 rounded mt-1 animate-pulse" />
                </td>
                <td className="py-3 px-3">
                  <div className="h-3.5 w-20 bg-slate-200 rounded animate-pulse font-mono" />
                </td>
                <td className="py-3 px-3">
                  <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
                </td>
                <td className="py-3 px-3 text-right">
                  <div className="h-7 w-20 bg-slate-100 rounded-md ml-auto animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
