import type { Metadata } from "next";
import RegThankYou from "@/components/reg/reg-thank-you";
import { DEFAULT_REG_EVENT } from "@/lib/reg-event";

export const metadata: Metadata = DEFAULT_REG_EVENT.thankYou.meta;

/** Post-registration confirmation page shown after a successful form submit. */
export default function ThankYouPage({
  searchParams,
}: {
  searchParams?: { name?: string };
}) {
  return <RegThankYou config={DEFAULT_REG_EVENT} name={searchParams?.name} />;
}
