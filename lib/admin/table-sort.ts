export type SortDir = "asc" | "desc";

export interface TableSortState<K extends string = string> {
  key: K | null;
  dir: SortDir;
}

export function emptyTableSort<K extends string>(): TableSortState<K> {
  return { key: null, dir: "asc" };
}

export function nextTableSort<K extends string>(
  current: TableSortState<K>,
  key: K,
): TableSortState<K> {
  if (current.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key, dir: "asc" };
}

function compareUnknown(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

export function sortRows<T, K extends string>(
  rows: T[],
  sort: TableSortState<K>,
  valueOf: (row: T, key: K) => unknown,
): T[] {
  if (!sort.key) return rows;
  const key = sort.key;
  const copy = [...rows];
  copy.sort((left, right) => {
    const cmp = compareUnknown(valueOf(left, key), valueOf(right, key));
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return copy;
}

const STATUS_RANK: Record<string, number> = {
  failed: 0,
  pending: 1,
  sending: 2,
  skipped: 3,
  sent: 4,
  legacy: 5,
};

export function statusSortValue(status: string | null | undefined): number {
  if (!status) return 1;
  return STATUS_RANK[status] ?? 99;
}

export function dateSortValue(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}
