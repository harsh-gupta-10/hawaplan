import { describe, expect, it } from "vitest";
import {
  buildPlan,
  type Forecast,
  type PlanOptions,
} from "../src/shared/planner";

const forecast: Forecast = {
  city: "Test city",
  latitude: 28,
  longitude: 77,
  timezone: "Asia/Kolkata",
  currentTime: "2026-11-19T10:00",
  currentPm25: 80,
  updatedAt: "2026-11-19T04:30:00Z",
  source: "Open-Meteo CAMS model",
  hours: Array.from({ length: 14 }, (_, index) => ({
    time: `2026-11-19T${String(index + 10).padStart(2, "0")}:00`,
    pm25: index === 3 ? 50 : index === 5 ? 100 : 80,
    pm10: 120,
    aqi: 150,
  })),
};

const options: PlanOptions = {
  activity: "school",
  preferredHour: 15,
  durationMinutes: 60,
  flexibilityHours: 2,
  travelMode: "car",
  sensitive: true,
  vulnerabilityProfile: "general",
};

describe("outing comparison", () => {
  it("selects the lowest modeled window within the allowed hours", () => {
    const plan = buildPlan(forecast, options);
    expect(plan.baseline?.averagePm25).toBe(100);
    expect(plan.best?.start).toBe("2026-11-19T13:00");
    expect(plan.reductionPercent).toBe(50);
    expect(plan.aqiCategory).toBeDefined();
  });

  it("respects a fixed commitment even when a lower hour exists", () => {
    const plan = buildPlan(forecast, { ...options, flexibilityHours: 0 });
    expect(plan.best?.start).toBe("2026-11-19T15:00");
    expect(plan.reductionPercent).toBe(0);
  });

  it("does not compare against a past hour", () => {
    const plan = buildPlan(
      { ...forecast, currentTime: "2026-11-19T16:00" },
      options,
    );
    expect(plan.baseline).toBeNull();
    expect(plan.reductionPercent).toBeNull();
  });

  it("weights partial hours and shows the actual end time", () => {
    const plan = buildPlan(forecast, {
      ...options,
      preferredHour: 12,
      durationMinutes: 90,
      flexibilityHours: 0,
    });
    expect(plan.baseline?.averagePm25).toBe(70);
    expect(plan.baseline?.end).toBe("2026-11-19T13:30");
  });

  it("tailors guidance for different vulnerability profiles", () => {
    expect(
      buildPlan(forecast, { ...options, vulnerabilityProfile: "children" })
        .careAction,
    ).toContain("Children breathe more air");

    expect(
      buildPlan(forecast, { ...options, vulnerabilityProfile: "elderly" })
        .careAction,
    ).toContain("older adults");

    expect(
      buildPlan(forecast, { ...options, vulnerabilityProfile: "respiratory" })
        .careAction,
    ).toContain("asthma or respiratory");

    expect(
      buildPlan(forecast, { ...options, vulnerabilityProfile: "athletes" })
        .careAction,
    ).toContain("High-ventilation");

    expect(
      buildPlan(forecast, { ...options, sensitive: false }).careAction,
    ).toBeNull();
  });

  it("tailors travel mode emission actions appropriately", () => {
    expect(
      buildPlan(forecast, { ...options, travelMode: "car" }).emissionAction,
    ).toContain("separate drive means one fewer car trip");

    expect(
      buildPlan(forecast, { ...options, travelMode: "bus" }).emissionAction,
    ).toContain("shared bus trip");

    expect(
      buildPlan(forecast, { ...options, travelMode: "walk" }).emissionAction,
    ).toContain("avoids a private car trip");

    expect(
      buildPlan(forecast, { ...options, travelMode: "cycle" }).emissionAction,
    ).toContain("avoids a private car trip");
  });

  it("uses the selected calendar date instead of the first upcoming day", () => {
    const later = {
      ...forecast,
      hours: [
        ...forecast.hours,
        ...forecast.hours.map((point) => ({
          ...point,
          time: point.time.replace("2026-11-19", "2026-11-20"),
          pm25: 35,
        })),
      ],
    };
    expect(buildPlan(later, options, "2026-11-20").best?.start).toBe(
      "2026-11-20T13:00",
    );
    expect(buildPlan(later, options, "2026-11-21").best).toBeNull();
  });

  it("avoids overnight flexible exercise slots but respects a fixed early time", () => {
    const exerciseForecast = {
      ...forecast,
      currentTime: "2026-11-19T01:00",
      hours: Array.from({ length: 12 }, (_, hour) => ({
        time: `2026-11-19T${String(hour + 1).padStart(2, "0")}:00`,
        pm25: hour === 1 ? 10 : hour === 6 ? 30 : 80,
        pm10: 100,
        aqi: 90,
      })),
    };
    const exercise = {
      ...options,
      activity: "exercise" as const,
      preferredHour: 7,
      flexibilityHours: 6,
    };
    expect(buildPlan(exerciseForecast, exercise).best?.start).toBe(
      "2026-11-19T07:00",
    );
    expect(
      buildPlan(exerciseForecast, {
        ...exercise,
        preferredHour: 2,
        flexibilityHours: 0,
      }).best?.start,
    ).toBe("2026-11-19T02:00");
  });
});
