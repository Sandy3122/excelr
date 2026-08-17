import { describe, expect, it } from "vitest";
import { pageWindow } from "./pagination";

describe("admin page window", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it("keeps first, last, and neighbours on a long list", () => {
    expect(pageWindow(8, 20)).toEqual([1, "ellipsis", 7, 8, 9, "ellipsis", 20]);
  });
});
