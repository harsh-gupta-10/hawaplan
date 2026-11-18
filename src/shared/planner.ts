export type Activity = "school" | "walk" | "errands" | "exercise";
export type TravelMode = "car" | "bus" | "walk" | "cycle";

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
}

const hourOf = (time: string) => Number(time.slice(11, 13));
const dateOf = (time: string) => time.slice(0, 10);
const round = (value: number) => Math.round(value * 10) / 10;

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
  const careAction = options.sensitive
    ? "For someone needing extra care, follow local public health guidance and keep an indoor option available when feasible."
    : null;

  return {
    baseline,
    best,
    reductionPercent,
    alternateCount: candidates.length,
    emissionAction,
    indoorAction,
    careAction,
  };
}

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
