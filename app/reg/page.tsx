import type { Metadata } from "next";
import RegLanding from "@/components/reg/reg-landing";
import { getRegistrationWindowStatus } from "@/lib/registration-window-store";

export const metadata: Metadata = {
  title: "Register — ExcelR's Java Full Stack Placement Drive",
  description:
    "Secure your spot at ExcelR's Java Full Stack Placement Drive on 22nd August 2026, Marathahalli Campus, Bengaluru. Absolutely free for all.",
};

export const dynamic = "force-dynamic";

// Public, standalone page — no app chrome (no nav / sidebar / auth gate).
export default async function RegPage() {
  const windowStatus = await getRegistrationWindowStatus();
  return (
    <RegLanding
      closed={windowStatus.closed}
      closesAtIso={windowStatus.closesAtIso}
    />
  );
}
