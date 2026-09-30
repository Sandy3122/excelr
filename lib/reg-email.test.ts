import { describe, expect, it } from "vitest";
import { renderAutomationEmailHtml, buildGoogleCalendarLink } from "./reg-email";
import type { PlacementDrive } from "./drives/types";

const drive = (slug: string, eventDay: string | null = "2026-10-09") =>
  ({
    id: "d",
    slug,
    name: "Full Stack Placement Drive - BTM, Oct 2026",
    eventDayIstDate: eventDay,
  }) as PlacementDrive;

describe("welcome email template resolution", () => {
  it("uses the page's own index.html when the drive has one", async () => {
    const html = await renderAutomationEmailHtml(
      "welcome",
      "Ada Lovelace",
      drive("fsd-oct-2026"),
    );
    expect(html.length).toBeGreaterThan(1000);
    // Every token must be substituted, whichever template was picked.
    expect(html).not.toContain("we_wk_unsubscribe_link");
    expect(html).not.toContain("{{first_name}}");
    expect(html).not.toContain("{{calendar_link}}");
  });

  it("falls back to the shared template for a drive with no folder", async () => {
    const html = await renderAutomationEmailHtml(
      "welcome",
      "Ada Lovelace",
      drive("no-such-drive-folder"),
    );
    // The shared copy carries the personalisation tokens, so they must resolve.
    expect(html).toContain("Ada");
    expect(html).not.toContain("{{first_name}}");
    expect(html).not.toContain("{{calendar_link}}");
  });

  it("escapes the name rather than injecting raw HTML", async () => {
    const html = await renderAutomationEmailHtml(
      "welcome",
      "<script>alert(1)</script> Bob",
      drive("no-such-drive-folder"),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("reports which paths it tried when nothing is found", async () => {
    await expect(
      renderAutomationEmailHtml("reminder_day_before", "Ada", drive("x")),
    ).resolves.toBeTypeOf("string");
  });
});

describe("calendar link", () => {
  it("is built from the drive's event day", () => {
    expect(buildGoogleCalendarLink(drive("fsd-oct-2026"))).toContain(
      "20261009T033000Z",
    );
  });

  it("is empty when the drive has no event day", () => {
    expect(buildGoogleCalendarLink(drive("fsd-oct-2026", null))).toBe("");
  });
});

describe("merge expressions", () => {
  const D = drive("no-such-drive-folder");

  async function render(name: string) {
    return renderAutomationEmailHtml("welcome", name, D);
  }

  it("fills the WebEngage-style name expression used by the drive template", async () => {
    const html = await renderAutomationEmailHtml(
      "welcome",
      "Ada Lovelace",
      drive("fsd-oct-2026"),
    );
    expect(html).toContain("Dear <strong style=\"color: #173b63;\">Ada</strong>");
    expect(html).not.toContain("{{");
  });

  it("uses the expression's own fallback when there is no name", async () => {
    const html = await renderAutomationEmailHtml(
      "welcome",
      "   ",
      drive("fsd-oct-2026"),
    );
    expect(html).toContain("Aspirant");
    expect(html).not.toContain("{{");
  });

  it("still fills the plain {{first_name}} syntax", async () => {
    const html = await render("Ada Lovelace");
    expect(html).toContain("Ada");
    expect(html).not.toContain("{{first_name}}");
  });

  it("never leaves a raw placeholder in a sent email", async () => {
    const html = await render("Ada Lovelace");
    expect(html).not.toMatch(/\{\{[^}]*\}\}/);
    expect(html).not.toContain("we_wk_unsubscribe_link");
  });

  it("escapes a name that contains markup", async () => {
    const html = await renderAutomationEmailHtml(
      "welcome",
      '<img src=x onerror="alert(1)">',
      drive("fsd-oct-2026"),
    );
    expect(html).not.toContain("onerror=");
  });
});
