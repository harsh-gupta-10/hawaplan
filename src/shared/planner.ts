/**
 * @file planner.ts
 * Deterministic air quality outing planner and exposure-window comparison logic.
 * Computes duration-weighted PM2.5 averages and grounded guidance.
 */

export type Activity = "school" | "walk" | "errands" | "exercise";
export type TravelMode = "car" | "bus" | "walk" | "cycle";
export type VulnerabilityProfile =
  "general" | "children" | "elderly" | "respiratory" | "athletes";

export type AqiLevel =
  | "good"
  | "moderate"
  | "sensitive"
  | "unhealthy"
  | "very_unhealthy"
  | "hazardous";

export interface AqiCategory {
  level: AqiLevel;
  label: string;
  color: string;
  bgColor: string;
  advisory: string;
}

export interface HourPoint {
  time: string;
  pm25: number;
  pm10: number;
  aqi: number | null;
}

export interface Forecast {
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  currentTime: string;
  currentPm25: number;
  updatedAt: string;
  hours: HourPoint[];
  source: "Open-Meteo CAMS model";
}

export interface PlanOptions {
  activity: Activity;
  preferredHour: number;
  durationMinutes: number;
  flexibilityHours: number;
  travelMode: TravelMode;
  sensitive: boolean;
  vulnerabilityProfile?: VulnerabilityProfile;
}

export interface WindowChoice {
  start: string;
  end: string;
  averagePm25: number;
  averageAqi: number | null;
}

export interface Plan {
  baseline: WindowChoice | null;
  best: WindowChoice | null;
  reductionPercent: number | null;
  alternateCount: number;
  emissionAction: string;
  indoorAction: string;
  careAction: string | null;
  aqiCategory?: AqiCategory;
}

const hourOf = (time: string) => Number(time.slice(11, 13));
const dateOf = (time: string) => time.slice(0, 10);
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Calculates standard US EPA AQI category and health guidance from PM2.5 or US AQI index.
 * Breakpoints aligned with EPA National Ambient Air Quality Standards and WHO air quality guidelines.
 *
 * @param pm25 Modeled PM2.5 concentration in µg/m³
 * @param aqi Optional US AQI index if reported by provider
 */
export function getAqiCategory(pm25: number, aqi?: number | null): AqiCategory {
  if (aqi !== null && aqi !== undefined && Number.isFinite(aqi)) {
    if (aqi <= 50) {
      return {
        level: "good",
        label: "Good",
        color: "#2a7040",
        bgColor: "#e7f4eb",
        advisory: "Air quality is satisfactory and poses little or no risk.",
      };
    }
    if (aqi <= 100) {
      return {
        level: "moderate",
        label: "Moderate",
        color: "#72651e",
        bgColor: "#fef9e7",
        advisory:
          "Acceptable air quality; unusually sensitive people should consider reducing prolonged outdoor exertion.",
      };
    }
    if (aqi <= 150) {
      return {
        level: "sensitive",
        label: "Unhealthy for Sensitive Groups",
        color: "#b05d15",
        bgColor: "#fef3e9",
        advisory:
          "Members of sensitive groups (children, seniors, asthma sufferers) may experience health effects.",
      };
    }
    if (aqi <= 200) {
      return {
        level: "unhealthy",
        label: "Unhealthy",
        color: "#b83020",
        bgColor: "#fdeeed",
        advisory:
          "Everyone may begin to experience health effects; members of sensitive groups may experience more serious effects.",
      };
    }
    if (aqi <= 300) {
      return {
        level: "very_unhealthy",
        label: "Very Unhealthy",
        color: "#6b2c82",
        bgColor: "#f7ecfa",
        advisory:
          "Health alert: the risk of health effects is increased for everyone. Avoid prolonged outdoor exertion.",
      };
    }
    return {
      level: "hazardous",
      label: "Hazardous",
      color: "#6b1424",
      bgColor: "#fcedf0",
      advisory:
        "Health warning of emergency conditions: everyone is more likely to be affected. Keep all activities indoors.",
    };
  }

  // Fallback to PM2.5 breakpoints (US EPA standards in µg/m³)
  if (pm25 <= 12.0) {
    return {
      level: "good",
      label: "Good",
      color: "#2a7040",
      bgColor: "#e7f4eb",
      advisory: "Air quality is satisfactory and poses little or no risk.",
    };
  }
  if (pm25 <= 35.4) {
    return {
      level: "moderate",
      label: "Moderate",
      color: "#72651e",
      bgColor: "#fef9e7",
      advisory:
        "Acceptable air quality; unusually sensitive individuals should watch for cough or shortness of breath.",
    };
  }
  if (pm25 <= 55.4) {
    return {
      level: "sensitive",
      label: "Unhealthy for Sensitive Groups",
      color: "#b05d15",
      bgColor: "#fef3e9",
      advisory:
        "Sensitive groups should reduce prolonged or heavy exertion outdoors. Keep inhalers or medicine handy.",
    };
  }
  if (pm25 <= 150.4) {
    return {
      level: "unhealthy",
      label: "Unhealthy",
      color: "#b83020",
      bgColor: "#fdeeed",
      advisory:
        "Active people and children should avoid prolonged outdoor exertion; consider well-fitted N95 masks when outside.",
    };
  }
  if (pm25 <= 250.4) {
    return {
      level: "very_unhealthy",
      label: "Very Unhealthy",
      color: "#6b2c82",
      bgColor: "#f7ecfa",
      advisory:
        "Health alert: everyone should avoid outdoor exertion. Run indoor air filtration and seal doors/windows.",
    };
  }
  return {
    level: "hazardous",
    label: "Hazardous",
    color: "#6b1424",
    bgColor: "#fcedf0",
    advisory:
      "Emergency warning: remain indoors with clean air. Avoid outdoor exposure entirely.",
  };
}

