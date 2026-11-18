import { currentUser } from "./auth";
import {
  emptyData,
  isPlace,
  isPlanOptions,
  mergeData,
  type AppData,
  type ChatMessage,
  type Place,
  type SavedPlan,
} from "../shared/saved";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const short = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";
const scheduleDate = (value: unknown) => {
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

function normalize(value: unknown): AppData | null {
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
            options: p.options,
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
    options: input.options,
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

export async function handleData(
  request: Request,
  db: D1Database,
): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Sign in to sync your data." }, 401);
  if (request.method === "GET") {
    const row = await db
      .prepare("SELECT payload FROM user_data WHERE user_id = ?")
      .bind(user.id)
      .first<{ payload: string }>();
    let data = emptyData();
    if (row) {
      try {
        data = normalize(JSON.parse(row.payload)) ?? emptyData();
      } catch {
        /* Use clean data. */
      }
    }
    return json({ data });
  }
  if (request.method === "PUT") {
    const text = await request.text();
    if (text.length > 150_000)
      return json({ error: "Saved data is too large." }, 413);
    let incoming: AppData | null = null;
    try {
      incoming = normalize(JSON.parse(text));
    } catch {
      /* Invalid JSON. */
    }
    if (!incoming) return json({ error: "Invalid saved data." }, 400);
    const row = await db
      .prepare("SELECT payload FROM user_data WHERE user_id = ?")
      .bind(user.id)
      .first<{ payload: string }>();
    let existing = emptyData();
    if (row) {
      try {
        existing = normalize(JSON.parse(row.payload)) ?? emptyData();
      } catch {
        /* Use clean data. */
      }
    }
    const merged = mergeData(incoming, existing);
    await db
      .prepare(
        "INSERT INTO user_data (user_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
      )
      .bind(user.id, JSON.stringify(merged), Date.now())
      .run();
    return json({ data: merged });
  }
  return json({ error: "Method not allowed." }, 405);
}
