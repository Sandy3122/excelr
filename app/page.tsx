import { redirect } from "next/navigation";
import { DEFAULT_LANDING_PATH } from "@/lib/site";

/**
 * The bare domain lands on whichever campaign `lib/site.ts` nominates.
 * Middleware normally catches this first; keeping it here means the redirect
 * still holds if the matcher is ever narrowed.
 */
export default function Home() {
  redirect(DEFAULT_LANDING_PATH);
}
