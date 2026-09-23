import type { Metadata } from "next";
import RegLanding from "@/components/reg/reg-landing";
import { MARATHAHALLI_FSD_OCT_2026 as CONFIG } from "@/lib/events/marathahalli-fsd-oct-2026";
import { getRegistrationWindowStatus } from "@/lib/registration-window-store";

export const metadata: Metadata = CONFIG.meta;

export const dynamic = "force-dynamic";

// Public, standalone page — no app chrome (no nav / sidebar / auth gate).
export default async function MarathahalliFsdOct2026Page() {
  const status =
    CONFIG.registrationWindow === "global"
      ? await getRegistrationWindowStatus()
      : { closed: false, closesAtIso: null };

  return (
    <RegLanding
      config={CONFIG}
      closed={status.closed}
      closesAtIso={status.closesAtIso}
    />
  );
}
