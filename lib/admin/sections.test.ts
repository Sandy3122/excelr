import { describe, expect, it } from "vitest";
import {
  ADMIN_SECTIONS,
  isAdminPathDisabled,
  visibleAdminSections,
  type AdminSection,
} from "./sections";

/**
 * The registry ships with everything enabled, so these drive the matcher with
 * their own list rather than asserting against whatever is switched on today.
 */
function disabled(pathname: string, sections: AdminSection[]): boolean {
  const original = ADMIN_SECTIONS.splice(0, ADMIN_SECTIONS.length, ...sections);
  try {
    return isAdminPathDisabled(pathname);
  } finally {
    ADMIN_SECTIONS.splice(0, ADMIN_SECTIONS.length, ...original);
  }
}

const OFF_SETTINGS: AdminSection[] = [
  {
    key: "settings",
    label: "Settings",
    href: "/admin/settings",
    ownsApi: ["/api/admin/registration-window"],
    enabled: false,
  },
];

describe("admin section access", () => {
  it("blocks a disabled section's page, sub-pages and its own API", () => {
    for (const path of [
      "/admin/settings",
      "/admin/settings/",
      "/admin/settings/anything",
      "/api/admin/registration-window",
    ]) {
      expect(disabled(path, OFF_SETTINGS), path).toBe(true);
    }
  });

  it("leaves every other section reachable", () => {
    for (const path of [
      "/admin",
      "/admin/leads",
      "/admin/drives/abc",
      "/api/admin/drives",
      "/api/admin/automations",
    ]) {
      expect(disabled(path, OFF_SETTINGS), path).toBe(false);
    }
  });

  it("does not block a path that merely starts with the same characters", () => {
    expect(disabled("/admin/settings-export", OFF_SETTINGS)).toBe(false);
  });

  it("matches /admin exactly, so disabling Overview spares the rest", () => {
    const offOverview: AdminSection[] = [
      { key: "overview", label: "Overview", href: "/admin", exact: true, enabled: false },
    ];
    expect(disabled("/admin", offOverview)).toBe(true);
    expect(disabled("/admin/leads", offOverview)).toBe(false);
  });

  it("hides disabled sections from the nav and keeps the order", () => {
    const sections: AdminSection[] = [
      { key: "overview", label: "Overview", href: "/admin", exact: true, enabled: true },
      { key: "leads", label: "Leads", href: "/admin/leads", enabled: false },
      { key: "drives", label: "Placement Drives", href: "/admin/drives", enabled: true },
    ];
    const original = ADMIN_SECTIONS.splice(0, ADMIN_SECTIONS.length, ...sections);
    try {
      expect(visibleAdminSections().map((s) => s.key)).toEqual(["overview", "drives"]);
    } finally {
      ADMIN_SECTIONS.splice(0, ADMIN_SECTIONS.length, ...original);
    }
  });

  it("every nav entry has an icon assigned in the shell", async () => {
    const shell = await import("node:fs/promises").then((fs) =>
      fs.readFile("components/admin/admin-shell.tsx", "utf8"),
    );
    for (const section of ADMIN_SECTIONS) {
      expect(shell, section.key).toContain(`${section.key}:`);
    }
  });
});
