"use client";

import { Search, X } from "lucide-react";
import {
  EMPTY_LEAD_FILTERS,
  QUALIFICATION_FILTER_OPTIONS,
  hasActiveLeadFilters,
  type LeadFilters,
} from "@/lib/admin/lead-filters";
import { AUTOMATION_KINDS, type AutomationKind } from "@/lib/automations/types";

const KIND_LABELS: Record<AutomationKind, string> = {
  welcome: "Welcome",
  things_to_carry: "Things to carry",
  reminder_day_before: "Reminder 21 Aug",
  reminder_event_day: "Reminder 22 Aug",
};

const SELECT_CLASS = "field-input py-2.5 pr-8 text-sm";

interface LeadFilterBarProps {
  filters: LeadFilters;
  colleges: string[];
  lockedKind?: AutomationKind;
  resultCount: number;
  totalCount: number;
  onChange: (next: LeadFilters) => void;
}

export function LeadFilterBar({
  filters,
  colleges,
  lockedKind,
  resultCount,
  totalCount,
  onChange,
}: LeadFilterBarProps) {
  const active = hasActiveLeadFilters(
    lockedKind ? { ...filters, statusKind: "" } : filters,
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="relative block sm:col-span-2 lg:col-span-1 xl:col-span-1">
          <span className="sr-only">Search leads</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Search name, email, phone, college…"
            className="field-input py-2.5 pl-10 text-sm"
          />
        </label>
        <label className="block">
          <span className="sr-only">Qualification</span>
          <select
            value={filters.qualification}
            onChange={(e) =>
              onChange({ ...filters, qualification: e.target.value })
            }
            className={SELECT_CLASS}
          >
            <option value="">All qualifications</option>
            {QUALIFICATION_FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">College</span>
          <select
            value={filters.college}
            onChange={(e) => onChange({ ...filters, college: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">All colleges</option>
            {colleges.map((college) => (
              <option key={college} value={college}>
                {college}
              </option>
            ))}
          </select>
        </label>
        {lockedKind ? null : (
          <label className="block">
            <span className="sr-only">Automation</span>
            <select
              value={filters.statusKind}
              onChange={(e) =>
                onChange({
                  ...filters,
                  statusKind: e.target.value as LeadFilters["statusKind"],
                })
              }
              className={SELECT_CLASS}
            >
              <option value="">Any message</option>
              {AUTOMATION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="sr-only">Delivery status</span>
          <select
            value={filters.status}
            onChange={(e) =>
              onChange({
                ...filters,
                status: e.target.value as LeadFilters["status"],
              })
            }
            className={SELECT_CLASS}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <p>
          Showing <strong className="text-ink">{resultCount}</strong> of{" "}
          {totalCount} lead{totalCount === 1 ? "" : "s"}
        </p>
        {active ? (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...EMPTY_LEAD_FILTERS,
                statusKind: lockedKind ? filters.statusKind : "",
              })
            }
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
