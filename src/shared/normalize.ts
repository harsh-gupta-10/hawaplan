/**
 * @file normalize.ts
 * Validation and sanitization for untrusted user and storage payloads.
 * Protects against XSS, schema tampering, corrupted local caches, and invalid date formats.
 */

import {
  isPlace,
  isPlanOptions,
  type AppData,
  type ChatMessage,
  type Place,
  type SavedPlan,
} from "./saved";
import type { PlanOptions, VulnerabilityProfile } from "./planner";

const short = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

/**
 * Validates that an input is a genuine Gregorian date in YYYY-MM-DD format.
 */
const scheduleDate = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return "";
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
    ? value
    : "";
};

const scheduleSpan = (value: unknown): 1 | 7 | 30 =>
  value === 7 || value === 30 ? value : 1;

/**
 * Sanitizes place attributes and bounds string lengths.
 */
const cleanPlace = (place: Place): Place => ({
  id: Number.isFinite(place.id) ? place.id : 0,
  name: place.name.slice(0, 80),
  admin1: short(place.admin1, 80),
  country: short(place.country, 80),
  latitude: place.latitude,
  longitude: place.longitude,
  source: ["city", "network", "device"].includes(String(place.source))
    ? place.source
    : "city",
});

/**
 * Sanitizes plan options, defaulting vulnerabilityProfile safely when absent.
 */
const cleanOptions = (options: PlanOptions): PlanOptions => {
  const validProfiles: VulnerabilityProfile[] = [
    "general",
    "children",
    "elderly",
    "respiratory",
    "athletes",
  ];
  return {
    activity: options.activity,
    preferredHour: options.preferredHour,
    durationMinutes: options.durationMinutes,
    flexibilityHours: options.flexibilityHours,
    travelMode: options.travelMode,
    sensitive: options.sensitive,
    vulnerabilityProfile: validProfiles.includes(
      options.vulnerabilityProfile as VulnerabilityProfile,
    )
      ? options.vulnerabilityProfile
      : "general",
  };
};

/**
 * Validates and deeply normalizes untrusted JSON data into strongly-typed AppData.
 * Returns null if fundamental schema properties are corrupted.
 *
 * @param value Untrusted JSON input
 */
export function normalizeData(value: unknown): AppData | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!isPlace(input.place) || !isPlanOptions(input.options)) return null;

  const messages: ChatMessage[] = Array.isArray(input.messages)
    ? input.messages.slice(-100).flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const m = item as Record<string, unknown>;
        if (
          typeof m.id !== "string" ||
          m.id.length > 64 ||
          !["user", "assistant"].includes(String(m.role)) ||
          typeof m.at !== "number" ||
          !Number.isFinite(m.at)
        )
          return [];
        return [
          {
            id: m.id,
            role: m.role as ChatMessage["role"],
            content: short(m.content, 1600),
            at: m.at,
            city: short(m.city, 80),
          },
        ];
      })
    : [];

  const plans: SavedPlan[] = Array.isArray(input.plans)
    ? input.plans.slice(0, 30).flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const p = item as Record<string, unknown>;
        if (
          typeof p.id !== "string" ||
          p.id.length > 64 ||
          typeof p.at !== "number" ||
          !Number.isFinite(p.at) ||
          !isPlace(p.place) ||
          !isPlanOptions(p.options)
        )
          return [];
        return [
          {
            id: p.id,
            at: p.at,
            city: short(p.city, 80),
            activity: short(p.activity, 40),
            time: short(p.time, 40),
            summary: short(p.summary, 300),
            place: cleanPlace(p.place),
            options: cleanOptions(p.options),
            startDate: scheduleDate(p.startDate),
            spanDays: scheduleSpan(p.spanDays),
            timezone: short(p.timezone, 80),
            chosenStart: short(p.chosenStart, 20),
            weekdaysOnly:
              typeof p.weekdaysOnly === "boolean" ? p.weekdaysOnly : undefined,
          },
        ];
      })
    : [];

  return {
    place: cleanPlace(input.place),
    options: cleanOptions(input.options),
    preferencesUpdatedAt:
      typeof input.preferencesUpdatedAt === "number" &&
      Number.isFinite(input.preferencesUpdatedAt)
        ? input.preferencesUpdatedAt
        : 0,
    messages,
    chatClearedAt:
      typeof input.chatClearedAt === "number" &&
      Number.isFinite(input.chatClearedAt)
        ? input.chatClearedAt
        : 0,
    plans,
    removedPlanIds: Array.isArray(input.removedPlanIds)
      ? input.removedPlanIds
          .filter(
            (id): id is string => typeof id === "string" && id.length <= 64,
          )
          .slice(-100)
      : [],
    startDate: scheduleDate(input.startDate),
    spanDays: scheduleSpan(input.spanDays),
    weekdaysOnly:
      typeof input.weekdaysOnly === "boolean" ? input.weekdaysOnly : undefined,
  };
}
