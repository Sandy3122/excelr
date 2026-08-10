"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQS } from "@/lib/reg-content";

/** FAQ accordion — matches Figma FAQ frame (first item open by default). */
export default function RegFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-[#F0F3FF] py-16 md:py-20">
      <div className="mx-auto max-w-faq px-6">
        <div className="text-center">
          <h2 className="font-heading text-[30px] font-bold leading-tight text-ink md:text-[36px]">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 font-body text-[16px] text-muted md:text-[18px]">
            Everything you need to know before you register.
          </p>
        </div>

        <div className="mt-10 space-y-4 md:space-y-5">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(15,23,43,0.06)]"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-7 md:py-6"
                >
                  <span className="font-heading text-[15px] font-semibold leading-snug text-ink md:text-[17px]">
                    {item.q}
                  </span>
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors md:h-9 md:w-9 ${
                      isOpen
                        ? "bg-[#3B82F6] text-white"
                        : "bg-[#EEF2FF] text-[#3B82F6]"
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
                    <p className="px-5 pb-6 font-body text-[14px] leading-[1.7] text-muted md:px-7 md:pb-7 md:text-[15px]">
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
