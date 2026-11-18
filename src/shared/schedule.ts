import type { PlanOptions } from "./planner";
import { activityLabels } from "./planner";
import type { Place } from "./saved";

export type SpanDays = 1 | 7 | 30;

export function addDays(date: string, amount: number): string {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return new Date(timestamp + amount * 86_400_000).toISOString().slice(0, 10);
}

export function scheduleDates(
  startDate: string,
  spanDays: SpanDays,
  weekdaysOnly = false,
): string[] {
  const dates = Array.from({ length: spanDays }, (_, index) =>
    addDays(startDate, index),
  );
  return spanDays === 1 || !weekdaysOnly
    ? dates
    : dates.filter((date) => {
        const day = new Date(`${date}T00:00:00Z`).getUTCDay();
        return day >= 1 && day <= 5;
      });
}

export function formatScheduleDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function calendarStamp(
  date: string,
  hour: number,
  minute: number,
  offsetMinutes: number,
): string {
  const time = new Date(
    Date.parse(`${date}T00:00:00Z`) +
      (hour * 60 + minute + offsetMinutes) * 60_000,
  );
  return time.toISOString().replace(/[-:]/g, "").slice(0, 15);
}

export function googleCalendarUrl(input: {
  startDate: string;
  spanDays: SpanDays;
  options: PlanOptions;
  place: Place;
  timezone?: string;
  chosenStart?: string | null;
  emissionAction?: string;
  indoorAction?: string;
  weekdaysOnly?: boolean;
  summary?: string;
}): string {
  const { startDate, spanDays, options, place } = input;
  const dates = scheduleDates(startDate, spanDays, input.weekdaysOnly);
  const eventDate = dates[0] ?? startDate;
  const chosen =
    spanDays === 1 && input.chosenStart?.startsWith(`${startDate}T`)
      ? input.chosenStart
      : null;
  const hour = chosen ? Number(chosen.slice(11, 13)) : options.preferredHour;
  const minute = chosen ? Number(chosen.slice(14, 16)) : 0;
  const start = calendarStamp(eventDate, hour, minute, 0);
  const end = calendarStamp(eventDate, hour, minute, options.durationMinutes);
  const details = [
    `HawaPlan ${spanDays === 1 ? "outing plan" : `${spanDays}-day ${input.weekdaysOnly ? "weekday " : ""}routine`} for ${place.name}.`,
    spanDays === 1 && chosen
      ? "Time chosen from the current modeled outdoor air forecast."
      : "Time uses your preferred hour. Recheck the air forecast before each outing; future conditions can change.",
    input.summary,
    input.emissionAction,
    input.indoorAction,
    "Outdoor air forecasts are broad-area estimates, not personal exposure readings.",
    "https://hawaplan.harshgupta24716.workers.dev",
  ]
    .filter(Boolean)
    .join("\n\n");
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set(
    "text",
    `${activityLabels[options.activity]} · HawaPlan`,
  );
  url.searchParams.set("dates", `${start}/${end}`);
  url.searchParams.set("details", details);
  url.searchParams.set(
    "location",
    [place.name, place.admin1, place.country].filter(Boolean).join(", "),
  );
  if (input.timezone && input.timezone !== "local")
    url.searchParams.set("ctz", input.timezone);
  if (spanDays > 1)
    url.searchParams.set(
      "recur",
      input.weekdaysOnly
        ? `RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=${dates.length}`
        : `RRULE:FREQ=DAILY;COUNT=${spanDays}`,
    );
  return url.toString();
}
