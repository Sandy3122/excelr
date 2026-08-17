"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export interface SendProgressState {
  open: boolean;
  title: string;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  batch: number;
  batchCount: number;
  error: string;
  done: boolean;
}

export const EMPTY_SEND_PROGRESS: SendProgressState = {
  open: false,
  title: "",
  total: 0,
  processed: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  batch: 0,
  batchCount: 0,
  error: "",
  done: false,
};

export function SendProgressModal({
  progress,
  onClose,
}: {
  progress: SendProgressState;
  onClose: () => void;
}) {
  if (!progress.open) return null;

  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;
  const remaining = Math.max(0, progress.total - progress.processed);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-progress-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card-lg">
        <div className="flex items-start gap-3">
          {progress.done && !progress.error ? (
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          ) : progress.error ? (
            <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
          ) : (
            <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-brand-blue" />
          )}
          <div className="min-w-0 flex-1">
            <h2
              id="send-progress-title"
              className="font-heading text-lg font-bold text-navy-900"
            >
              {progress.done
                ? progress.error
                  ? "Send stopped"
                  : "Messages sent"
                : progress.title}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {progress.done
                ? progress.error ||
                  `Finished ${progress.processed} of ${progress.total} lead${
                    progress.total === 1 ? "" : "s"
                  }.`
                : progress.batchCount > 1
                  ? `Batch ${progress.batch} of ${progress.batchCount} · ${remaining} remaining`
                  : `${remaining} remaining`}
            </p>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              progress.error ? "bg-red-500" : "bg-brand-blue"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-ink">{pct}% complete</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs text-muted">Processed</dt>
            <dd className="font-semibold">
              {progress.processed}/{progress.total}
            </dd>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <dt className="text-xs text-emerald-800">Sent</dt>
            <dd className="font-semibold text-emerald-900">{progress.sent}</dd>
          </div>
          <div className="rounded-xl bg-red-50 px-3 py-2">
            <dt className="text-xs text-red-800">Failed</dt>
            <dd className="font-semibold text-red-900">{progress.failed}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs text-muted">Skipped</dt>
            <dd className="font-semibold">{progress.skipped}</dd>
          </div>
        </dl>

        {progress.done ? (
          <button
            type="button"
            onClick={onClose}
            className="btn-gradient mt-6 w-full py-2.5 text-sm"
          >
            Close
          </button>
        ) : (
          <p className="mt-5 text-center text-xs text-faint">
            Keep this window open while batches go out.
          </p>
        )}
      </div>
    </div>
  );
}
