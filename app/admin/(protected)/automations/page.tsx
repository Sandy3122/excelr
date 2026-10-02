"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AutomationOverview } from "@/lib/automations/types";
import { AutomationsIndexSkeleton } from "@/components/admin/skeleton";
import { fetchAdminJson } from "@/components/admin/fetch-json";
import { useAdminDrive, withDrive } from "@/components/admin/drive-context";

interface OverviewResponse {
  ok: boolean;
  error?: string;
  automations: AutomationOverview[];
}

export default function AutomationsIndexPage() {
  const { driveId, drive } = useAdminDrive();
  const [items, setItems] = useState<AutomationOverview[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driveId) return;
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setError("");
    (async () => {
      try {
        const json = await fetchAdminJson<OverviewResponse>(
          withDrive("/api/admin/automations", driveId),
        );
        if (!json.ok) {
          if (!cancelled) setError(json.error || "Could not load automations.");
          return;
        }
        if (!cancelled) setItems(json.automations);
      } catch {
        if (!cancelled) setError("Could not load automations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driveId]);

  if (loading) return <AutomationsIndexSkeleton />;
  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">Automations</h1>
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6">
      <ConfigPointer driveId={driveId} driveName={drive?.name} />
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">Automations</h1>
        <p className="mt-1 text-muted">
          Send WhatsApp and email in batches, and see whether each message went out.
        </p>
      </div>
      <div className="grid gap-4">
        {items.map((item) => {
          const wa = item.counts.whatsapp;
          const email = item.counts.email;
          return (
            <Link
              key={item.kind}
              href={`/admin/automations/${item.kind}`}
              className="rounded-2xl bg-white p-6 shadow-card transition hover:shadow-card-lg"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-heading text-xl font-bold">{item.title}</h2>
                  <p className="mt-1 text-sm text-muted">{item.scheduleLabel}</p>
                  <p className="mt-1 text-sm text-faint">{item.channels.join(" + ")}</p>
                </div>
                <div className="grid grid-cols-1 gap-1 text-sm sm:text-right">
                  {wa ? (
                    <div>
                      WhatsApp: <strong>{wa.sent}</strong> sent · {wa.pending} pending ·{" "}
                      {wa.failed} failed
                    </div>
                  ) : null}
                  {email ? (
                    <div>
                      Email: <strong>{email.sent}</strong> sent · {email.pending} pending ·{" "}
                      {email.failed} failed
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * This page runs automations and shows delivery; it does not configure them.
 * Two places are called "Automations" - the sidebar (this, operational) and a
 * tab on the drive (setup). Point plainly at the other one.
 */
function ConfigPointer({
  driveId,
  driveName,
}: {
  driveId: string;
  driveName?: string;
}) {
  if (!driveId) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-sm text-muted">
        This page <strong className="font-semibold text-ink">sends</strong>{" "}
        automations and shows delivery. To change{" "}
        <strong className="font-semibold text-ink">
          timing, templates or channels
        </strong>
        , edit the drive{driveName ? ` "${driveName}"` : ""}.
      </p>
      <Link
        href={`/admin/drives/${driveId}?tab=automations`}
        className="shrink-0 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
      >
        Configure automations
      </Link>
    </div>
  );
}
