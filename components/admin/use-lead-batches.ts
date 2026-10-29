"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import { useAdminDrive, withDrive } from "./drive-context";

interface LeadsResponse {
  ok: boolean;
  error?: string;
  registrations: StoredRegistration[];
  nextCursor?: string | null;
  total?: number;
  truncated?: boolean;
  serverTime?: string;
}

interface Snapshot {
  leads: StoredRegistration[];
  total: number;
  nextCursor: string | null;
  /** Server time of the last successful sync; the next refresh asks for changes after it. */
  syncedAt: string | null;
}

/**
 * Per-drive leads survive tab switches: coming back to the Leads page paints
 * the last-known list instantly, then a quiet incremental refresh brings in
 * only what changed. Lives for the browser session (module scope).
 */
const snapshots = new Map<string, Snapshot>();

/** Overlap so a lead written while we were syncing is never missed. */
const SYNC_OVERLAP_MS = 10_000;
/** Safety cap on background loading; past it, batches load on demand. */
const AUTO_LOAD_CAP = 10_000;

function leadTime(l: StoredRegistration): number {
  const t = Date.parse(l.submittedAt || l.submittedAtIso || "");
  return Number.isFinite(t) ? t : 0;
}

function mergeLeads(
  current: StoredRegistration[],
  incoming: StoredRegistration[],
): StoredRegistration[] {
  const byId = new Map(current.map((l) => [l.id, l]));
  for (const l of incoming) byId.set(l.id, l);
  return [...byId.values()].sort((a, b) => leadTime(b) - leadTime(a));
}

export function forgetLeadSnapshots() {
  snapshots.clear();
}

/**
 * Leads for one drive, loaded in batches (`leadFetchSize` per request). The
 * first batch makes the page usable, the rest stream in silently, and
 * `refresh()` fetches only new or changed leads.
 */
