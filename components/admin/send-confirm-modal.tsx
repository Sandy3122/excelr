"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

export interface SendConfirmState {
  open: boolean;
  title: string;
  body: string;
  count: number;
  supportsEmail: boolean;
}

export const EMPTY_SEND_CONFIRM: SendConfirmState = {
  open: false,
  title: "",
  body: "",
  count: 0,
  supportsEmail: false,
};

export function SendConfirmModal({
  confirm,
  onCancel,
  onConfirm,
}: {
  confirm: SendConfirmState;
  onCancel: () => void;
  onConfirm: (includeEmail: boolean) => void;
}) {
  const [includeEmail, setIncludeEmail] = useState(false);

  useEffect(() => {
    if (confirm.open) setIncludeEmail(false);
  }, [confirm.open, confirm.title]);

  if (!confirm.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-card-lg sm:p-6">
        <h2
          id="send-confirm-title"
          className="font-heading text-lg font-bold text-navy-900"
        >
          {confirm.title}
        </h2>
        <p className="mt-2 text-sm text-muted">{confirm.body}</p>
        <p className="mt-3 text-sm font-semibold text-ink">
          {confirm.count} lead{confirm.count === 1 ? "" : "s"}
        </p>

        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-medium text-ink">WhatsApp will be sent</p>
          {confirm.supportsEmail ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white px-3 py-2.5 ring-1 ring-slate-200">
              <input
                type="checkbox"
                checked={includeEmail}
                onChange={(e) => setIncludeEmail(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
              />
              <span>
                <span className="flex items-center gap-1.5 font-semibold text-navy-900">
                  <Mail className="h-4 w-4" />
                  Also send email
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Optional. Leave unchecked to send WhatsApp only.
                </span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-faint">This automation does not have an email.</p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setIncludeEmail(false);
              onCancel();
            }}
            className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const sendEmail = confirm.supportsEmail && includeEmail;
              setIncludeEmail(false);
              onConfirm(sendEmail);
            }}
            className="btn-gradient py-2.5 text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
