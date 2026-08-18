"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDir, TableSortState } from "@/lib/admin/table-sort";

export function SortableTh<K extends string>({
  label,
  column,
  sort,
  onSort,
  className = "whitespace-nowrap px-4 py-3",
}: {
  label: string;
  column: K;
  sort: TableSortState<K>;
  onSort: (column: K) => void;
  className?: string;
}) {
  const active = sort.key === column;
  const ariaSort = active
    ? sort.dir === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-navy-900"
      >
        {label}
        <SortIcon active={active} dir={sort.dir} />
      </button>
    </th>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  const className = `h-3.5 w-3.5 ${active ? "text-navy-900" : "text-slate-400"}`;
  if (!active) return <ArrowUpDown className={className} aria-hidden />;
  if (dir === "asc") return <ArrowUp className={className} aria-hidden />;
  return <ArrowDown className={className} aria-hidden />;
}

export function TableSortSelect<K extends string>({
  options,
  sort,
  onSort,
  onClear,
}: {
  options: { key: K; label: string }[];
  sort: TableSortState<K>;
  onSort: (column: K) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted md:hidden">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0">Sort</span>
        <select
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink"
          value={sort.key ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) {
              onClear();
              return;
            }
            onSort(next as K);
          }}
        >
          <option value="">Default</option>
          {options.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {sort.key ? (
        <button
          type="button"
          onClick={() => onSort(sort.key as K)}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-ink"
          aria-label={`Sort ${sort.dir === "asc" ? "descending" : "ascending"}`}
        >
          {sort.dir === "asc" ? "A–Z" : "Z–A"}
        </button>
      ) : null}
    </div>
  );
}
