"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import { useAdminDrive, withDrive } from "./drive-context";

interface LeadsResponse {
  ok: boolean;
  error?: string;
  registrations: StoredRegistration[];
  nextCursor: string | null;
  total?: number;
}

/**
 * Leads for one drive, loaded in batches. The first batch loads on entry; the
 * next is fetched fresh from the server when the user reaches the end of what
 * is loaded. The batch size is the drive's `leadFetchSize` setting.
 */
export function useLeadBatches() {
  const { driveId, drive } = useAdminDrive();
  const batchSize = drive?.leadFetchSize;
  const [leads, setLeads] = useState<StoredRegistration[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // Bumped on every reset so a slow response for an old drive/size is dropped.
  const generation = useRef(0);
  const cursorRef = useRef<string | null>(null);
  const busyMore = useRef(false);

  const fetchBatch = useCallback(
    async (cursor: string | null) => {
      const qs = new URLSearchParams({ limit: String(batchSize) });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(withDrive(`/api/admin/leads?${qs.toString()}`, driveId), {
        cache: "no-store",
      });
      const json = (await res.json()) as LeadsResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not load leads.");
      return json;
    },
    [driveId, batchSize],
  );

  const reload = useCallback(async () => {
    const gen = ++generation.current;
    busyMore.current = false;
    setLoadingMore(false);
    if (!driveId || !batchSize) return;
    setLoading(true);
    setError("");
    try {
      const json = await fetchBatch(null);
      if (gen !== generation.current) return;
      setLeads(json.registrations);
      setTotal(json.total ?? json.registrations.length);
      cursorRef.current = json.nextCursor;
      setNextCursor(json.nextCursor);
    } catch (err) {
      if (gen !== generation.current) return;
      setLeads([]);
      cursorRef.current = null;
      setNextCursor(null);
      setError(err instanceof Error ? err.message : "Could not load leads.");
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, [driveId, batchSize, fetchBatch]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor || busyMore.current) return;
    busyMore.current = true;
    setLoadingMore(true);
    const gen = generation.current;
    try {
      const json = await fetchBatch(cursor);
      if (gen !== generation.current) return;
      setLeads((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...json.registrations.filter((l) => !seen.has(l.id))];
      });
      cursorRef.current = json.nextCursor;
      setNextCursor(json.nextCursor);
    } catch (err) {
      if (gen === generation.current) {
        setError(err instanceof Error ? err.message : "Could not load more leads.");
      }
    } finally {
      if (gen === generation.current) {
        busyMore.current = false;
        setLoadingMore(false);
      }
    }
  }, [fetchBatch]);

  useEffect(() => {
    // Empty the list straight away so another drive's leads never linger.
    setLeads([]);
    setNextCursor(null);
    cursorRef.current = null;
    void reload();
  }, [reload]);

  return { leads, total, hasMore: nextCursor !== null, loading, loadingMore, error, reload, loadMore };
}
