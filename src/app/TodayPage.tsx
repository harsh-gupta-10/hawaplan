import type { RefObject } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CloudFog,
  Info,
  LocateFixed,
  RefreshCw,
  Save,
} from "lucide-react";
import {
  formatTime,
  getAqiCategory,
  type Forecast,
  type Plan,
  type PlanOptions,
} from "../shared/planner";
import { formatScheduleDate, type SpanDays } from "../shared/schedule";
import type { AppData, Place } from "../shared/saved";
import AirChart from "./AirChart";
import PlannerSection from "./PlannerSection";
import ConversationSection from "./ConversationSection";
import AqiBadge from "./components/AqiBadge";

interface TodayPageProps {
  place: Place;
  data: AppData;
  signedIn: boolean;
  options: PlanOptions;
  today: string;
  startDate: string;
  spanDays: SpanDays;
  weekdaysOnly: boolean;
  forecast: Forecast | null;
  plan: Plan | null;
  schedule: { date: string; dayPlan: Plan | null }[];
  loadingForecast: boolean;
  forecastError: string;
  now: number;
  calendarUrl: string;
  locating: boolean;
  locationError: string;
  question: string;
  asking: boolean;
  askError: string;
  chatEnd: RefObject<HTMLDivElement | null>;
  onUseDeviceLocation: () => void;
  onUpdateSchedule: (startDate: string, spanDays: SpanDays) => void;
  onUpdateWeekdaysOnly: (weekdaysOnly: boolean) => void;
  onSavePlan: () => void;
  onRefresh: () => void;
  onOptionChange: <K extends keyof PlanOptions>(
    key: K,
    value: PlanOptions[K],
  ) => void;
  onClearChat: () => void;
  onQuestionChange: (question: string) => void;
  onAsk: () => void;
  onOpenCaregiverBrief?: () => void;
}

