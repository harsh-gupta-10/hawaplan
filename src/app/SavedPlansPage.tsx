import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Save,
  Trash2,
} from "lucide-react";
import { formatScheduleDate, googleCalendarUrl } from "../shared/schedule";
import type { SavedPlan } from "../shared/saved";

function formatSavedDate(value: number) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface SavedPlansPageProps {
  plans: SavedPlan[];
  onRemovePlan: (id: string) => void;
  onRestorePlan: (plan: SavedPlan) => void;
  onNavigateToday: () => void;
}

export default function SavedPlansPage({
  plans,
  onRemovePlan,
  onRestorePlan,
  onNavigateToday,
}: SavedPlansPageProps) {
  return (
    <div className="page-content secondary-page">
      <div className="breadcrumb">
        YOUR WORKSPACE <span>/</span> SAVED PLANS
      </div>
      <h1>
        Your plans, <em>ready when you are.</em>
      </h1>
      <p className="page-intro">
        Keep useful routines in one place. Restoring a plan refreshes the
        forecast for that location.
      </p>
      {plans.length ? (
        <div className="saved-grid">
          {plans.map((saved) => (
            <article className="saved-card" key={saved.id}>
              <div className="saved-top">
                <span>
                  <Save size={15} /> {saved.activity}
                </span>
                <button
                  onClick={() => onRemovePlan(saved.id)}
                  aria-label={`Remove ${saved.activity} plan`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h2>{saved.city}</h2>
              <p className="saved-time">{saved.time}</p>
              <p>{saved.summary}</p>
              <div className="saved-bottom">
                <span>
                  {saved.startDate
                    ? formatScheduleDate(saved.startDate)
                    : formatSavedDate(saved.at)}
                  {saved.spanDays && saved.spanDays > 1
                    ? ` · ${saved.spanDays} days`
                    : ""}
                </span>
                <button onClick={() => onRestorePlan(saved)}>
                  Open plan <ArrowRight size={15} />
                </button>
              </div>
              {saved.startDate && (
                <a
                  className="saved-calendar-link"
                  href={googleCalendarUrl({
                    startDate: saved.startDate,
                    spanDays: saved.spanDays ?? 1,
                    options: saved.options,
                    place: saved.place,
                    timezone: saved.timezone,
                    chosenStart: saved.chosenStart,
                    weekdaysOnly: saved.weekdaysOnly,
                    summary: saved.summary,
                  })}
                  target="_blank"
                  rel="noreferrer"
                >
                  <CalendarDays size={15} /> Review in Google Calendar{" "}
                  <ArrowUpRight size={14} />
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-plans">
          <div>
            <Save size={28} />
          </div>
          <h2>No saved plans yet</h2>
          <p>Build an outing plan and save it here for another day.</p>
          <button onClick={() => onNavigateToday()}>
            Plan an outing <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
