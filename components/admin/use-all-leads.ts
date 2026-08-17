"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoredRegistration } from "@/lib/firebase/registration-types";

interface LeadsResponse {
  ok: boolean;
  error?: string;
  registrations: StoredRegistration[];
  total?: number;
}

let memoryCache: { leads: StoredRegistration[]; at: number } | null = null;
const CACHE_MS = 15_000;

export function invalidateLeadsCache() {
  memoryCache = null;
}

export function useAllLeads() {
  const [leads, setLeads] = useState<StoredRegistration[]>(
    memoryCache?.leads ?? [],
  );
  const [loading, setLoading] = useState(!memoryCache);
  const [error, setError] = useState("");

  const load = useCallback(async (fresh = false) => {
    if (
      !fresh &&
      memoryCache &&
      Date.now() - memoryCache.at < CACHE_MS
    ) {
      setLeads(memoryCache.leads);
      setLoading(false);
      setError("");
      return memoryCache.leads;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/leads?all=1");
      const json = (await res.json()) as LeadsResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Could not load leads.");
      }
      memoryCache = { leads: json.registrations, at: Date.now() };
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
  }, []);

  useEffect(() => {
    void load().catch(() => {
      /* error is stored on state */
    });
  }, [load]);

  return { leads, loading, error, reload: load, setLeads };
}
