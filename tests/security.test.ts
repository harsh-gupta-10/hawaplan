import { describe, expect, it, vi } from "vitest";
import worker from "../src/worker";

const env = { AI: { run: vi.fn() }, DB: {} as D1Database };
const context = { waitUntil: vi.fn() } as unknown as ExecutionContext;
const request = (path: string, init?: RequestInit) =>
  new Request(`https://hawaplan.example${path}`, init);

describe("security policies and HTTP response headers", () => {
  it("enforces security headers on all API responses", async () => {
    const response = await worker.fetch(request("/api/health"), env, context);
    expect(response.status).toBe(200);

    const headers = response.headers;
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Permissions-Policy")).toBe("geolocation=(self)");
  });

  it("rejects cross-origin mutations while permitting safe reads", async () => {
    const crossOriginPost = await worker.fetch(
      request("/api/ask", {
        method: "POST",
        headers: { Origin: "https://malicious.example" },
        body: JSON.stringify({ question: "Test" }),
      }),
      env,
      context,
    );
    expect(crossOriginPost.status).toBe(403);
    expect(await crossOriginPost.json()).toEqual({
      error: "Cross-origin request rejected.",
    });

    const crossOriginGet = await worker.fetch(
      request("/api/health", {
        method: "GET",
        headers: { Origin: "https://another.example" },
      }),
      env,
      context,
    );
    expect(crossOriginGet.status).toBe(200);
  });

  it("validates health check endpoint with environment flags", async () => {
    const response = await worker.fetch(request("/api/health"), env, context);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      ai: boolean;
      storage: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.ai).toBe(true);
  });

  it("short-circuits place searches shorter than two characters", async () => {
    const res = await worker.fetch(request("/api/places?q=a"), env, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
  });

  it("returns null place when network location metadata is absent", async () => {
    const res = await worker.fetch(request("/api/location"), env, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ place: null });
  });

  it("returns 404 for unknown API endpoints", async () => {
    const res = await worker.fetch(request("/api/unknown"), env, context);
    expect(res.status).toBe(404);
  });
});
