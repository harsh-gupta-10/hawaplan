import {
  Activity,
  ArrowRight,
  Check,
  CloudFog,
  FileText,
  House,
  Leaf,
  Save,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import {
  formatTime,
  vulnerabilityLabels,
  type Activity as Outing,
  type Plan,
  type PlanOptions,
  type VulnerabilityProfile,
} from "../shared/planner";
import { formatScheduleDate } from "../shared/schedule";
import AqiBadge from "./components/AqiBadge";

interface PlannerSectionProps {
  options: PlanOptions;
  plan: Plan | null;
  bestDifferent: boolean;
  loadingForecast: boolean;
  signedIn: boolean;
  startDate: string;
  onOptionChange: <K extends keyof PlanOptions>(
    key: K,
    value: PlanOptions[K],
  ) => void;
  onSavePlan: () => void;
  onOpenCaregiverBrief?: () => void;
}

export default function PlannerSection({
  options,
  plan,
  bestDifferent,
  loadingForecast,
  signedIn,
  startDate,
  onOptionChange,
  onSavePlan,
  onOpenCaregiverBrief,
}: PlannerSectionProps) {
  return (
    <section
      className="planner-section"
      id="planner"
      aria-labelledby="planner-heading"
    >
      <div className="section-title">
        <div>
          <span className="eyebrow">BUILT AROUND YOUR LIFE</span>
          <h2 id="planner-heading">Plan your next outing</h2>
          <p>Set your real constraints. We’ll compare practical options.</p>
        </div>
        <div className="section-icon" aria-hidden="true">
          <Activity size={22} />
        </div>
      </div>

      <div className="planner-grid">
        <div className="controls-card">
          <div className="controls-title">
            <span className="step-number" aria-hidden="true">
              01
            </span>
            <h3>Tell us what matters today</h3>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="field-activity">What are you planning?</label>
              <select
                id="field-activity"
                value={options.activity}
                onChange={(event) =>
                  onOptionChange("activity", event.target.value as Outing)
                }
              >
                <option value="school">School run</option>
                <option value="walk">Family walk</option>
                <option value="errands">Errands</option>
                <option value="exercise">Outdoor exercise</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="field-preferred-hour">Preferred start time</label>
              <select
                id="field-preferred-hour"
                value={options.preferredHour}
                onChange={(event) =>
                  onOptionChange("preferredHour", Number(event.target.value))
                }
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {formatTime(
                      `2026-01-01T${String(hour).padStart(2, "0")}:00`,
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="field-duration">Time outdoors</label>
              <select
                id="field-duration"
                value={options.durationMinutes}
                onChange={(event) =>
                  onOptionChange("durationMinutes", Number(event.target.value))
                }
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1½ hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="field-flexibility">Your flexibility</label>
              <select
                id="field-flexibility"
                value={options.flexibilityHours}
                onChange={(event) =>
                  onOptionChange("flexibilityHours", Number(event.target.value))
                }
              >
                <option value={0}>Fixed time</option>
                <option value={2}>± 2 hours</option>
                <option value={4}>± 4 hours</option>
                <option value={6}>± 6 hours</option>
              </select>
            </div>

            <div className="field full">
              <label htmlFor="field-travel-mode">How will you travel?</label>
              <select
                id="field-travel-mode"
                value={options.travelMode}
                onChange={(event) =>
                  onOptionChange(
                    "travelMode",
                    event.target.value as PlanOptions["travelMode"],
                  )
                }
              >
                <option value="car">Private car</option>
                <option value="bus">Bus or shared transit</option>
                <option value="walk">Walking</option>
                <option value="cycle">Cycling</option>
              </select>
            </div>
          </div>

          <label className="toggle-row" htmlFor="field-sensitive">
            <span className="toggle-icon" aria-hidden="true">
              <ShieldCheck size={20} />
            </span>
            <span>
              <strong>Someone needs extra care</strong>
              <small>
                Tailor advice for children, seniors, or people with health
                conditions
              </small>
            </span>
            <input
              id="field-sensitive"
              type="checkbox"
              checked={options.sensitive}
              onChange={(event) =>
                onOptionChange("sensitive", event.target.checked)
              }
            />
            <span className="toggle-track" aria-hidden="true" />
          </label>

          {options.sensitive && (
            <div className="field profile-selector">
              <label htmlFor="field-vulnerability-profile">
                Specific care profile
              </label>
              <select
                id="field-vulnerability-profile"
                value={options.vulnerabilityProfile ?? "general"}
                onChange={(event) =>
                  onOptionChange(
                    "vulnerabilityProfile",
                    event.target.value as VulnerabilityProfile,
                  )
                }
              >
                {Object.entries(vulnerabilityLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="controls-foot">
            <Check size={15} aria-hidden="true" /> Changes are saved
            automatically{" "}
            {signedIn ? "and synced to your account." : "on this device."}
          </div>
        </div>

        <div className="results-card">
          <div className="controls-title">
            <span className="step-number green" aria-hidden="true">
              02
            </span>
            <h3>Your options, explained</h3>
          </div>

          {plan?.baseline && plan.best ? (
            <>
              {plan.aqiCategory && <AqiBadge aqiCategory={plan.aqiCategory} />}

              <div className="recommend-card">
                <div className="recommend-top">
                  <span>
                    <Sparkles size={15} aria-hidden="true" /> LOWER FORECAST
                    WINDOW
                  </span>
                  <span className="recommend-badge">
                    {bestDifferent ? "A practical shift" : "Your current time"}
                  </span>
                </div>
                <div className="recommend-time">
                  {formatTime(plan.best.start)}{" "}
                  <ArrowRight size={21} aria-hidden="true" />{" "}
                  {formatTime(plan.best.end)}
                </div>
                <p>
                  {bestDifferent
                    ? `Modeled outdoor PM₂.₅ is ${plan.best.averagePm25} µg/m³, compared with ${plan.baseline.averagePm25} at your preferred time.`
                    : options.flexibilityHours === 0
                      ? "Your time is fixed. We have kept it and focused on other useful choices."
                      : "This is the lowest modeled PM₂.₅ window within your flexibility."}
                </p>
                <div className="recommend-impact">
                  <Wind size={17} aria-hidden="true" />
                  <span>
                    {bestDifferent
                      ? `${plan.reductionPercent}% lower ambient PM₂.₅ during this window`
                      : `${plan.best.averagePm25} µg/m³ modeled ambient PM₂.₅`}
                  </span>
                </div>
              </div>

              <div className="option-row">
                <span className="option-icon mint" aria-hidden="true">
                  <Leaf size={19} />
                </span>
                <div>
                  <strong>Make the trip count</strong>
                  <p>{plan.emissionAction}</p>
                </div>
              </div>

              <div className="option-row">
                <span className="option-icon sand" aria-hidden="true">
                  <House size={19} />
                </span>
                <div>
                  <strong>Have an indoor alternative</strong>
                  <p>{plan.indoorAction}</p>
                </div>
              </div>

              {plan.careAction && (
                <div className="option-row">
                  <span className="option-icon mint" aria-hidden="true">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <strong>For someone needing extra care</strong>
                    <p>{plan.careAction}</p>
                  </div>
                </div>
              )}

              <div className="result-actions">
                <button
                  type="button"
                  className="save-plan-button"
                  onClick={onSavePlan}
                >
                  <Save size={16} aria-hidden="true" /> Save this plan
                </button>
                {onOpenCaregiverBrief && (
                  <button
                    type="button"
                    className="calendar-link"
                    onClick={onOpenCaregiverBrief}
                  >
                    <FileText size={16} aria-hidden="true" /> Caregiver brief
                  </button>
                )}
                <span>
                  Outdoor model comparison, not a personal exposure estimate.
                </span>
              </div>
            </>
          ) : (
            <div className="results-placeholder">
              <CloudFog size={35} aria-hidden="true" />
              <strong>
                {loadingForecast
                  ? "Checking the forecast…"
                  : "Forecast not yet available for this day"}
              </strong>
              <p>
                {loadingForecast
                  ? "Your options will appear here soon."
                  : `Use your preferred time for ${formatScheduleDate(startDate)} and recheck closer to the day.`}
              </p>
              {!loadingForecast && plan && (
                <div className="routine-guidance">
                  <div>
                    <Leaf size={17} aria-hidden="true" />
                    <span>{plan.emissionAction}</span>
                  </div>
                  <div>
                    <House size={17} aria-hidden="true" />
                    <span>{plan.indoorAction}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