/**
 * Builds a sliding time window starting at `points[index]` for `durationMinutes`.
 * Duration-weights hourly segments to handle fractional periods (e.g. 30m, 90m).
 */
function makeWindow(
  points: HourPoint[],
  index: number,
  durationMinutes: number,
): WindowChoice | null {
  const count = Math.max(1, Math.ceil(durationMinutes / 60));
  const sample = points.slice(index, index + count);
  if (
    sample.length !== count ||
    sample.some(
      (point, offset) =>
        Date.parse(`${point.time}Z`) !==
        Date.parse(`${sample[0].time}Z`) + offset * 3_600_000,
    )
  )
    return null;
  let remaining = durationMinutes;
  const weights = sample.map(() => {
    const minutes = Math.min(60, remaining);
    remaining -= minutes;
    return minutes;
  });
  const averagePm25 =
    sample.reduce(
      (total, point, offset) => total + point.pm25 * weights[offset],
      0,
    ) / durationMinutes;
  const hasAqi = sample.every((point) => point.aqi !== null);
  return {
    start: sample[0].time,
    end: new Date(Date.parse(`${sample[0].time}Z`) + durationMinutes * 60_000)
      .toISOString()
      .slice(0, 16),
    averagePm25: round(averagePm25),
    averageAqi: hasAqi
      ? Math.round(
          sample.reduce(
            (total, point, offset) =>
              total + (point.aqi ?? 0) * weights[offset],
            0,
          ) / durationMinutes,
        )
      : null,
  };
}

const careGuidanceByProfile: Record<VulnerabilityProfile, string> = {
  general:
    "For someone needing extra care, follow local public health guidance and keep an indoor option available when feasible.",
  children:
    "Children breathe more air relative to body weight. For school runs or play, choose the cleanest available window and avoid standing near vehicle exhaust or idling zones.",
  elderly:
    "For older adults or cardiovascular sensitivity, prioritize windows with the lowest PM₂.₅, maintain a moderate pace, and keep a clean indoor room ready.",
  respiratory:
    "For asthma or respiratory sensitivity, keep prescribed quick-relief medication readily accessible, wear a certified N95/FFP2 mask when outdoor PM₂.₅ is elevated, and minimize heavy exertion.",
  athletes:
    "High-ventilation outdoor workouts deposit significantly more particulates in deep lung tissue. Shift intense training to lower-pollution hours or indoors.",
};

