import { describe, expect, it } from "vitest";
import {
  emptyData,
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

describe("saved data merging", () => {
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