export default function TodayPage({
  place,
  data,
  signedIn,
  options,
  today,
  startDate,
  spanDays,
  weekdaysOnly,
  forecast,
  plan,
  schedule,
  loadingForecast,
  forecastError,
  now,
  calendarUrl,
  locating,
  locationError,
  question,
  asking,
  askError,
  chatEnd,
  onUseDeviceLocation,
  onUpdateSchedule,
  onUpdateWeekdaysOnly,
  onSavePlan,
  onRefresh,
  onOptionChange,
  onClearChat,
  onQuestionChange,
  onAsk,
  onOpenCaregiverBrief,
}: TodayPageProps) {
  const forecastDate = formatScheduleDate(startDate);
  const current = forecast?.currentPm25;
  const currentAqi = forecast
    ? getAqiCategory(forecast.currentPm25, forecast.hours[0]?.aqi)
    : null;
  const bestDifferent = Boolean(
    plan?.best && plan?.baseline && plan.best.start !== plan.baseline.start,
  );
  const forecastIsOld = Boolean(
    forecast && now - Date.parse(forecast.updatedAt) > 20 * 60_000,
  );

  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <div className="breadcrumb">
            TODAY’S OUTLOOK <span>/</span> {place.name.toUpperCase()}
          </div>
          <h1>
            Make room for a <em>clearer day.</em>
          </h1>
          <p>
            A thoughtful plan for the places you need to go and the people you
            care for.
          </p>
        </div>
        <div className="date-badge">{forecastDate}</div>
      </div>

      {(place.source === "network" || data.preferencesUpdatedAt === 0) && (
        <div className="location-nudge">
          <span className="nudge-icon" aria-hidden="true">
            <LocateFixed size={18} />
          </span>
          <div>
            <strong>
              {place.source === "network"
                ? `We found ${place.name} from your network.`
                : "Start with your own location."}
            </strong>
            <p>
              {place.source === "network"
                ? "This is approximate. Use your current area for a more relevant forecast, or choose a city."
                : "New Delhi is shown as a starting point. Use your current area or choose a city."}
            </p>
          </div>
          <button
            type="button"
            onClick={onUseDeviceLocation}
            disabled={locating}
          >
            {locating ? "Locating…" : "Use my location"}{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
          {locationError && (
            <span className="nudge-error" role="alert">
              {locationError}
            </span>
          )}
        </div>
      )}

      <section className="schedule-bar" aria-label="Choose when to plan">
        <div className="schedule-bar-title">
          <span className="schedule-icon" aria-hidden="true">
            <CalendarDays size={21} />
          </span>
          <div>
            <strong>When are you planning?</strong>
            <small>
              Pick a day, then plan one outing or a repeatable routine.
            </small>
          </div>
        </div>

        <div className="schedule-bar-fields">
          <label htmlFor="schedule-start-date">
            Start date
            <input
              id="schedule-start-date"
              aria-label="Plan start date"
              type="date"
              min={today}
              value={startDate}
              onChange={(event) =>
                onUpdateSchedule(event.target.value || today, spanDays)
              }
            />
          </label>

          <label htmlFor="schedule-span-days">
            Plan length
            <select
              id="schedule-span-days"
              aria-label="Plan length"
              value={spanDays}
              onChange={(event) =>
                onUpdateSchedule(
                  startDate,
                  Number(event.target.value) as SpanDays,
                )
              }
            >
              <option value={1}>One day</option>
              <option value={7}>Next 7 days</option>
              <option value={30}>Next 30 days</option>
            </select>
          </label>
        </div>

        <button type="button" className="save-plan-button" onClick={onSavePlan}>
          <Save size={16} aria-hidden="true" /> Save plan
        </button>

        <a
          className="calendar-link"
          href={calendarUrl}
          target="_blank"
          rel="noreferrer"
        >
          <CalendarDays size={16} aria-hidden="true" /> Review in Google
          Calendar <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </section>

      {spanDays > 1 && (
        <div className="schedule-caveat">
          <label className="weekday-toggle" htmlFor="schedule-weekdays-only">
            <input
              id="schedule-weekdays-only"
              type="checkbox"
              checked={weekdaysOnly}
              onChange={(event) => onUpdateWeekdaysOnly(event.target.checked)}
            />{" "}
            Weekdays only
          </label>
          <p>
            Calendar repeats your preferred time on the selected days. Air-based
            timing appears only where a forecast is available; recheck before
            each outing.
          </p>
        </div>
      )}

      <section className="hero-grid">
        <div className="hero-card">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span className="mini-star" aria-hidden="true">
                ✳
              </span>{" "}
              A LITTLE PLANNING HELPS
            </span>
            <h2>
              {loadingForecast && !forecast
                ? "Finding your air outlook…"
                : "A calmer day starts with one good choice."}
            </h2>
            <p>
              See the next hours, shape an outing around your real schedule, and
              know what each choice changes.
            </p>
            <button
              type="button"
              className="hero-link"
              onClick={() =>
                document
                  .getElementById("planner")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Build today’s plan <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-sun" />
            <div className="art-hill hill-back" />
            <div className="art-hill hill-front" />
            <div className="art-cloud cloud-a" />
            <div className="art-cloud cloud-b" />
          </div>
        </div>

        <div className="now-card">
          <div className="now-top">
            <span className="eyebrow">OUTDOOR MODEL · NOW</span>
            <CloudFog size={21} aria-hidden="true" />
          </div>
          <div className="now-number">
            {current == null ? "—" : Math.round(current)}
            <span>µg/m³</span>
          </div>
          <div className="now-sub">PM₂.₅ around {place.name}</div>

          {currentAqi && (
            <div className="now-aqi-badge">
              <AqiBadge aqiCategory={currentAqi} showAdvisory={false} />
            </div>
          )}

          <div className="now-divider" />
          <div className="now-bottom">
            <span
              className={`status-dot ${forecastIsOld ? "high" : ""}`}
              aria-hidden="true"
            />
            <strong>
              {forecastIsOld ? "Saved forecast" : "Latest forecast"}
            </strong>
            <span className="now-timestamp">
              {forecast?.currentTime ? formatTime(forecast.currentTime) : "—"}
            </span>
          </div>
          <p>
            Outdoor model estimate. Your exact route or indoor air can differ.
          </p>
        </div>
      </section>

      {forecastError && (
        <div className="inline-error" role="status">
          <Info size={18} aria-hidden="true" /> {forecastError}
          <button type="button" onClick={() => onRefresh()}>
            <RefreshCw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {forecast && (
        <div className="chart-card">
          <AirChart forecast={forecast} selectedTime={plan?.best?.start} />
          <button
            type="button"
            className="chart-refresh"
            onClick={() => onRefresh()}
            disabled={loadingForecast}
          >
            <RefreshCw
              size={14}
              className={loadingForecast ? "spin" : ""}
              aria-hidden="true"
            />{" "}
            Refresh forecast
          </button>
        </div>
      )}

      <PlannerSection
        options={options}
        plan={plan}
        bestDifferent={bestDifferent}
        loadingForecast={loadingForecast}
        signedIn={signedIn}
        startDate={startDate}
        onOptionChange={onOptionChange}
        onSavePlan={onSavePlan}
        onOpenCaregiverBrief={onOpenCaregiverBrief}
      />

      {spanDays > 1 && (
        <section className="schedule-overview">
          <div className="schedule-overview-head">
            <div>
              <span className="eyebrow">YOUR UPCOMING ROUTINE</span>
              <h2>{spanDays}-day plan</h2>
              <p>
                Each scheduled day uses the same preferred time in Google
                Calendar. Forecast windows below are a planning guide and can
                change.
              </p>
            </div>
            <span className="schedule-count">
              {schedule.filter((day) => day.dayPlan?.best).length} forecast days
            </span>
          </div>
          <div className="schedule-list">
            {schedule.map(({ date, dayPlan }) => (
              <div className="schedule-day" key={date}>
                <span className="schedule-day-date">
                  {formatScheduleDate(date)}
                </span>
                <span className="schedule-day-time">
                  {dayPlan?.best
                    ? formatTime(dayPlan.best.start)
                    : formatTime(
                        `${date}T${String(options.preferredHour).padStart(2, "0")}:00`,
                      )}
                </span>
                <span
                  className={`schedule-day-status ${dayPlan?.best ? "forecasted" : ""}`}
                >
                  {dayPlan?.best
                    ? `${dayPlan.best.averagePm25} µg/m³ modeled`
                    : "Recheck forecast later"}
                </span>
              </div>
            ))}
          </div>
          <div className="schedule-overview-actions">
            <button
              type="button"
              className="save-plan-button"
              onClick={onSavePlan}
            >
              <Save size={16} aria-hidden="true" /> Save this routine
            </button>
            <a
              className="calendar-link"
              href={calendarUrl}
              target="_blank"
              rel="noreferrer"
            >
              <CalendarDays size={16} aria-hidden="true" /> Review in Google
              Calendar <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </section>
      )}

      <ConversationSection
        messages={data.messages}
        signedIn={signedIn}
        forecast={forecast}
        question={question}
        asking={asking}
        askError={askError}
        chatEnd={chatEnd}
        onClearChat={onClearChat}
        onQuestionChange={onQuestionChange}
        onAsk={onAsk}
      />
    </div>
  );
}