/**
 * Builds an outing plan by comparing the user's preferred time with the lowest
 * modeled outdoor PM2.5 window fitting their schedule constraints.
 *
 * @param forecast 7-day hourly forecast
 * @param options User constraints and preferences
 * @param selectedDate Optional YYYY-MM-DD date filter
 */
export function buildPlan(
  forecast: Forecast,
  options: PlanOptions,
  selectedDate?: string,
): Plan {
  const upcoming = forecast.hours.filter(
    (point) =>
      point.time >= forecast.currentTime &&
      (!selectedDate || dateOf(point.time) === selectedDate) &&
      Number.isFinite(point.pm25),
  );
  const baselineIndex = upcoming.findIndex(
    (point) => hourOf(point.time) === options.preferredHour,
  );
  const baseline =
    baselineIndex >= 0
      ? makeWindow(upcoming, baselineIndex, options.durationMinutes)
      : null;
  const day = baseline ? dateOf(baseline.start) : "";
  const flexibility = Math.max(0, Math.min(6, options.flexibilityHours));
  const practicalHours: Record<Activity, [number, number]> = {
    school: [6, 18],
    walk: [6, 20],
    errands: [7, 21],
    exercise: [6, 20],
  };
  const [earliest, latest] = practicalHours[options.activity];
  const candidates = upcoming.flatMap((point, index) => {
    const hour = hourOf(point.time);
    if (
      dateOf(point.time) !== day ||
      Math.abs(hour - options.preferredHour) > flexibility ||
      (hour !== options.preferredHour && (hour < earliest || hour > latest))
    )
      return [];
    const window = makeWindow(upcoming, index, options.durationMinutes);
    return window ? [window] : [];
  });
  const best =
    candidates.sort((a, b) => a.averagePm25 - b.averagePm25)[0] ?? baseline;
  const reductionPercent =
    baseline && best && baseline.averagePm25 > 0
      ? Math.max(
          0,
          Math.round((1 - best.averagePm25 / baseline.averagePm25) * 100),
        )
      : null;

  const emissionAction =
    options.travelMode === "car"
      ? "Combine this outing with another necessary stop when possible. Replacing a separate drive means one fewer car trip."
      : options.travelMode === "bus"
        ? "Keep using the shared bus trip where practical; it avoids adding a separate private vehicle trip."
        : "Your current travel mode avoids a private car trip. Choose a lower-pollution time when your schedule allows.";

  const indoorAction =
    options.activity === "exercise" || options.activity === "walk"
      ? "If an outdoor window does not work, move this activity indoors in a space with fewer indoor smoke sources."
      : "At home, reduce indoor smoke sources such as incense or smoking; use a kitchen exhaust while cooking if available.";

  const profile = options.vulnerabilityProfile ?? "general";
  const careAction = options.sensitive
    ? (careGuidanceByProfile[profile] ?? careGuidanceByProfile.general)
    : null;

  const aqiCategory = best
    ? getAqiCategory(best.averagePm25, best.averageAqi)
    : undefined;

  return {
    baseline,
    best,
    reductionPercent,
    alternateCount: candidates.length,
    emissionAction,
    indoorAction,
    careAction,
    aqiCategory,
  };
}

/**
 * Formats an ISO-like date string (YYYY-MM-DDTHH:MM) into a human 12-hour format (e.g. 3:00 PM).
 */
export function formatTime(localTime: string): string {
  const hour = hourOf(localTime);
  return `${hour % 12 || 12}:${localTime.slice(14, 16) || "00"} ${hour >= 12 ? "PM" : "AM"}`;
}

export const activityLabels: Record<Activity, string> = {
  school: "School run",
  walk: "Family walk",
  errands: "Errands",
  exercise: "Outdoor exercise",
};

export const vulnerabilityLabels: Record<VulnerabilityProfile, string> = {
  general: "General extra care",
  children: "Children & infants",
  elderly: "Seniors & older adults",
  respiratory: "Asthma & respiratory",
  athletes: "Athletes & outdoor runners",
};
