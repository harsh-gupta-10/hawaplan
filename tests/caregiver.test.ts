import { describe, expect, it } from "vitest";
import { caregiverSummaryText } from "../src/shared/schedule";
import { defaultPlace } from "../src/shared/saved";

describe("caregiver summary brief generation", () => {
  it("formats structured text brief with all essential facts", () => {
    const brief = caregiverSummaryText({
      place: defaultPlace,
      activity: "School run",
      date: "2026-11-20",
      timeWindow: "8:00 AM – 9:00 AM",
      summary: "35 µg/m³ modeled ambient PM₂.₅",
      careAction: "Children breathe more air relative to body weight.",
      emissionAction: "Keep using the shared bus trip where practical.",
      indoorAction: "Move this activity indoors in a clean room.",
    });

    expect(brief).toContain("HAWAPLAN CARE BRIEF · NEW DELHI");
    expect(brief).toContain("School run");
    expect(brief).toContain("8:00 AM – 9:00 AM");
    expect(brief).toContain("35 µg/m³");
    expect(brief).toContain("SENSITIVE CARE GUIDANCE");
    expect(brief).toContain("Children breathe more air");
    expect(brief).toContain("INDOOR BACKUP");
    expect(brief).toContain("TRAVEL ADVICE");
  });

  it("safely omits optional sections when absent", () => {
    const brief = caregiverSummaryText({
      place: defaultPlace,
      activity: "Errands",
      date: "2026-11-20",
      timeWindow: "2:00 PM – 3:00 PM",
      summary: "Acceptable conditions",
    });

    expect(brief).toContain("HAWAPLAN CARE BRIEF");
    expect(brief).not.toContain("SENSITIVE CARE GUIDANCE");
    expect(brief).not.toContain("INDOOR BACKUP");
    expect(brief).not.toContain("TRAVEL ADVICE");
  });
});
