"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

/**
 * Cursor pagination with a page→cursor cache so Previous / numbered pages work
 * without Firestore offsets.
 */
export function useCursorPagination<T>(
  loadPage: (cursor: string | undefined, pageSize: number) => Promise<CursorPage<T>>,
  initialPageSize = 25,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cursorsRef = useRef<Record<number, string | undefined>>({ 1: undefined });
  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  const fetchPage = useCallback(
    async (targetPage: number, size: number) => {
      setLoading(true);
      setError("");
      try {
        const known = Object.keys(cursorsRef.current)
          .map(Number)
          .filter((n) => n <= targetPage && n in cursorsRef.current)
          .sort((a, b) => b - a);
        let walk = known[0] || 1;
        if (!(walk in cursorsRef.current)) {
          cursorsRef.current[1] = undefined;
          walk = 1;
        }

        let last: CursorPage<T> | null = null;
        for (let p = walk; p <= targetPage; p++) {
          const cursor = cursorsRef.current[p];
          last = await loadPageRef.current(cursor, size);
          if (last.nextCursor) {
            cursorsRef.current[p + 1] = last.nextCursor;
          }
          if (!last.nextCursor && p < targetPage) {
            targetPage = p;
            break;
          }
        }
        if (!last) return;
        setItems(last.items);
        setTotal(last.total);
        setNextCursor(last.nextCursor);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this page.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    cursorsRef.current = { 1: undefined };
    void fetchPage(1, pageSize);
  }, [fetchPage, pageSize]);

  const goToPage = useCallback(
    (n: number) => {
      if (n < 1 || loading) return;
      void fetchPage(n, pageSize);
    },
    [fetchPage, loading, pageSize],
  );

  const changePageSize = useCallback((size: number) => {
    cursorsRef.current = { 1: undefined };
    setPage(1);
    setPageSize(size);
  }, []);

  const reload = useCallback(() => {
    cursorsRef.current = { 1: undefined };
    void fetchPage(page, pageSize);
  }, [fetchPage, page, pageSize]);

  return {
    page,
    pageSize,
    items,
    total,
    nextCursor,
    loading,
    error,
    hasNext: Boolean(nextCursor),
    goToPage,
    changePageSize,
    reload,
    setError,
  };
}
