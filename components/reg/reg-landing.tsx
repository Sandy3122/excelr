import RegNavbar from "./reg-navbar";
import RegHero from "./reg-hero";
import EventDetails from "./event-details";
import RegFaq from "./reg-faq";
import RegFooter from "./reg-footer";

/** Composes the full standalone /reg landing page. */
export default function RegLanding() {
  return (
    <main className="min-h-screen bg-page">
      <RegNavbar />
      <RegHero />
      <EventDetails />
      <RegFaq />
      <RegFooter />
    </main>
  );
}
