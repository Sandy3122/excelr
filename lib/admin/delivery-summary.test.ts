import { describe, expect, it } from "vitest";
import { summariseDelivery } from "./lead-filters";
import { statusLabel } from "@/components/admin/status-badge";

const opts = { enabled: true, label: statusLabel };

describe("summariseDelivery", () => {
  it("collapses channels that read the same into one badge", () => {
    expect(
      summariseDelivery(
        [
          { channel: "whatsapp", status: "sent" },
          { channel: "email", status: "sent" },
        ],
        opts,
      ),
    ).toEqual({
      kind: "single",
      status: "sent",
      channels: ["whatsapp", "email"],
    });
  });

  it("treats a legacy welcome and a sent email as the same badge", () => {
    // Both render as "Sent", so showing two pills would be noise.
    const result = summariseDelivery(
      [
        { channel: "whatsapp", status: "legacy" },
        { channel: "email", status: "sent" },
      ],
      opts,
    );
    expect(result.kind).toBe("single");
  });

  it("collapses two skipped channels", () => {
    expect(
      summariseDelivery(
        [
          { channel: "whatsapp", status: "skipped" },
          { channel: "email", status: "skipped" },
        ],
        opts,
      ).kind,
    ).toBe("single");
  });

  it("keeps both badges when the channels genuinely differ", () => {
    expect(
      summariseDelivery(
        [
          { channel: "whatsapp", status: "sent" },
          { channel: "email", status: "failed" },
        ],
        opts,
      ),
    ).toEqual({
      kind: "split",
      entries: [
        { channel: "whatsapp", status: "sent" },
        { channel: "email", status: "failed" },
      ],
    });
  });

  it("renders a single badge for a WhatsApp-only automation", () => {
    expect(
      summariseDelivery([{ channel: "whatsapp", status: "pending" }], opts).kind,
    ).toBe("single");
  });

  it("reports a disabled automation rather than a status", () => {
    expect(
      summariseDelivery([{ channel: "whatsapp", status: "pending" }], {
        ...opts,
        enabled: false,
      }),
    ).toEqual({ kind: "disabled" });
  });

  it("reports nothing to show when the drive gives the automation no channels", () => {
    expect(summariseDelivery([], opts)).toEqual({ kind: "none" });
  });
});
