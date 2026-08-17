import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = toCsv(["name", "note"], [["Ada, Lovelace", 'said "hello"']]);
    expect(csv).toContain('"Ada, Lovelace"');
    expect(csv).toContain('"said ""hello"""');
  });
});
