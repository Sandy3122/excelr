"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import { useAdminDrive, withDrive } from "./drive-context";

interface LeadsResponse {
  ok: boolean;
  error?: string;
  registrations: StoredRegistration[];
  total?: number;
}

/** Cached per drive - one campaign's leads must never be served for another. */
let memoryCache: { driveId: string; leads: StoredRegistration[]; at: number } | null =
  null;
const CACHE_MS = 15_000;

export function invalidateLeadsCache() {
  memoryCache = null;
}

export function useAllLeads() {
  const { driveId } = useAdminDrive();
  const [leads, setLeads] = useState<StoredRegistration[]>(
    memoryCache?.driveId === driveId ? memoryCache.leads : [],
  );
  const [loading, setLoading] = useState(!(memoryCache?.driveId === driveId));
  const [error, setError] = useState("");

  const load = useCallback(async (fresh = false) => {
    if (!driveId) {
      setLeads([]);
      setLoading(false);
      return [];
    }
    const cached = memoryCache?.driveId === driveId ? memoryCache : null;
    if (cached) {
      // Show what we already have straight away; refresh quietly if it is old.
      setLeads(cached.leads);
      setLoading(false);
      setError("");
      if (!fresh && Date.now() - cached.at < CACHE_MS) return cached.leads;
    } else {
      // Never leave another drive's leads on screen while this one loads.
      setLeads([]);
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch(withDrive("/api/admin/leads?all=1", driveId));
      const json = (await res.json()) as LeadsResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Could not load leads.");
      }
      memoryCache = { driveId, leads: json.registrations, at: Date.now() };
      setLeads(json.registrations);
      return json.registrations;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load leads.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [driveId]);

  useEffect(() => {
    void load().catch(() => {
      /* error is stored on state */
    });
  }, [load]);

  return { leads, loading, error, reload: load, setLeads };
}
