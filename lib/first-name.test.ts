import { describe, expect, it } from "vitest";
import { firstNameFrom } from "./first-name";

describe("firstNameFrom", () => {
  it("uses only the first word", () => {
    expect(firstNameFrom("Arjun Sharma")).toBe("Arjun");
    expect(firstNameFrom("Ravi Kumar Reddy")).toBe("Ravi");
    expect(firstNameFrom("Priya")).toBe("Priya");
  });

  it("falls back to there when blank", () => {
    expect(firstNameFrom("")).toBe("there");
    expect(firstNameFrom("   ")).toBe("there");
    expect(firstNameFrom(null)).toBe("there");
    expect(firstNameFrom(undefined)).toBe("there");
  });
});
