"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQS } from "@/lib/reg-content";

/** Accordion (spec §3.4). First item expanded by default. */
export default function RegFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-gradient-to-b from-page to-[#E8EDFF]/60 py-16 md:py-20">
      <div className="mx-auto max-w-faq px-6">
        <div className="text-center">
          <h2 className="font-heading text-[30px] font-bold leading-tight text-ink md:text-[36px]">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 font-body text-[16px] text-muted md:text-[18px]">
            Everything you need to know before you register.
          </p>
        </div>

        <div className="mt-10 space-y-4">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left md:px-6 md:py-5"
                >
                  <span className="font-heading text-[16px] font-semibold text-ink md:text-[17px]">
                    {item.q}
                  </span>
                  {/* chevron inside a circle — filled blue when open, faint when closed */}
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors ${
                      isOpen ? "bg-brand-blue text-white" : "bg-tint2 text-brand-blue"
                    }`}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      strokeWidth={2.5}
                    />
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="bg-[#EEF2FF]/80 px-5 pb-5 pt-1 font-body text-[15px] leading-[1.65] text-muted md:px-6">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
