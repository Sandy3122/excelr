import { describe, expect, it } from "vitest";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import {
  EMPTY_LEAD_FILTERS,
  kindMatchesStatus,
  leadChannelStatus,
  matchesLeadFilters,
} from "./lead-filters";

function lead(
  overrides: Partial<StoredRegistration> & Pick<StoredRegistration, "id">,
): StoredRegistration {
  return {
    fullName: "Ada Lovelace",
    firstName: "Ada",
    email: "ada@example.com",
    emailLower: "ada@example.com",
    phone: "919999999999",
    college: "NITK",
    qualification: "B.E / B.Tech",
    pageUrl: "",
    submittedAtIso: "2026-08-18T04:00:00.000Z",
    event: "java-fullstack-placement-drive",
    submittedAt: "2026-08-18T04:00:00.000Z",
    createdAt: null,
    updatedAt: null,
    thingsToCarryDueAt: null,
    messages: null,
    ...overrides,
  };
}

describe("leadChannelStatus", () => {
  it("treats missing welcome as legacy", () => {
    expect(leadChannelStatus(lead({ id: "1" }), "welcome", "whatsapp")).toBe(
      "legacy",
    );
  });

  it("treats missing later automations as pending", () => {
    expect(
      leadChannelStatus(lead({ id: "1" }), "things_to_carry", "whatsapp"),
    ).toBe("pending");
  });
});

describe("matchesLeadFilters", () => {
  const ada = lead({ id: "1" });
  const bob = lead({
    id: "2",
    fullName: "Bob Kumar",
    email: "bob@example.com",
    college: "IITM",
    qualification: "MCA",
    messages: {
      welcome: {
        whatsapp: {
          status: "failed",
          sentAt: null,
          claimedAt: null,
          error: "bad",
          providerMessageId: null,
          skippedReason: null,
        },
      },
    },
  });

  it("matches search across name and college", () => {
    expect(
      matchesLeadFilters(ada, { ...EMPTY_LEAD_FILTERS, q: "nitk" }),
    ).toBe(true);
    expect(
      matchesLeadFilters(bob, { ...EMPTY_LEAD_FILTERS, q: "nitk" }),
    ).toBe(false);
  });

  it("filters by qualification and college with multi-select", () => {
    expect(
      matchesLeadFilters(ada, {
        ...EMPTY_LEAD_FILTERS,
        qualifications: ["B.E / B.Tech", "MCA"],
        colleges: ["NITK"],
      }),
    ).toBe(true);
    expect(
      matchesLeadFilters(ada, {
        ...EMPTY_LEAD_FILTERS,
        qualifications: ["MCA"],
      }),
    ).toBe(false);
    expect(
      matchesLeadFilters(bob, {
        ...EMPTY_LEAD_FILTERS,
        qualifications: ["B.E / B.Tech", "MCA"],
      }),
    ).toBe(true);
  });

  it("filters failed welcome without locking other kinds", () => {
    expect(
      matchesLeadFilters(bob, {
        ...EMPTY_LEAD_FILTERS,
        statuses: ["failed"],
        statusKinds: ["welcome"],
      }),
    ).toBe(true);
    expect(
      matchesLeadFilters(ada, {
        ...EMPTY_LEAD_FILTERS,
        statuses: ["failed"],
        statusKinds: ["welcome"],
      }),
    ).toBe(false);
  });
});

describe("kindMatchesStatus", () => {
  it("counts a pending WhatsApp as pending even if email was sent", () => {
    const mixed = lead({
      id: "3",
      messages: {
        reminder_day_before: {
          whatsapp: {
            status: "pending",
            sentAt: null,
            claimedAt: null,
            error: null,
            providerMessageId: null,
            skippedReason: null,
          },
          email: {
            status: "sent",
            sentAt: "2026-08-21T06:30:00.000Z",
            claimedAt: null,
            error: null,
            providerMessageId: null,
            skippedReason: null,
          },
        },
      },
    });
    expect(kindMatchesStatus(mixed, "reminder_day_before", "pending")).toBe(
      true,
    );
    expect(kindMatchesStatus(mixed, "reminder_day_before", "sent")).toBe(false);
  });
});
