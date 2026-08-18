import type { AutomationRun } from "@/lib/automations/types";
import type { SendProgressState } from "./send-progress-modal";

export const SEND_CHUNK_SIZE = 40;

export type SendAction = "run" | "retry_failed" | "resend";

interface SendBatchesOptions {
  kind: string;
  ids: string[];
  action: SendAction;
  title: string;
  includeEmail?: boolean;
  onProgress: (progress: SendProgressState) => void;
}

export async function sendAutomationBatches({
  kind,
  ids,
  action,
  title,
  includeEmail = false,
  onProgress,
}: SendBatchesOptions): Promise<SendProgressState> {
  const unique = [...new Set(ids.filter(Boolean))];
  const batchCount = Math.max(1, Math.ceil(unique.length / SEND_CHUNK_SIZE));
  let progress: SendProgressState = {
    open: true,
    title,
    total: unique.length,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    batch: 0,
    batchCount,
    error: "",
    done: false,
  };
  onProgress(progress);

  if (unique.length === 0) {
    progress = { ...progress, done: true };
    onProgress(progress);
    return progress;
  }

  for (let i = 0; i < unique.length; i += SEND_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + SEND_CHUNK_SIZE);
    progress = {
      ...progress,
      batch: Math.floor(i / SEND_CHUNK_SIZE) + 1,
    };
    onProgress(progress);

    const res = await fetch(`/api/admin/automations/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        force: true,
        includeEmail,
        registrationIds: chunk,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      run?: AutomationRun;
    };
    if (!res.ok || !json.ok || !json.run) {
      progress = {
        ...progress,
        processed: progress.processed + chunk.length,
        error: json.error || "Send failed.",
        done: true,
      };
      onProgress(progress);
      return progress;
    }

    progress = {
      ...progress,
      processed: progress.processed + chunk.length,
      sent: progress.sent + json.run.stats.sent,
      failed: progress.failed + json.run.stats.failed,
      skipped: progress.skipped + json.run.stats.skipped,
    };
    onProgress(progress);
  }

  progress = { ...progress, done: true };
  onProgress(progress);
  return progress;
}
