"use client";

import RegNavbar from "./reg-navbar";
import RegHero from "./reg-hero";
import EventDetails from "./event-details";
import RegFaq from "./reg-faq";
import RegFooter from "./reg-footer";
import RegistrationClosedBanner from "./registration-closed";
import { RegEventProvider } from "./reg-event-context";
import { useRegistrationClosed } from "./use-registration-closed";
import { DEFAULT_REG_EVENT, type RegEventConfig } from "@/lib/reg-event";

/** Composes a full standalone registration landing page for one drive. */
export default function RegLanding({
  config = DEFAULT_REG_EVENT,
  closed = false,
  closesAtIso = null,
}: {
  config?: RegEventConfig;
  closed?: boolean;
  closesAtIso?: string | null;
}) {
  const registrationClosed = useRegistrationClosed({ closed, closesAtIso });

  return (
    <RegEventProvider config={config}>
      <main className="min-h-screen bg-page">
        {registrationClosed ? <RegistrationClosedBanner /> : null}
        <RegNavbar />
        <RegHero closed={registrationClosed} />
        <EventDetails closed={registrationClosed} />
        <RegFaq />
        <RegFooter />
      </main>
    </RegEventProvider>
  );
}
