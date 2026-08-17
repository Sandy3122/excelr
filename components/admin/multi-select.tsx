"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchable?: boolean;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  searchable = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggle(optionValue: string) {
    if (selected.has(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((opt) => opt.value === value[0])?.label || placeholder
        : `${value.length} selected`;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className="field-input flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm"
      >
        <span className={`min-w-0 truncate ${value.length ? "text-ink" : "text-faint"}`}>
          {summary}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-faint transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 w-full min-w-[16rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-card-lg">
          {searchable && options.length > 8 ? (
            <label className="relative mb-2 block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </label>
          ) : null}
          <div className="mb-1 flex items-center justify-between px-1 text-xs">
            <button
              type="button"
              className="font-semibold text-brand-blue hover:underline"
              onClick={() => onChange(options.map((opt) => opt.value))}
            >
              Select all
            </button>
            {value.length > 0 ? (
              <button
                type="button"
                className="font-semibold text-muted hover:underline"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            ) : null}
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-56 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">No matches</li>
            ) : (
              filtered.map((opt) => {
                const checked = selected.has(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(opt.value)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-brand-blue bg-brand-blue text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 truncate">{opt.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
