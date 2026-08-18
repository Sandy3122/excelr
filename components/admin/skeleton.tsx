export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-slate-200/90 ${className}`}
    />
  );
}

export function SkeletonBadge() {
  return <Skeleton className="h-5 w-14 rounded-full" />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-36" />
    </div>
  );
}

export function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="border-t border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={i === 0 ? "h-4 w-36" : "h-4 w-24"} />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({
  cols,
  rows = 8,
  headers,
}: {
  cols: number;
  rows?: number;
  headers: string[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-8" aria-busy="true" aria-live="polite">
      <div>
        <Skeleton className="h-9 w-44" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-36" />
            </div>
          ))}
        </div>
      </div>
      <section>
        <Skeleton className="mb-3 h-7 w-40" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white p-6 shadow-card">
              <div className="flex justify-between gap-3">
                <div className="flex-1">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="mt-2 h-4 w-64 max-w-full" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-4 h-4 w-56" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <Skeleton className="mb-3 h-7 w-36" />
        <TableSkeleton
          cols={7}
          rows={5}
          headers={["S.No", "Automation", "Trigger", "Status", "Sent", "Failed", "When"]}
        />
      </section>
    </div>
  );
}

export function LeadsPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-28" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <TableSkeleton
        cols={11}
        rows={10}
        headers={[
          "S.No",
          "Name",
          "Email",
          "Phone",
          "College",
          "Qualification",
          "Registered",
          "Welcome",
          "Carry",
          "21 Aug",
          "22 Aug",
        ]}
      />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-64 rounded-full" />
      </div>
    </div>
  );
}

export function AutomationsIndexSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6" aria-busy="true">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-6 shadow-card">
            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex-1">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="mt-2 h-4 w-72 max-w-full" />
                <Skeleton className="mt-2 h-4 w-28" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-44" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AutomationDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          <Skeleton className="mt-2 h-3 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <TableSkeleton
        cols={8}
        rows={8}
        headers={["S.No", "Name", "Phone", "Email", "Qualification", "WhatsApp", "Email status", ""]}
      />
    </div>
  );
}
