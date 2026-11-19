import { describe, expect, it } from "vitest";
import {
  emptyData,
  isPlace,
  isPlanOptions,
  mergeData,
  type ChatMessage,
  type SavedPlan,
} from "../src/shared/saved";

const message = (id: string, at: number): ChatMessage => ({
  id,
  at,
  role: "user",
  content: id,
  city: "Delhi",
});

describe("saved data validation and merging", () => {
  it("validates plan options against strict constraints", () => {
    const valid = emptyData().options;
    expect(isPlanOptions(valid)).toBe(true);

    // Invalid activities
    expect(isPlanOptions({ ...valid, activity: "driving" })).toBe(false);
    expect(isPlanOptions({ ...valid, activity: "" })).toBe(false);

    // Invalid hours
    expect(isPlanOptions({ ...valid, preferredHour: -1 })).toBe(false);
    expect(isPlanOptions({ ...valid, preferredHour: 24 })).toBe(false);
    expect(isPlanOptions({ ...valid, preferredHour: 12.5 })).toBe(false);

    // Invalid durations
    expect(isPlanOptions({ ...valid, durationMinutes: 45 })).toBe(false);
    expect(isPlanOptions({ ...valid, durationMinutes: 180 })).toBe(false);

    // Invalid flexibilities
    expect(isPlanOptions({ ...valid, flexibilityHours: 3 })).toBe(false);
    expect(isPlanOptions({ ...valid, flexibilityHours: 8 })).toBe(false);

    // Invalid travel modes
    expect(isPlanOptions({ ...valid, travelMode: "train" })).toBe(false);

    // Invalid sensitivity
    expect(isPlanOptions({ ...valid, sensitive: "yes" })).toBe(false);

    // Vulnerability profile validation
    expect(
      isPlanOptions({ ...valid, vulnerabilityProfile: "respiratory" }),
    ).toBe(true);
    expect(
      isPlanOptions({ ...valid, vulnerabilityProfile: "invalid_profile" }),
    ).toBe(false);
  });

  it("validates geographic place schemas", () => {
    const validPlace = emptyData().place;
    expect(isPlace(validPlace)).toBe(true);

    expect(isPlace(null)).toBe(false);
    expect(isPlace({})).toBe(false);
    expect(isPlace({ ...validPlace, name: "" })).toBe(false);
    expect(isPlace({ ...validPlace, name: "x".repeat(81) })).toBe(false);
    expect(isPlace({ ...validPlace, latitude: 90.1 })).toBe(false);
    expect(isPlace({ ...validPlace, latitude: -91 })).toBe(false);
    expect(isPlace({ ...validPlace, longitude: 180.1 })).toBe(false);
    expect(isPlace({ ...validPlace, longitude: -181 })).toBe(false);
    expect(isPlace({ ...validPlace, latitude: NaN })).toBe(false);
  });

  it("keeps messages from both the device and account", () => {
    const local = { ...emptyData(), messages: [message("local", 10)] };
    const remote = { ...emptyData(), messages: [message("remote", 20)] };
    expect(mergeData(local, remote).messages.map((item) => item.id)).toEqual([
      "local",
      "remote",
    ]);
  });

  it("keeps a chat clear across devices", () => {
    const local = {
      ...emptyData(),
      chatClearedAt: 15,
      messages: [message("new", 20)],
    };
    const remote = { ...emptyData(), messages: [message("old", 10)] };
    expect(mergeData(local, remote).messages.map((item) => item.id)).toEqual([
      "new",
    ]);
  });

  it("does not restore a removed saved plan", () => {
    const plan: SavedPlan = {
      id: "plan-1",
      at: 10,
      city: "Delhi",
      activity: "Walk",
      time: "9:00 AM",
      summary: "Lower air",
      place: emptyData().place,
      options: emptyData().options,
    };
    const local = { ...emptyData(), removedPlanIds: ["plan-1"] };
    const remote = { ...emptyData(), plans: [plan] };
    expect(mergeData(local, remote).plans).toEqual([]);
  });
});
