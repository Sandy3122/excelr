"use client";

import RegNavbar from "./reg-navbar";
import RegHero from "./reg-hero";
import EventDetails from "./event-details";
import RegFaq from "./reg-faq";
import RegFooter from "./reg-footer";
import RegistrationClosedBanner from "./registration-closed";
import { useRegistrationClosed } from "./use-registration-closed";

/** Composes the full standalone /reg landing page. */
export default function RegLanding({
  closed = false,
  closesAtIso = null,
}: {
  closed?: boolean;
  closesAtIso?: string | null;
}) {
  const registrationClosed = useRegistrationClosed({ closed, closesAtIso });

  return (
    <main className="min-h-screen bg-page">
      {registrationClosed ? <RegistrationClosedBanner /> : null}
      <RegNavbar />
      <RegHero closed={registrationClosed} />
      <EventDetails closed={registrationClosed} />
      <RegFaq />
      <RegFooter />
    </main>
  );
}
