/**
 * Site-level routing for the public landing pages.
 *
 * One file decides which drive the bare domain lands on and where retired
 * paths forward to. Pointing the site at a different campaign is a one-line
 * change here — no route files, redirects or middleware to hunt down.
 *
 * Safe to import from middleware, server components and client components:
 * it holds nothing but strings.
 */

/** Where https://placements.excelr.in sends visitors. */
export const DEFAULT_LANDING_PATH = "/fsd-oct-2026";

/**
 * Retired paths and their replacements. Kept permanently so posters, QR codes
 * and ad links that carry an old URL keep working after a slug is renamed.
 * Issued as 308s, which preserve the method and tell crawlers the move is
 * permanent.
 */
export const LEGACY_PATH_REDIRECTS: Record<string, string> = {
  "/marathahalli-fsd-oct-2026": "/fsd-oct-2026",
};

/**
 * Slugs a drive used to be published under, keyed by its current slug.
 *
 * A drive document in Firestore is matched by slug, so renaming a page in code
 * would otherwise point it at a drive that does not exist — and a landing page
 * with no drive fails safe to "registrations closed", i.e. renaming a slug
 * would silently take the live page down. Listing the old slug here keeps the
 * page resolving to the same drive until an admin renames it in the dashboard,
 * after which the alias is simply never consulted.
 */
export const DRIVE_SLUG_ALIASES: Record<string, string[]> = {
  // Empty: the October drive has been renamed to "fsd-oct-2026" in Firestore,
  // so its former slug is no longer consulted. Add an entry here whenever a
  // page's slug changes in code, and remove it once the drive is renamed.
};

/** Previous slugs to try when the current one matches no drive. */
export function driveSlugAliases(slug: string): string[] {
  return DRIVE_SLUG_ALIASES[slug] ?? [];
}

/**
 * Resolve a pathname to the path it should redirect to, or null to serve it
 * as-is. Query strings are preserved by the caller.
 */
export function redirectTargetFor(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "" || path === "/") return DEFAULT_LANDING_PATH;
  return LEGACY_PATH_REDIRECTS[path] ?? null;
}
