import { describe, expect, it } from "vitest";
import { nextTableSort, sortRows, statusSortValue } from "./table-sort";

describe("nextTableSort", () => {
  it("starts ascending on a new column", () => {
    expect(nextTableSort({ key: null, dir: "asc" }, "name")).toEqual({
      key: "name",
      dir: "asc",
    });
  });

  it("toggles direction on the same column", () => {
    expect(nextTableSort({ key: "name", dir: "asc" }, "name")).toEqual({
      key: "name",
      dir: "desc",
    });
  });
});

describe("sortRows", () => {
  const rows = [
    { name: "Chetan", n: 2 },
    { name: "Ananya", n: 10 },
    { name: "Bhavya", n: 1 },
  ];

  it("leaves order unchanged when no column is selected", () => {
    expect(sortRows(rows, { key: null, dir: "asc" }, (r) => r.name)).toBe(rows);
  });

  it("sorts strings A–Z", () => {
    expect(
      sortRows(rows, { key: "name", dir: "asc" }, (r, key) =>
        key === "name" ? r.name : r.n,
      ).map((r) => r.name),
    ).toEqual(["Ananya", "Bhavya", "Chetan"]);
  });

  it("sorts numbers descending", () => {
    expect(
      sortRows(rows, { key: "n", dir: "desc" }, (r, key) =>
        key === "n" ? r.n : r.name,
      ).map((r) => r.n),
    ).toEqual([10, 2, 1]);
  });
});

describe("statusSortValue", () => {
  it("ranks failed before sent", () => {
    expect(statusSortValue("failed")).toBeLessThan(statusSortValue("sent"));
  });
});
