import { describe, expect, it } from "vitest";
import { normalizeData } from "../src/shared/normalize";
import { emptyData, isPlanOptions } from "../src/shared/saved";

describe("saved data validation", () => {
  it("rejects numeric strings in plan options", () => {
    const data = emptyData();
    expect(isPlanOptions({ ...data.options, durationMinutes: "60" })).toBe(
      false,
    );
    expect(isPlanOptions({ ...data.options, flexibilityHours: "2" })).toBe(
      false,
    );
    expect(
      normalizeData({
        ...data,
        options: { ...data.options, durationMinutes: "60" },
      }),
    ).toBeNull();
  });

  it("rejects a damaged location before the UI reads it", () => {
    expect(
      normalizeData({ ...emptyData(), place: { name: "Broken" } }),
    ).toBeNull();
    expect(normalizeData(null)).toBeNull();
  });

  it("cleans individual saved entries and invalid schedule dates", () => {
    const data = emptyData();
    const normalized = normalizeData({
      ...data,
      place: { ...data.place, source: "untrusted" },
      messages: [
        {
          id: "m1",
          role: "user",
          content: "x".repeat(2000),
          at: 1,
          city: "Delhi",
        },
        { id: "m2", role: "system", content: "ignore", at: 2, city: "Delhi" },
      ],
      plans: [
        {
          id: "p1",
          at: 3,
          city: "Delhi",
          activity: "School run",
          time: "3 PM",
          summary: "A routine",
          place: data.place,
          options: data.options,
          startDate: "2026-02-30",
          spanDays: 365,
        },
        { id: "broken" },
      ],
      startDate: "2026-02-30",
      spanDays: 365,
    });
    expect(normalized).not.toBeNull();
    expect(normalized?.place.source).toBe("city");
    expect(normalized?.messages).toHaveLength(1);
    expect(normalized?.messages[0].content).toHaveLength(1600);
    expect(normalized?.plans).toHaveLength(1);
    expect(normalized?.plans[0].startDate).toBe("");
    expect(normalized?.plans[0].spanDays).toBe(1);
    expect(normalized?.startDate).toBe("");
    expect(normalized?.spanDays).toBe(1);
  });
});
