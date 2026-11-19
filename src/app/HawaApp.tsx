/**
 * @file HawaApp.tsx
 * Primary application container coordinating state, layout, navigation, and modal dialogues.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  buildPlan,
  formatTime,
  type PlanOptions,
  type Activity as Outing,
} from "../shared/planner";
import {
  formatScheduleDate,
  googleCalendarUrl,
  scheduleDates,
  type SpanDays,
} from "../shared/schedule";
import type { Place, SavedPlan } from "../shared/saved";
import { useAppState } from "./useAppState";
import { useForecast } from "./hooks/useForecast";
import { useCitySearch } from "./hooks/useCitySearch";
import { useGeolocation } from "./hooks/useGeolocation";
import AppSidebar, { type Tab } from "./components/AppSidebar";
import AppHeader from "./components/AppHeader";
import CityPickerPopover from "./components/CityPickerPopover";
import AccountPopover from "./components/AccountPopover";
import CaregiverModal from "./components/CaregiverModal";
import AuthDialog, { type AuthMode } from "./AuthDialog";
import TodayPage from "./TodayPage";
import SavedPlansPage from "./SavedPlansPage";
import IndoorGuidePage from "./IndoorGuidePage";
import CommunityPage from "./CommunityPage";

const tabKey = "hawaplan-tab-v2";
const draftKey = "hawaplan-chat-draft-v2";

const readTab = (): Tab => {
  try {
    const value = localStorage.getItem(tabKey);
    return value === "plans" || value === "indoors" || value === "community"
      ? value
      : "today";
  } catch {
    return "today";
  }
};

const readDraft = (): string => {
  try {
    return localStorage.getItem(draftKey)?.slice(0, 500) ?? "";
  } catch {
    return "";
  }
};

const activityNames: Record<Outing, string> = {
  school: "School run",
  walk: "Family walk",
  errands: "Errands",
  exercise: "Outdoor exercise",
};

export default function HawaApp() {
  const {
    data,
    account,
    authReady,
    syncStatus,
    updatePreferences,
    updateSchedule,
    updateWeekdaysOnly,
    addMessage,
    clearChat,
    savePlan,
    removePlan,
    authenticate,
    signOut,
    deleteAccount,
  } = useAppState();

  const { place, options } = data;
  const [tab, setTab] = useState<Tab>(readTab);
  const [mobileNav, setMobileNav] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [caregiverModalOpen, setCaregiverModalOpen] = useState(false);

  const [refreshCount, setRefreshCount] = useState(0);
  const { forecast, loadingForecast, forecastError } = useForecast(
    place,
    refreshCount,
  );

  const { cityQuery, setCityQuery, places, searching, resetSearch } =
    useCitySearch(cityOpen);

  const [toast, setToast] = useState("");
  const { locating, locationError, setLocationError, requestLocation } =
    useGeolocation(
      (newPlace) => {
        updatePreferences(newPlace, options);
        setCityOpen(false);
      },
      (msg) => setToast(msg),
    );

  const [question, setQuestion] = useState(readDraft);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const autoLocationAttempted = useRef(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const closeAuth = useCallback(() => setAuthMode(null), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(tabKey, tab);
    } catch {
      /* Session usable fallback */
    }
  }, [tab]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, question);
    } catch {
      /* Session usable fallback */
    }
  }, [question]);

  useEffect(() => {
    if (
      !authReady ||
      autoLocationAttempted.current ||
      data.preferencesUpdatedAt !== 0
    )
      return;
    autoLocationAttempted.current = true;
    let cancelled = false;
    fetch("/api/location", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ place: Place | null }>)
      .then((result) => {
        if (!cancelled && result.place)
          updatePreferences(result.place, options);
      })
      .catch(() => {
        /* Default city remains available. */
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, data.preferencesUpdatedAt, options, updatePreferences]);

  useEffect(() => {
    if (data.messages.length && chatEnd.current?.parentElement)
      chatEnd.current.parentElement.scrollTop =
        chatEnd.current.parentElement.scrollHeight;
  }, [data.messages.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const today =
    forecast?.currentTime.slice(0, 10) ??
    new Date(now).toISOString().slice(0, 10);
  const parsedStart = data.startDate
    ? Date.parse(`${data.startDate}T00:00:00Z`)
    : NaN;
  const startDate =
    data.startDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.startDate) &&
    Number.isFinite(parsedStart) &&
    new Date(parsedStart).toISOString().slice(0, 10) === data.startDate &&
    data.startDate >= today
      ? data.startDate
      : today;
  const spanDays: SpanDays =
    data.spanDays === 7 || data.spanDays === 30 ? data.spanDays : 1;
  const weekdaysOnly = data.weekdaysOnly ?? options.activity === "school";

  const plan = useMemo(
    () => (forecast ? buildPlan(forecast, options, startDate) : null),
    [forecast, options, startDate],
  );

  const schedule = useMemo(
    () =>
      scheduleDates(startDate, spanDays, weekdaysOnly).map((date) => ({
        date,
        dayPlan: forecast ? buildPlan(forecast, options, date) : null,
      })),
    [startDate, spanDays, weekdaysOnly, forecast, options],
  );

  const bestDifferent = Boolean(
    plan?.best && plan?.baseline && plan.best.start !== plan.baseline.start,
  );

  const calendarUrl = googleCalendarUrl({
    startDate,
    spanDays,
    options,
    place,
    timezone: forecast?.timezone,
    chosenStart: plan?.best?.start,
    emissionAction: plan?.emissionAction,
    indoorAction: plan?.indoorAction,
    weekdaysOnly,
  });

  const shareText = `HawaPlan for ${place.name}: ${activityNames[options.activity]} ${plan?.best ? `at ${formatTime(plan.best.start)}` : "when practical"}. ${plan?.best && plan?.baseline && bestDifferent ? `Modeled outdoor PM2.5 is ${plan.best.averagePm25} vs ${plan.baseline.averagePm25} µg/m³ at the original time.` : ""} ${plan?.emissionAction ?? "Combine necessary trips where possible."} This is a broad-area forecast, not a personal exposure reading. ${window.location.origin}`;

  const updateOption = <K extends keyof PlanOptions>(
    key: K,
    value: PlanOptions[K],
  ) => updatePreferences(place, { ...options, [key]: value });

  const choosePlace = (next: Place) => {
    updatePreferences({ ...next, source: next.source ?? "city" }, options);
    setCityOpen(false);
    setLocationError("");
    setTab("today");
  };

  const ask = async () => {
    const text = question.trim();
    if (!forecast || !text || asking) return;
    setQuestion("");
    setAskError("");
    setAsking(true);
    addMessage("user", text, place.name);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          latitude: place.latitude,
          longitude: place.longitude,
          city: place.name,
          options,
          history: data.messages.slice(-6).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const result = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      if (!response.ok || !result.answer)
        throw new Error(result.error ?? "The assistant is unavailable.");
      addMessage("assistant", result.answer, place.name);
    } catch (error) {
      setQuestion(text);
      setAskError(
        error instanceof Error
          ? error.message
          : "The assistant is unavailable.",
      );
    } finally {
      setAsking(false);
    }
  };

  const saveCurrentPlan = () => {
    const saved: SavedPlan = {
      id: crypto.randomUUID(),
      at: Date.now(),
      city: place.name,
      activity: activityNames[options.activity],
      time:
        spanDays > 1
          ? `${formatTime(`${startDate}T${String(options.preferredHour).padStart(2, "0")}:00`)} ${weekdaysOnly ? "weekdays" : "daily"}`
          : plan?.best
            ? formatTime(plan.best.start)
            : formatTime(
                `${startDate}T${String(options.preferredHour).padStart(2, "0")}:00`,
              ),
      summary:
        spanDays > 1
          ? `${spanDays}-day ${weekdaysOnly ? "weekday " : ""}routine from ${formatScheduleDate(startDate)}. Recheck air conditions before each outing.`
          : bestDifferent && plan
            ? `${plan.reductionPercent}% lower modeled ambient PM₂.₅ than your preferred time`
            : plan?.best
              ? `${plan.best.averagePm25} µg/m³ modeled ambient PM₂.₅ (${plan.aqiCategory?.label ?? "Forecasted"})`
              : "Preferred-time routine. Forecast not yet available; recheck before going.",
      place,
      options,
      startDate,
      spanDays,
      timezone: forecast?.timezone,
      chosenStart: spanDays === 1 ? plan?.best?.start : undefined,
      weekdaysOnly,
    };
    savePlan(saved);
    setToast("Plan saved to your collection.");
  };

  const restorePlan = (saved: SavedPlan) => {
    updatePreferences(saved.place, saved.options);
    updateSchedule(saved.startDate ?? "", saved.spanDays ?? 1);
    updateWeekdaysOnly(
      saved.weekdaysOnly ?? saved.options.activity === "school",
    );
    setTab("today");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setToast("Plan restored. We’re refreshing its forecast.");
  };

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setToast("Community note copied.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setToast("Copying failed. Please select the note and copy it.");
    }
  };

  const navigate = (next: Tab) => {
    setTab(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell v2">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
          type="button"
        />
      )}

      <AppSidebar
        tab={tab}
        planCount={data.plans.length}
        account={account}
        mobileNav={mobileNav}
        onNavigate={navigate}
      />

      <main id="main-content" className="main-area" tabIndex={-1}>
        <AppHeader
          place={place}
          account={account}
          syncStatus={syncStatus}
          mobileNav={mobileNav}
          cityOpen={cityOpen}
          accountOpen={accountOpen}
          onToggleMobileNav={() => setMobileNav(!mobileNav)}
          onToggleCity={() => {
            setCityOpen(!cityOpen);
            setAccountOpen(false);
            resetSearch();
          }}
          onToggleAccount={() => {
            setAccountOpen(!accountOpen);
            setCityOpen(false);
          }}
          childrenCityPopover={
            <CityPickerPopover
              cityQuery={cityQuery}
              searching={searching}
              places={places}
              locating={locating}
              locationError={locationError}
              onQueryChange={setCityQuery}
              onSelectPlace={choosePlace}
              onUseDeviceLocation={requestLocation}
              onClose={() => setCityOpen(false)}
            />
          }
          childrenAccountPopover={
            <AccountPopover
              account={account}
              syncStatus={syncStatus}
              onSignOut={() => {
                setAccountOpen(false);
                signOut().catch(() =>
                  setToast("Could not sign out. Try again."),
                );
              }}
              onOpenAuth={(mode) => setAuthMode(mode)}
              onClose={() => setAccountOpen(false)}
            />
          }
        />

        {tab === "today" && (
          <TodayPage
            place={place}
            data={data}
            signedIn={Boolean(account)}
            options={options}
            today={today}
            startDate={startDate}
            spanDays={spanDays}
            weekdaysOnly={weekdaysOnly}
            forecast={forecast}
            plan={plan}
            schedule={schedule}
            loadingForecast={loadingForecast}
            forecastError={forecastError}
            now={now}
            calendarUrl={calendarUrl}
            locating={locating}
            locationError={locationError}
            question={question}
            asking={asking}
            askError={askError}
            chatEnd={chatEnd}
            onUseDeviceLocation={requestLocation}
            onUpdateSchedule={updateSchedule}
            onUpdateWeekdaysOnly={updateWeekdaysOnly}
            onSavePlan={saveCurrentPlan}
            onRefresh={() => setRefreshCount((value) => value + 1)}
            onOptionChange={updateOption}
            onClearChat={clearChat}
            onQuestionChange={setQuestion}
            onAsk={ask}
            onOpenCaregiverBrief={() => setCaregiverModalOpen(true)}
          />
        )}

        {tab === "plans" && (
          <SavedPlansPage
            plans={data.plans}
            onRemovePlan={removePlan}
            onRestorePlan={restorePlan}
            onNavigateToday={() => navigate("today")}
          />
        )}

        {tab === "indoors" && <IndoorGuidePage />}

        {tab === "community" && (
          <CommunityPage
            shareText={shareText}
            copied={copied}
            onCopyPlan={copyPlan}
          />
        )}

        <footer className="footer">
          <span>© 2026 HawaPlan</span>
          <div>
            <a
              href="https://open-meteo.com/en/docs/air-quality-api"
              target="_blank"
              rel="noreferrer"
            >
              Forecast source
            </a>
            <a
              href="https://www.who.int/news-room/questions-and-answers/item/air-pollution-personal-interventions-and-risk-communication"
              target="_blank"
              rel="noreferrer"
            >
              Health guidance
            </a>
          </div>
          <span>Plan with care. Breathe with context.</span>
        </footer>
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <Check size={16} aria-hidden="true" /> {toast}
        </div>
      )}

      {caregiverModalOpen && plan && (
        <CaregiverModal
          place={place}
          activity={activityNames[options.activity]}
          date={startDate}
          timeWindow={
            plan.best
              ? `${formatTime(plan.best.start)} – ${formatTime(plan.best.end)}`
              : `${formatTime(`${startDate}T${String(options.preferredHour).padStart(2, "0")}:00`)}`
          }
          summary={
            plan.best
              ? `${plan.best.averagePm25} µg/m³ modeled PM₂.₅ (${plan.aqiCategory?.label ?? "Forecasted"})`
              : "Preferred routine time"
          }
          careAction={plan.careAction}
          emissionAction={plan.emissionAction}
          indoorAction={plan.indoorAction}
          onClose={() => setCaregiverModalOpen(false)}
        />
      )}

      {authMode && (
        <AuthDialog
          mode={authMode}
          username={account?.username}
          onClose={closeAuth}
          onAuthenticate={authenticate}
          onDelete={deleteAccount}
        />
      )}
    </div>
  );
}
