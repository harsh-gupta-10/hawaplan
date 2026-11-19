import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/worker";

const forecast = {
  timezone: "Asia/Kolkata",
  current: { time: "2026-11-19T10:00", pm2_5: 82 },
  hourly: {
    time: ["2026-11-19T10:00", "2026-11-19T11:00"],
    pm2_5: [82, 65],
    pm10: [110, 95],
    us_aqi: [145, 120],
  },
};

const options = {
  activity: "school",
  preferredHour: 10,
  durationMinutes: 30,
  flexibilityHours: 2,
  travelMode: "bus",
  sensitive: true,
};

const run = vi.fn(async (_model: string, _input: Record<string, unknown>) => ({
  response: "Use shared transit where practical.",
}));
const env = { AI: { run }, DB: {} as D1Database };
const context = { waitUntil: vi.fn() } as unknown as ExecutionContext;
const request = (path: string, init?: RequestInit) =>
  new Request(`https://hawaplan.example${path}`, init);
const respond = (path: string, init?: RequestInit) =>
  worker.fetch(request(path, init), env, context);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("public API validation", () => {
  it.each([
    "/api/forecast",
    "/api/forecast?lat=&lon=77",
    "/api/forecast?lat=28&lon=",
    "/api/forecast?lat=91&lon=77",
    "/api/forecast?lat=28&lon=NaN",
  ])("rejects invalid forecast coordinates: %s", async (path) => {
    const response = await respond(path);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid coordinates." });
  });

  it.each(["null", "[]", "42", "{bad json}"])(
    "rejects a malformed AI request: %s",
    async (body) => {
      const response = await respond("/api/ask", {
        method: "POST",
        body,
      });
      expect(response.status).toBe(400);
      expect(run).not.toHaveBeenCalled();
    },
  );

  it("rejects oversized and cross-origin writes before running AI", async () => {
    const oversized = await respond("/api/ask", {
      method: "POST",
      body: "x".repeat(6001),
    });
    expect(oversized.status).toBe(413);
    const crossOrigin = await respond("/api/ask", {
      method: "POST",
      headers: { Origin: "https://another.example" },
      body: "{}",
    });
    expect(crossOrigin.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it("does not accept null coordinates as zero", async () => {
    const response = await respond("/api/ask", {
      method: "POST",
      body: JSON.stringify({
        question: "Can we go outside?",
        latitude: null,
        longitude: 77.21,
        options,
      }),
    });
    expect(response.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("grounded assistant API", () => {
  it("passes fresh forecast facts to Workers AI and returns its answer", async () => {
    const fetchMock = vi.fn(async () => Response.json(forecast));
    vi.stubGlobal("fetch", fetchMock);
    const response = await respond("/api/ask", {
      method: "POST",
      body: JSON.stringify({
        question: "How can I reduce emissions on the school run?",
        latitude: 28.61,
        longitude: 77.21,
        city: "New Delhi",
        options,
        history: [{ role: "user", content: "Our time is fixed." }],
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      answer: "Use shared transit where practical.",
      source: "Open-Meteo CAMS model",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [model, input] = run.mock.calls[0];
    expect(model).toBe("@cf/google/gemma-4-26b-a4b-it");
    expect(JSON.stringify(input)).toContain("Open-Meteo CAMS model");
    expect(JSON.stringify(input)).toContain("Our time is fixed.");
  });
});
