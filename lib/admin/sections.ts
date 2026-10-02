/**
 * Every admin section, in one place.
 *
 * Flip a section's `enabled` to false and it disappears from the sidebar and
 * the mobile nav *and* its URLs stop resolving - the page and the APIs it owns
 * return 404, so typing the path directly gets you nothing. Nothing else in the
 * codebase needs editing: middleware.ts, the admin shell and the guarded route
 * handlers all read this list.
 *
 * Safe to import from middleware (Edge), server components and client
 * components: strings only, no React and no Node APIs. Icons live in
 * components/admin/admin-shell.tsx, keyed by section.
 */

export type AdminSectionKey =
  | "overview"
  | "leads"
  | "automations"
  | "drives"
  | "settings";

export interface AdminSection {
  key: AdminSectionKey;
  /** Sidebar label. */
  label: string;
  /** Page URL. Sub-paths are covered too, unless `exact`. */
  href: string;
  /**
   * The switch. false → hidden from the nav and 404 on every path it owns.
   */
  enabled: boolean;
  /** Match `href` exactly - for "/admin", which is a prefix of every section. */
  exact?: boolean;
  /**
   * API paths this section *exclusively* owns, blocked alongside its page.
   *
   * Only APIs no other section calls belong here. `/api/admin/automations` is
   * shared with Overview and `/api/admin/drives` feeds the drive selector in
   * the header of every page, so neither is listed - turning those sections off
   * hides their pages without breaking the rest of the dashboard.
   */
  ownsApi?: string[];
  /** Shown in the nav only when false, as a hint that it is switched off. */
  note?: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/admin",
    exact: true,
    // Where login lands. Disabling it leaves sign-in on a 404, so leave it on
    // unless you also change the post-login redirect.
    enabled: true,
  },
  {
    key: "leads",
    label: "Leads",
    href: "/admin/leads",
    ownsApi: ["/api/admin/leads"],
    enabled: true,
  },
  {
    key: "automations",
    label: "Automations",
    href: "/admin/automations",
    enabled: true,
  },
  {
    key: "drives",
    label: "Placement Drives",
    href: "/admin/drives",
    enabled: false,
  },
  {
    key: "settings",
    label: "Settings",
    href: "/admin/settings",
    ownsApi: ["/api/admin/registration-window"],
    enabled: true,
  },
];

const BY_KEY = new Map(ADMIN_SECTIONS.map((section) => [section.key, section]));

/** Sections to render in the sidebar and mobile nav, in order. */
export function visibleAdminSections(): AdminSection[] {
  return ADMIN_SECTIONS.filter((section) => section.enabled);
}

export function isAdminSectionEnabled(key: AdminSectionKey): boolean {
  return BY_KEY.get(key)?.enabled ?? false;
}

function matches(pathname: string, prefix: string, exact?: boolean): boolean {
  if (pathname === prefix) return true;
  return !exact && pathname.startsWith(`${prefix}/`);
}

/**
 * True when the path belongs to a section that is switched off, i.e. the
 * request must 404. Covers the page, its sub-pages and the APIs it owns.
 */
export function isAdminPathDisabled(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ADMIN_SECTIONS.some(
    (section) =>
      !section.enabled &&
      (matches(path, section.href, section.exact) ||
        (section.ownsApi ?? []).some((api) => matches(path, api))),
  );
}

/** 404 body shared by the guarded pages and route handlers. */
export function disabledSectionResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
