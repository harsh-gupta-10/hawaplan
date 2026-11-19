/**
 * @file saved.ts
 * Data schemas and synchronization logic for user preferences, saved plans, and chat history.
 */

import type { PlanOptions } from "./planner";

export interface Place {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  source?: "city" | "network" | "device";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  city: string;
}

export interface SavedPlan {
  id: string;
  at: number;
  city: string;
  activity: string;
  time: string;
  summary: string;
  place: Place;
  options: PlanOptions;
  startDate?: string;
  spanDays?: 1 | 7 | 30;
  timezone?: string;
  chosenStart?: string;
  weekdaysOnly?: boolean;
}

export interface AppData {
  place: Place;
  options: PlanOptions;
  preferencesUpdatedAt: number;
  messages: ChatMessage[];
  chatClearedAt: number;
  plans: SavedPlan[];
  removedPlanIds: string[];
  startDate?: string;
  spanDays?: 1 | 7 | 30;
  weekdaysOnly?: boolean;
}

export const defaultPlace: Place = {
  id: 1,
  name: "New Delhi",
  admin1: "Delhi",
  country: "India",
  latitude: 28.6139,
  longitude: 77.209,
  source: "city",
};

export const defaultOptions: PlanOptions = {
  activity: "school",
  preferredHour: 15,
  durationMinutes: 60,
  flexibilityHours: 2,
  travelMode: "car",
  sensitive: true,
  vulnerabilityProfile: "general",
};

/**
 * Returns a clean initial AppData state for guests or new accounts.
 */
export const emptyData = (): AppData => ({
  place: defaultPlace,
  options: defaultOptions,
  preferencesUpdatedAt: 0,
  messages: [],
  chatClearedAt: 0,
  plans: [],
  removedPlanIds: [],
  startDate: "",
  spanDays: 1,
});

/**
 * Type guard validating that an untrusted object strictly conforms to PlanOptions.
 *
 * @param value Untrusted input object
 */
export function isPlanOptions(value: unknown): value is PlanOptions {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  const validActivity =
    typeof o.activity === "string" &&
    ["school", "walk", "errands", "exercise"].includes(o.activity);
  const validHour =
    typeof o.preferredHour === "number" &&
    Number.isInteger(o.preferredHour) &&
    o.preferredHour >= 0 &&
    o.preferredHour <= 23;
  const validDuration =
    typeof o.durationMinutes === "number" &&
    [30, 60, 90, 120].includes(o.durationMinutes);
  const validFlexibility =
    typeof o.flexibilityHours === "number" &&
    [0, 2, 4, 6].includes(o.flexibilityHours);
  const validTravelMode =
    typeof o.travelMode === "string" &&
    ["car", "bus", "walk", "cycle"].includes(o.travelMode);
  const validSensitive = typeof o.sensitive === "boolean";
  const validProfile =
    o.vulnerabilityProfile === undefined ||
    (typeof o.vulnerabilityProfile === "string" &&
      ["general", "children", "elderly", "respiratory", "athletes"].includes(
        o.vulnerabilityProfile,
      ));

  return (
    validActivity &&
    validHour &&
    validDuration &&
    validFlexibility &&
    validTravelMode &&
    validSensitive &&
    validProfile
  );
}

/**
 * Type guard validating that an untrusted object represents a valid geographic Place.
 *
 * @param value Untrusted input object
 */
export function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    p.name.length > 0 &&
    p.name.length <= 80 &&
    typeof p.latitude === "number" &&
    Number.isFinite(p.latitude) &&
    Math.abs(p.latitude) <= 90 &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.longitude) <= 180
  );
}

/**
 * Deterministically merges local client state with remote cloud storage data.
 * Resolves conflict using timestamps, preserves soft deletes, and respects chat clear timestamps.
 *
 * @param local Client-side application data
 * @param remote Cloud-stored application data
 */
export function mergeData(local: AppData, remote: AppData): AppData {
  const preferences =
    local.preferencesUpdatedAt >= remote.preferencesUpdatedAt ? local : remote;
  const chatClearedAt = Math.max(local.chatClearedAt, remote.chatClearedAt);
  const messages = new Map<string, ChatMessage>();
  for (const message of [...remote.messages, ...local.messages]) {
    if (message.at > chatClearedAt) messages.set(message.id, message);
  }
  const plans = new Map<string, SavedPlan>();
  const removedPlanIds = [
    ...new Set([
      ...(remote.removedPlanIds ?? []),
      ...(local.removedPlanIds ?? []),
    ]),
  ].slice(-100);
  for (const plan of [...remote.plans, ...local.plans])
    if (!removedPlanIds.includes(plan.id)) plans.set(plan.id, plan);
  return {
    place: preferences.place,
    options: preferences.options,
    preferencesUpdatedAt: preferences.preferencesUpdatedAt,
    messages: [...messages.values()].sort((a, b) => a.at - b.at).slice(-100),
    chatClearedAt,
    plans: [...plans.values()].sort((a, b) => b.at - a.at).slice(0, 30),
    removedPlanIds,
    startDate: preferences.startDate ?? "",
    spanDays: preferences.spanDays ?? 1,
    weekdaysOnly: preferences.weekdaysOnly,
  };
}
