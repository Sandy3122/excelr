import type { Metadata } from "next";
import RegLanding from "@/components/reg/reg-landing";
import { DEFAULT_REG_EVENT as CONFIG } from "@/lib/reg-event";
import { getRegistrationWindowStatusForSlug } from "@/lib/registration-window-store";

export const metadata: Metadata = CONFIG.meta;

export const dynamic = "force-dynamic";

// Public, standalone page — no app chrome (no nav / sidebar / auth gate).
export default async function RegPage() {
  // The drive document owns the close time; the page only names its drive.
  const status = await getRegistrationWindowStatusForSlug(CONFIG.driveSlug);

  return (
    <RegLanding
      config={CONFIG}
      closed={status.closed}
      closesAtIso={status.closesAtIso}
    />
  );
}
