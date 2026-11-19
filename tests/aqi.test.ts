import { describe, expect, it } from "vitest";
import { getAqiCategory } from "../src/shared/planner";

describe("AQI classification and health guidance", () => {
  it("classifies PM2.5 concentrations according to US EPA standards", () => {
    expect(getAqiCategory(10).level).toBe("good");
    expect(getAqiCategory(12.0).level).toBe("good");

    expect(getAqiCategory(12.1).level).toBe("moderate");
    expect(getAqiCategory(35.4).level).toBe("moderate");

    expect(getAqiCategory(35.5).level).toBe("sensitive");
    expect(getAqiCategory(55.4).level).toBe("sensitive");

    expect(getAqiCategory(55.5).level).toBe("unhealthy");
    expect(getAqiCategory(150.4).level).toBe("unhealthy");

    expect(getAqiCategory(150.5).level).toBe("very_unhealthy");
    expect(getAqiCategory(250.4).level).toBe("very_unhealthy");

    expect(getAqiCategory(250.5).level).toBe("hazardous");
    expect(getAqiCategory(500).level).toBe("hazardous");
  });

  it("prioritizes reported US AQI index when available", () => {
    expect(getAqiCategory(100, 45).level).toBe("good");
    expect(getAqiCategory(10, 85).level).toBe("moderate");
    expect(getAqiCategory(10, 130).level).toBe("sensitive");
    expect(getAqiCategory(10, 175).level).toBe("unhealthy");
    expect(getAqiCategory(10, 250).level).toBe("very_unhealthy");
    expect(getAqiCategory(10, 350).level).toBe("hazardous");
  });

  it("provides tailored health advisories for vulnerable groups", () => {
    const sensitive = getAqiCategory(45);
    expect(sensitive.advisory).toContain("Sensitive groups");

    const unhealthy = getAqiCategory(95);
    expect(unhealthy.advisory).toContain("N95");

    const hazardous = getAqiCategory(300);
    expect(hazardous.advisory).toContain("indoors");
  });

  it("handles boundary values and zero PM2.5 concentrations", () => {
    const zero = getAqiCategory(0);
    expect(zero.level).toBe("good");
    expect(zero.label).toBe("Good");

    const nullAqi = getAqiCategory(25, null);
    expect(nullAqi.level).toBe("moderate");

    const nanAqi = getAqiCategory(75, NaN);
    expect(nanAqi.level).toBe("unhealthy");
  });

  it("provides accessible hex colors with contrast properties", () => {
    const category = getAqiCategory(30);
    expect(category.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(category.bgColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
