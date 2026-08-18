"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { MultiSelect } from "@/components/admin/multi-select";
import { MobileToolbarButton } from "@/components/admin/mobile-toolbar-button";
import { RightDrawer } from "@/components/admin/right-drawer";
import {
  DELIVERY_FILTER_VALUES,
  EMPTY_LEAD_FILTERS,
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

const STATUS_LABELS: Record<(typeof DELIVERY_FILTER_VALUES)[number], string> = {
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
};

interface LeadFilterBarProps {
  filters: LeadFilters;
  colleges: string[];
  qualifications: string[];
  lockedKind?: AutomationKind;
  resultCount: number;
  totalCount: number;
  onChange: (next: LeadFilters) => void;
  extra?: ReactNode;
  mobileActions?: ReactNode;
}

export function LeadFilterBar({
  filters,
  colleges,
  qualifications,
  lockedKind,
  resultCount,
  totalCount,
  onChange,
  extra,
  mobileActions,
}: LeadFilterBarProps) {
  const [open, setOpen] = useState(false);
  const active = hasActiveLeadFilters(filters, lockedKind);
  const badge =
    (filters.q.trim() ? 1 : 0) +
    (filters.qualifications.length ? 1 : 0) +
    (filters.colleges.length ? 1 : 0) +
    (filters.statuses.length ? 1 : 0) +
    (!lockedKind && filters.statusKinds.length ? 1 : 0);

  const fields = (
    <FilterFields
      filters={filters}
      colleges={colleges}
      qualifications={qualifications}
      lockedKind={lockedKind}
      onChange={onChange}
    />
  );

  return (
    <div className="space-y-3">
      <div className="hidden md:block">{fields}</div>

      <div className="flex gap-2 md:hidden">
        <MobileToolbarButton
          label="Filters"
          badge={badge || undefined}
          onClick={() => setOpen(true)}
        />
        {mobileActions}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <p>
          Showing <strong className="text-ink">{resultCount}</strong> of{" "}
          {totalCount} lead{totalCount === 1 ? "" : "s"}
        </p>
        {active ? (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_LEAD_FILTERS })}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : null}
      </div>

      <RightDrawer open={open} title="Filters" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {fields}
          {extra}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-gradient w-full py-2.5 text-sm"
          >
            Done
          </button>
        </div>
      </RightDrawer>
    </div>
  );
}

function FilterFields({
  filters,
  colleges,
  qualifications,
  lockedKind,
  onChange,
}: {
  filters: LeadFilters;
  colleges: string[];
  qualifications: string[];
  lockedKind?: AutomationKind;
  onChange: (next: LeadFilters) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <label className="relative block sm:col-span-2 xl:col-span-1">
        <span className="sr-only">Search leads</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Search name, email, phone, college…"
          className="field-input py-2.5 pl-10 text-sm"
        />
      </label>
      <MultiSelect
        label="Qualification"
        placeholder="All qualifications"
        value={filters.qualifications}
        options={qualifications.map((value) => ({ value, label: value }))}
        onChange={(qualifications) => onChange({ ...filters, qualifications })}
      />
      <MultiSelect
        label="College"
        placeholder="All colleges"
        searchable
        value={filters.colleges}
        options={colleges.map((value) => ({ value, label: value }))}
        onChange={(next) => onChange({ ...filters, colleges: next })}
      />
      {lockedKind ? null : (
        <MultiSelect
          label="Automation"
          placeholder="Any message"
          value={filters.statusKinds}
          options={AUTOMATION_KINDS.map((kind) => ({
            value: kind,
            label: KIND_LABELS[kind],
          }))}
          onChange={(statusKinds) =>
            onChange({
              ...filters,
              statusKinds: statusKinds as LeadFilters["statusKinds"],
            })
          }
        />
      )}
      <MultiSelect
        label="Delivery status"
        placeholder="All statuses"
        value={filters.statuses}
        options={DELIVERY_FILTER_VALUES.map((value) => ({
          value,
          label: STATUS_LABELS[value],
        }))}
        onChange={(statuses) =>
          onChange({
            ...filters,
            statuses: statuses as LeadFilters["statuses"],
          })
        }
      />
    </div>
  );
}
