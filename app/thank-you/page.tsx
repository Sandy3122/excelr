import type { Metadata } from "next";
import RegThankYou from "@/components/reg/reg-thank-you";

export const metadata: Metadata = {
  title: "Thank You — ExcelR Placement Drive",
  description:
    "Your registration has been received. Check your inbox for confirmation details.",
};

type ThankYouSearchParams = {
  name?: string;
  event?: string;
  date?: string;
  time?: string;
  venueName?: string;
  venueArea?: string;
  note?: string;
  bringNote?: string;
  back?: string;
  footerCopyright?: string;
  footerLocation?: string;
};

/** Trims a query value and treats blank as absent. */
function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

/** Only same-site paths are allowed for "Back to Home" (no open redirects). */
function safeBackHref(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Single post-registration confirmation page for every landing page. The
 * registration form redirects here with the drive's own facts in the query
 * string, and this route renders whatever it's given.
 *
 * Opened directly with no params, it shows a generic thank-you: no event
 * name, no details card, nothing drive-specific.
 */
export default function ThankYouPage({
  searchParams,
}: {
  searchParams?: ThankYouSearchParams;
}) {
  const sp = searchParams ?? {};

  return (
    <RegThankYou
      name={param(sp.name)}
      eventName={param(sp.event)}
      date={param(sp.date)}
      time={param(sp.time)}
      venueName={param(sp.venueName)}
      venueArea={param(sp.venueArea)}
      note={param(sp.note)}
      bringNote={param(sp.bringNote)}
      backHref={safeBackHref(param(sp.back))}
      footerCopyright={param(sp.footerCopyright)}
      footerLocation={param(sp.footerLocation)}
    />
  );
}
