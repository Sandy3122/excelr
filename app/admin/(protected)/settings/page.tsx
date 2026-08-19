"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/fetch-json";
import { utcIsoToIstDateTime } from "@/lib/registration-window";

interface WindowResponse {
  ok: boolean;
  error?: string;
  closed?: boolean;
  closesAtIso?: string | null;
  closesAtLabel?: string | null;
}

export default function AdminSettingsPage() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [status, setStatus] = useState<WindowResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"load" | "schedule" | "close" | "open" | "">("load");

  async function load() {
    setBusy("load");
    setError("");
    try {
      const json = await fetchAdminJson<WindowResponse>("/api/admin/registration-window", {
        fresh: true,
      });
      if (!json.ok) {
        setError(json.error || "Could not load settings.");
        return;
      }
      setStatus(json);
      if (json.closesAtIso) {
        const parts = utcIsoToIstDateTime(json.closesAtIso);
        setDate(parts.date);
        setTime(parts.time);
      }
    } catch {
      setError("Could not load settings.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(action: "schedule" | "close-now" | "open") {
    if (action === "schedule" && (!date || !time)) {
      setError("Choose a date and time (IST).");
      return;
    }
    setBusy(action === "close-now" ? "close" : action === "open" ? "open" : "schedule");
    setError("");
    try {
      const res = await fetch("/api/admin/registration-window", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "schedule" ? { action, date, time } : { action },
        ),
      });
      const json = (await res.json()) as WindowResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || "Could not save settings.");
        return;
      }
      setStatus(json);
      if (json.closesAtIso) {
        const parts = utcIsoToIstDateTime(json.closesAtIso);
        setDate(parts.date);
        setTime(parts.time);
      }
    } catch {
      setError("Could not save settings.");
    } finally {
      setBusy("");
    }
  }

  const loading = busy === "load" && !status;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted sm:text-base">
          Close online registrations at a chosen IST date and time. The public
          site and form update automatically.
        </p>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-navy-900">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-bold">Registration window</h2>
            <p className="mt-1 text-sm text-muted">
              After this time, the registration form is locked and new submissions
              are rejected.
            </p>
          </div>
          {status ? (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                status.closed
                  ? "bg-red-50 text-red-800"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {status.closed ? "Closed" : "Open"}
            </span>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted">Loading settings…</p>
        ) : (
          <>
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-muted">
              {status?.closed
                ? `Online registration is closed${status.closesAtLabel ? ` since ${status.closesAtLabel}` : ""}.`
                : status?.closesAtLabel
                  ? `Registration is open, and will close at ${status.closesAtLabel}.`
                  : "Registration is open. No close time is scheduled."}
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-navy-900">
                Close date (IST)
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </label>
              <label className="block text-sm font-medium text-navy-900">
                Close time (IST)
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </label>
            </div>

            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void save("schedule")}
                className="rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "schedule" ? "Saving…" : "Schedule close"}
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  if (
                    window.confirm(
                      "Close registrations immediately on the public site?",
                    )
                  ) {
                    void save("close-now");
                  }
                }}
                className="rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-60"
              >
                {busy === "close" ? "Closing…" : "Close now"}
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || (!status?.closed && !status?.closesAtIso)}
                onClick={() => void save("open")}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy-900 disabled:opacity-60"
              >
                {busy === "open" ? "Reopening…" : "Reopen registrations"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
