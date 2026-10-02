"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { useAdminDrive } from "@/components/admin/drive-context";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * All placement drives. Creating one here is what makes a landing page's slug
 * live - the page itself stays in code and only names the drive it belongs to.
 */
export default function DrivesPage() {
  const router = useRouter();
  const { drives, loading, error, reload, setDriveId } = useAdminDrive();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [eventDay, setEventDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError("");

    if (!SLUG_RE.test(slug)) {
      setFormError("Path must be lowercase letters, numbers and dashes.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/drives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          eventDayIstDate: eventDay || null,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        drive?: { id: string };
      };
      if (!res.ok || !json.ok || !json.drive) {
        throw new Error(json.error || "Could not create the drive.");
      }
      await reload();
      setDriveId(json.drive.id);
      router.push(`/admin/drives/${json.drive.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the drive.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-900">
            Placement Drives
          </h1>
          <p className="mt-1 text-sm text-muted">
            Each drive owns its own leads, automations, templates and limits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          New drive
        </button>
      </div>

      {open ? (
        <form
          onSubmit={create}
          className="mt-5 space-y-4 rounded-2xl bg-white p-5 shadow-card"
        >
          <div>
            <label className="field-label mb-1.5" htmlFor="drive-name">
              Drive name
            </label>
            <input
              id="drive-name"
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Stack Placement Drive - BTM, Oct 2026"
              required
              minLength={2}
            />
          </div>

          <div>
            <label className="field-label mb-1.5" htmlFor="drive-slug">
              Landing page path
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">/</span>
              <input
                id="drive-slug"
                className="field-input"
                value={slug}
                onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
                placeholder="bangalore-java-nov-2026"
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Must match the <code>driveSlug</code> of the landing page in code.
            </p>
          </div>

          <div>
            <label className="field-label mb-1.5" htmlFor="drive-event-day">
              Event day (IST)
            </label>
            <input
              id="drive-event-day"
              type="date"
              className="field-input"
              value={eventDay}
              onChange={(e) => setEventDay(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">
              Seeds the reminder schedules and the things-to-carry cutoff.
            </p>
          </div>

          {formError ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="btn-gradient px-6 py-3 text-sm disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create drive"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {loading && drives.length === 0 ? (
          <div className="h-20 animate-pulse rounded-2xl bg-white" />
        ) : null}

        {drives.map((drive) => (
          <Link
            key={drive.id}
            href={`/admin/drives/${drive.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-card transition hover:shadow-card-lg"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading font-semibold text-navy-900">
                  {drive.name}
                </span>
                {!drive.enabled ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-muted">
                    Disabled
                  </span>
                ) : null}
                {drive.issues?.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="h-3 w-3" />
                    {drive.issues.length} to fix
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-sm text-muted">
                /{drive.slug}
                {drive.eventDayIstDate ? ` · ${drive.eventDayIstDate}` : ""}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
          </Link>
        ))}

        {!loading && drives.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-muted shadow-card">
            No placement drives yet. Create one whose path matches a landing
            page&apos;s <code>driveSlug</code> to start collecting registrations.
          </p>
        ) : null}
      </div>
    </div>
  );
}
