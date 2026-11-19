/**
 * @file data.ts
 * Cloudflare D1 data synchronization route for authenticated user preferences,
 * saved plans, and chat logs.
 */

import { currentUser } from "./auth";
import { emptyData, mergeData, type AppData } from "../shared/saved";
import { normalizeData } from "../shared/normalize";

const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(self)",
    },
  });

/**
 * Handles GET (fetch user data) and PUT (sync user data) requests.
 */
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
        data = normalizeData(JSON.parse(row.payload)) ?? emptyData();
      } catch {
        /* Use clean data fallback. */
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
      incoming = normalizeData(JSON.parse(text));
    } catch {
      /* Invalid JSON payload. */
    }
    if (!incoming) return json({ error: "Invalid saved data." }, 400);
    const row = await db
      .prepare("SELECT payload FROM user_data WHERE user_id = ?")
      .bind(user.id)
      .first<{ payload: string }>();
    let existing = emptyData();
    if (row) {
      try {
        existing = normalizeData(JSON.parse(row.payload)) ?? emptyData();
      } catch {
        /* Use clean data fallback. */
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
