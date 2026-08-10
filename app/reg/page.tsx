import type { Metadata } from "next";
import RegLanding from "@/components/reg/reg-landing";

export const metadata: Metadata = {
  title: "Register — ExcelR's Java Full Stack Placement Drive",
  description:
    "Secure your spot at ExcelR's Java Full Stack Placement Drive on 22nd August 2026, Marathahalli Campus, Bengaluru. Absolutely free for all.",
};

// Public, standalone page — no app chrome (no nav / sidebar / auth gate).
export default function RegPage() {
  return <RegLanding />;
}