export function useLeadBatches() {
  const { driveId, drive } = useAdminDrive();
  const batchSize = drive?.leadFetchSize;
  const initial = driveId ? snapshots.get(driveId) : undefined;

  const [leads, setLeads] = useState<StoredRegistration[]>(initial?.leads ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [nextCursor, setNextCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [loading, setLoading] = useState(!initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Bumped on every reset so a slow response for an old drive/size is dropped.
  const generation = useRef(0);
  const cursorRef = useRef<string | null>(initial?.nextCursor ?? null);
  const syncedAtRef = useRef<string | null>(initial?.syncedAt ?? null);
  const leadsRef = useRef<StoredRegistration[]>(initial?.leads ?? []);
  const busyMore = useRef(false);
  const busyRefresh = useRef(false);

  const commit = useCallback(
    (next: { leads?: StoredRegistration[]; total?: number; cursor?: string | null }) => {
      if (next.leads) {
        leadsRef.current = next.leads;
        setLeads(next.leads);
      }
      if (next.total !== undefined) setTotal(next.total);
      if (next.cursor !== undefined) {
        cursorRef.current = next.cursor;
        setNextCursor(next.cursor);
      }
      if (driveId) {
        snapshots.set(driveId, {
          leads: leadsRef.current,
          total: next.total ?? snapshots.get(driveId)?.total ?? leadsRef.current.length,
          nextCursor: cursorRef.current,
          syncedAt: syncedAtRef.current,
        });
      }
    },
    [driveId],
  );

  const fetchBatch = useCallback(
    async (params: Record<string, string>) => {
      const qs = new URLSearchParams(params);
      const res = await fetch(withDrive(`/api/admin/leads?${qs.toString()}`, driveId), {
        cache: "no-store",
      });
      const json = (await res.json()) as LeadsResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not load leads.");
      return json;
    },
    [driveId],
  );

  /** Full (re)load of the first batch. `silent` keeps the current list on screen. */
  const reload = useCallback(
    async (silent = false) => {
      const gen = ++generation.current;
      busyMore.current = false;
      setLoadingMore(false);
      if (!driveId || !batchSize) return;
      if (!silent) setLoading(true);
      setError("");
      try {
        const json = await fetchBatch({ limit: String(batchSize) });
        if (gen !== generation.current) return;
        syncedAtRef.current = json.serverTime ?? new Date().toISOString();
        commit({
          leads: json.registrations,
          total: json.total ?? json.registrations.length,
          cursor: json.nextCursor ?? null,
        });
      } catch (err) {
        if (gen !== generation.current) return;
        if (!silent) commit({ leads: [], cursor: null, total: 0 });
        setError(err instanceof Error ? err.message : "Could not load leads.");
      } finally {
        if (gen === generation.current) setLoading(false);
      }
    },
    [driveId, batchSize, fetchBatch, commit],
  );

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor || !batchSize || busyMore.current) return;
    busyMore.current = true;
    setLoadingMore(true);
    setError("");
    const gen = generation.current;
    try {
      const json = await fetchBatch({ limit: String(batchSize), cursor });
      if (gen !== generation.current) return;
      const seen = new Set(leadsRef.current.map((l) => l.id));
      commit({
        leads: [...leadsRef.current, ...json.registrations.filter((l) => !seen.has(l.id))],
        cursor: json.nextCursor ?? null,
      });
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
  }, [batchSize, fetchBatch, commit]);

  /**
   * Incremental refresh: asks only for leads that are new or changed since the
   * last sync and merges them in. If the live total disagrees with what we hold
   * (a lead was deleted elsewhere, or too much changed) it falls back to a
   * quiet full reload.
   */
  const refresh = useCallback(async () => {
    if (!driveId || busyRefresh.current) return;
    const since = syncedAtRef.current;
    if (!since) {
      await reload(true);
      return;
    }
    busyRefresh.current = true;
    setRefreshing(true);
    const gen = generation.current;
    try {
      const sinceIso = new Date(Date.parse(since) - SYNC_OVERLAP_MS).toISOString();
      const json = await fetchBatch({ since: sinceIso });
      if (gen !== generation.current) return;
      if (json.truncated) {
        await reload(true);
        return;
      }
      const merged = mergeLeads(leadsRef.current, json.registrations);
      syncedAtRef.current = json.serverTime ?? new Date().toISOString();
      const complete = cursorRef.current === null;
      // A complete list must match the live count; otherwise something was deleted.
      if (complete && json.total !== undefined && merged.length !== json.total) {
        await reload(true);
        return;
      }
      commit({ leads: merged, total: json.total ?? merged.length });
    } catch (err) {
      if (gen === generation.current) {
        setError(err instanceof Error ? err.message : "Could not refresh leads.");
      }
    } finally {
      busyRefresh.current = false;
      setRefreshing(false);
    }
  }, [driveId, fetchBatch, reload, commit]);

  /** Drop a just-deleted lead from the list and the snapshot without refetching. */
  const removeLead = useCallback(
    (id: string) => {
      commit({
        leads: leadsRef.current.filter((l) => l.id !== id),
        total: Math.max(0, (snapshots.get(driveId)?.total ?? 1) - 1),
      });
    },
    [commit, driveId],
  );

  // On entering the page or switching drive: show the snapshot instantly (if
  // any) and bring it up to date in the background.
  useEffect(() => {
    if (!driveId || !batchSize) return;
    const snap = snapshots.get(driveId);
    if (snap) {
      leadsRef.current = snap.leads;
      cursorRef.current = snap.nextCursor;
      syncedAtRef.current = snap.syncedAt;
      setLeads(snap.leads);
      setTotal(snap.total);
      setNextCursor(snap.nextCursor);
      setLoading(false);
      void refresh();
    } else {
      leadsRef.current = [];
      cursorRef.current = null;
      syncedAtRef.current = null;
      setLeads([]);
      setTotal(0);
      setNextCursor(null);
      void reload();
    }
    // `refresh`/`reload` change identity with the drive and batch size only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveId, batchSize]);

  // Keep pulling batches quietly until everything is loaded, so search and
  // filters end up covering every lead. Stops on error and past the cap.
  useEffect(() => {
    if (nextCursor && !loading && !loadingMore && !error && leads.length < AUTO_LOAD_CAP) {
      void loadMore();
    }
  }, [nextCursor, loading, loadingMore, error, leads.length, loadMore]);

  return {
    leads,
    total,
    hasMore: nextCursor !== null,
    loading,
    loadingMore,
    refreshing,
    error,
    reload: () => reload(false),
    refresh,
    loadMore,
    removeLead,
  };
}
