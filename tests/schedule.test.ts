import { describe, expect, it } from "vitest";
import { googleCalendarUrl, scheduleDates } from "../src/shared/schedule";
import { defaultOptions, defaultPlace } from "../src/shared/saved";

describe("calendar scheduling", () => {
  it("crosses a month boundary and ends after the outing duration", () => {
    expect(scheduleDates("2026-11-29", 7)[2]).toBe("2026-12-01");
    const url = new URL(
      googleCalendarUrl({
        startDate: "2026-11-29",
        spanDays: 1,
        options: { ...defaultOptions, preferredHour: 23, durationMinutes: 120 },
        place: defaultPlace,
        timezone: "Asia/Kolkata",
      }),
    );
    expect(url.searchParams.get("dates")).toBe(
      "20261129T230000/20261130T010000",
    );
    expect(url.searchParams.get("ctz")).toBe("Asia/Kolkata");
    expect(url.searchParams.has("recur")).toBe(false);
  });
  it("creates a bounded daily recurrence for a month routine", () => {
    const url = new URL(
      googleCalendarUrl({
        startDate: "2026-12-02",
        spanDays: 30,
        options: defaultOptions,
        place: defaultPlace,
      }),
    );
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=DAILY;COUNT=30");
    expect(url.searchParams.get("details")).toContain(
      "Recheck the air forecast",
    );
  });
  it("skips weekends in a school routine and matches the Calendar recurrence", () => {
    expect(scheduleDates("2026-11-21", 7, true)).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
    ]);
    const url = new URL(
      googleCalendarUrl({
        startDate: "2026-11-21",
        spanDays: 7,
        options: defaultOptions,
        place: defaultPlace,
        weekdaysOnly: true,
      }),
    );
    expect(url.searchParams.get("dates")).toBe(
      "20261123T150000/20261123T160000",
    );
    expect(url.searchParams.get("recur")).toBe(
      "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=5",
    );
  });
});
