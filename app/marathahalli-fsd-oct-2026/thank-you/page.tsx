import type { Metadata } from "next";
import RegThankYou from "@/components/reg/reg-thank-you";
import { MARATHAHALLI_FSD_OCT_2026 } from "@/lib/events/marathahalli-fsd-oct-2026";

export const metadata: Metadata = MARATHAHALLI_FSD_OCT_2026.thankYou.meta;

export default function ThankYouPage({
  searchParams,
}: {
  searchParams?: { name?: string };
}) {
  return (
    <RegThankYou
      config={MARATHAHALLI_FSD_OCT_2026}
      name={searchParams?.name}
    />
  );
}
