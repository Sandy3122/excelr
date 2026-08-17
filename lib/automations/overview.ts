import { AUTOMATION_KINDS } from "./types";
import {
  emptyCounts,
  type AutomationOverview,
  type Channel,
  type ChannelCounts,
  type MessageStatus,
} from "./types";
import { getAutomation, scheduledSendAt } from "./catalog";
import { isScheduledAutomationDue } from "./schedule";
import { listRegistrations } from "@/lib/firebase/registrations";
import { countRegistrations } from "@/lib/firebase/registrations";
import { formatIst } from "./ist";

function bumpStatus(counts: ChannelCounts, status: MessageStatus | undefined) {
  switch (status) {
    case "sent":
    case "legacy":
      counts.sent += 1;
      break;
    case "failed":
      counts.failed += 1;
      break;
    case "skipped":
      counts.skipped += 1;
      break;
    case "sending":
      counts.sending += 1;
      break;
    default:
      counts.pending += 1;
  }
}

export async function computeAutomationOverview(): Promise<{
  totalLeads: number;
  automations: AutomationOverview[];
}> {
  const now = new Date();
  const totals = Object.fromEntries(
    AUTOMATION_KINDS.map((kind) => {
      const def = getAutomation(kind);
      const counts = Object.fromEntries(
        def.channels.map((ch) => [ch, emptyCounts()]),
      ) as Record<Channel, ChannelCounts>;
      return [kind, counts] as const;
    }),
  ) as Record<(typeof AUTOMATION_KINDS)[number], Record<Channel, ChannelCounts>>;

  let cursor: string | undefined;
  let scanned = 0;
  do {
    const page = await listRegistrations({ limit: 100, cursor });
    scanned += page.registrations.length;
    for (const reg of page.registrations) {
      for (const kind of AUTOMATION_KINDS) {
        const def = getAutomation(kind);
        for (const channel of def.channels) {
          const status = reg.messages?.[kind]?.[channel]?.status;
          const effective: MessageStatus | undefined =
            status ??
            (kind === "welcome" ? "legacy" : "pending");
          bumpStatus(totals[kind][channel], effective);
        }
      }
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  const totalLeads = scanned || (await countRegistrations());

  const automations: AutomationOverview[] = AUTOMATION_KINDS.map((kind) => {
    const def = getAutomation(kind);
    const sendAt = scheduledSendAt(kind);
    const counts = Object.fromEntries(
      (["whatsapp", "email"] as Channel[]).map((ch) => [
        ch,
        def.channels.includes(ch) ? totals[kind][ch] : null,
      ]),
    ) as Record<Channel, ChannelCounts | null>;

    return {
      kind,
      title: def.title,
      description: def.description,
      channels: def.channels,
      scheduleLabel: def.scheduleLabel,
      sendAtIso: sendAt ? sendAt.toISOString() : null,
      isDue: isScheduledAutomationDue(kind, now),
      counts,
    };
  });

  return { totalLeads, automations };
}

export function formatScheduleForUi(iso: string | null, label: string): string {
  if (!iso) return label;
  return `${label} (${formatIst(new Date(iso))})`;
}
