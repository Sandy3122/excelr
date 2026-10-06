"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { AutomationKind, Channel } from "@/lib/automations/types";

export interface DriveSummary {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  archived: boolean;
  eventDayIstDate: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  allowLeadDeletion: boolean;
  leadFetchSize: number;
  /** Per-automation channels, so the UI never guesses which kinds send email. */
  automations: Record<AutomationKind, { enabled: boolean; channels: Channel[] }>;
  issues?: string[];
}

interface DriveContextValue {
  drives: DriveSummary[];
  driveId: string;
  drive: DriveSummary | null;
  loading: boolean;
  error: string;
  setDriveId: (id: string) => void;
  reload: () => Promise<void>;
}

const SELECTED_KEY = "excelr-admin-drive";

const DriveContext = createContext<DriveContextValue>({
  drives: [],
  driveId: "",
  drive: null,
  loading: true,
  error: "",
  setDriveId: () => {},
  reload: async () => {},
});

/**
 * The selected placement drive is the dashboard's active context. Every admin
 * page reads it from here and every admin request carries it, so switching
 * drives re-scopes the whole dashboard rather than just the UI.
 */
export function AdminDriveProvider({ children }: { children: React.ReactNode }) {
  const [drives, setDrives] = useState<DriveSummary[]>([]);
  const [driveId, setDriveIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/drives", { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        drives?: DriveSummary[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Could not load placement drives.");
      }
      const list = json.drives || [];
      setDrives(list);

      // Keep the previous selection when it still exists, otherwise fall back
      // to the first drive so the dashboard is never in a null context.
      setDriveIdState((current) => {
        const stored =
          current ||
          (typeof window !== "undefined"
            ? window.localStorage.getItem(SELECTED_KEY) || ""
            : "");
        if (stored && list.some((d) => d.id === stored)) return stored;
        return list[0]?.id || "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load drives.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setDriveId = useCallback((id: string) => {
    setDriveIdState(id);
    try {
      window.localStorage.setItem(SELECTED_KEY, id);
    } catch {
      /* private mode */
    }
    // Cached admin payloads are per-URL and every URL carries the drive id, so
    // switching drives cannot serve another campaign's cached data.
  }, []);

  const value = useMemo<DriveContextValue>(
    () => ({
      drives,
      driveId,
      drive: drives.find((d) => d.id === driveId) ?? null,
      loading,
      error,
      setDriveId,
      reload,
    }),
    [drives, driveId, loading, error, setDriveId, reload],
  );

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
}

export function useAdminDrive(): DriveContextValue {
  return useContext(DriveContext);
}

/** Append the active drive to an admin API URL. */
export function withDrive(url: string, driveId: string): string {
  if (!driveId) return url;
  return url + (url.includes("?") ? "&" : "?") + `driveId=${encodeURIComponent(driveId)}`;
}
