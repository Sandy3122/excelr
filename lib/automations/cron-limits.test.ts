import { describe, expect, it } from "vitest";
import {
  CRON_BATCH_HEADROOM_MS,
  CRON_HANDLER_BUDGET_MS,
  shouldStartCronBatch,
} from "./cron-limits";

describe("shouldStartCronBatch", () => {
  it("stops after the max number of send batches", () => {
    expect(
      shouldStartCronBatch({
        startedAt: 0,
        now: 1_000,
        budgetMs: CRON_HANDLER_BUDGET_MS,
        headroomMs: CRON_BATCH_HEADROOM_MS,
        batchesSent: 1,
        maxBatches: 1,
      }),
    ).toBe(false);
  });

  it("stops when the 30s cron-job.org window is too close", () => {
    expect(
      shouldStartCronBatch({
        startedAt: 0,
        now: 14_000,
        budgetMs: CRON_HANDLER_BUDGET_MS,
        headroomMs: CRON_BATCH_HEADROOM_MS,
        batchesSent: 0,
        maxBatches: 1,
      }),
    ).toBe(false);
  });

  it("allows the first batch early in the tick", () => {
    expect(
      shouldStartCronBatch({
        startedAt: 0,
        now: 2_000,
        budgetMs: CRON_HANDLER_BUDGET_MS,
        headroomMs: CRON_BATCH_HEADROOM_MS,
        batchesSent: 0,
        maxBatches: 1,
      }),
    ).toBe(true);
  });
});
