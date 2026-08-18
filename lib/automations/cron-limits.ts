/** cron-job.org free plan caps request timeout at 30s and cannot be raised. */
export const CRON_CLIENT_TIMEOUT_MS = 30_000;
/**
 * Stop work in time to write the 200 response before the 30s client cutoff.
 * External schedule is every 10 minutes; leftover leads continue on the next tick.
 */
export const CRON_HANDLER_BUDGET_MS = 18_000;
/** Do not start a send batch if less than this remains in the handler budget. */
export const CRON_BATCH_HEADROOM_MS = 5_000;
/** One WhatsApp batch (~40 leads) per kind per tick. */
export const CRON_MAX_SEND_BATCHES = 1;

export function shouldStartCronBatch(input: {
  startedAt: number;
  now: number;
  budgetMs: number;
  headroomMs: number;
  batchesSent: number;
  maxBatches?: number;
}): boolean {
  if (input.maxBatches != null && input.batchesSent >= input.maxBatches) {
    return false;
  }
  return input.now - input.startedAt < input.budgetMs - input.headroomMs;
}
