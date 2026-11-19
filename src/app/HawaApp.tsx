import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CloudFog,
  CloudOff,
  History,
  House,
  Leaf,
  LocateFixed,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
  Wind,
  X,
} from "lucide-react";
import {
  buildPlan,
  formatTime,
  type Forecast,
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
import AuthDialog, { type AuthMode } from "./AuthDialog";
import TodayPage from "./TodayPage";
import SavedPlansPage from "./SavedPlansPage";
import IndoorGuidePage from "./IndoorGuidePage";
import CommunityPage from "./CommunityPage";

type Tab = "today" | "plans" | "indoors" | "community";
type CityResult = Place & { id: number };
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
const readDraft = () => {
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
const forecastKey = (place: Place) =>
  `hawaplan-forecast-v2:${place.latitude.toFixed(2)}:${place.longitude.toFixed(2)}`;

function loadForecast(place: Place): Forecast | null {
  try {
    const saved = JSON.parse(
      localStorage.getItem(forecastKey(place)) ?? "null",
    ) as Forecast | null;
    if (
      saved?.hours?.length &&
      saved.latitude === place.latitude &&
      saved.longitude === place.longitude
    )
      return saved;
  } catch {
    /* Ignore an invalid local cache. */
  }
  return null;
}

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
  const [cityQuery, setCityQuery] = useState("");
  const [citySearch, setCitySearch] = useState<{
    query: string;
    loading: boolean;
    results: CityResult[];
  }>({ query: "", loading: false, results: [] });
  const activeCityQuery = cityQuery.trim();
  const places = citySearch.query === activeCityQuery ? citySearch.results : [];
  const searching =
    activeCityQuery.length >= 2 &&
    (citySearch.query !== activeCityQuery || citySearch.loading);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const locationKey = forecastKey(place);
  const cachedForecast = useMemo(() => loadForecast(place), [place]);
  const [forecastResult, setForecastResult] = useState<{
    locationKey: string;
    value: Forecast;
  } | null>(null);
  const [forecastRequest, setForecastRequest] = useState<{
    key: string;
    error: string;
  } | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const requestKey = [locationKey, place.name, refreshCount].join(":");
  const forecast =
    forecastResult?.locationKey === locationKey
      ? forecastResult.value
      : cachedForecast;
  const forecastError =
    forecastRequest?.key === requestKey ? forecastRequest.error : "";
  const loadingForecast = forecastRequest?.key !== requestKey;
  const [question, setQuestion] = useState(readDraft);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const autoLocationAttempted = useRef(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const citySearchInput = useRef<HTMLInputElement>(null);
  const closeAuth = useCallback(() => setAuthMode(null), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (cityOpen) citySearchInput.current?.focus();
  }, [cityOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(tabKey, tab);
    } catch {
      /* Keep this session usable. */
    }
  }, [tab]);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, question);
    } catch {
      /* Keep this session usable. */
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
    const cached = loadForecast(place);
    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(place.latitude),
      lon: String(place.longitude),
      city: place.name,
    });
    fetch(`/api/forecast?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("The live forecast could not be loaded.");
        return response.json() as Promise<Forecast>;
      })
      .then((result) => {
        setForecastResult({ locationKey, value: result });
        setForecastRequest({ key: requestKey, error: "" });
        try {
          localStorage.setItem(forecastKey(place), JSON.stringify(result));
        } catch {
          /* Live forecast is still usable. */
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setForecastRequest({
            key: requestKey,
            error: cached
              ? "Showing your last saved forecast. Check back when online."
              : error.message,
          });
      });
    return () => controller.abort();
  }, [place, locationKey, requestKey]);

  useEffect(() => {
    if (!cityOpen || activeCityQuery.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCitySearch({ query: activeCityQuery, loading: true, results: [] });
      fetch("/api/places?q=" + encodeURIComponent(activeCityQuery), {
        signal: controller.signal,
      })
        .then(
          (response) => response.json() as Promise<{ results?: CityResult[] }>,
        )
        .then((result) => {
          if (!controller.signal.aborted)
            setCitySearch({
              query: activeCityQuery,
              loading: false,
              results: result.results ?? [],
            });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setCitySearch({
              query: activeCityQuery,
              loading: false,
              results: [],
            });
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cityOpen, activeCityQuery]);

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
  const useDeviceLocation = () => {
    setLocationError("");
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      setLocationError("This browser does not support device location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Math.round(position.coords.latitude * 100) / 100;
        const longitude = Math.round(position.coords.longitude * 100) / 100;
        choosePlace({
          id: 0,
          name: "Current area",
          latitude,
          longitude,
          source: "device",
        });
        setLocating(false);
        setToast(
          "Your current area is ready. Coordinates are rounded before saving.",
        );
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === 1
            ? "Location permission was not granted. You can choose a city instead."
            : "Could not detect your location. Try searching for your city.",
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
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
              ? `${plan.best.averagePm25} µg/m³ modeled ambient PM₂.₅`
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
      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Wind size={27} strokeWidth={2.5} />
          </div>
          <div>
            <strong>
              hawa<span>plan</span>
            </strong>
            <small>Find your clearer path.</small>
          </div>
        </div>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${tab === "today" ? "active" : ""}`}
            aria-current={tab === "today" ? "page" : undefined}
            onClick={() => navigate("today")}
          >
            <CloudFog size={19} /> Today’s plan{" "}
            <ArrowRight className="nav-arrow" size={16} />
          </button>
          <button
            className={`nav-item ${tab === "plans" ? "active" : ""}`}
            aria-current={tab === "plans" ? "page" : undefined}
            onClick={() => navigate("plans")}
          >
            <History size={19} /> Saved plans{" "}
            <span className="nav-count">{data.plans.length}</span>
          </button>
          <button
            className={`nav-item ${tab === "indoors" ? "active" : ""}`}
            aria-current={tab === "indoors" ? "page" : undefined}
            onClick={() => navigate("indoors")}
          >
            <House size={19} /> Indoor air guide{" "}
            <ArrowRight className="nav-arrow" size={16} />
          </button>
          <button
            className={`nav-item ${tab === "community" ? "active" : ""}`}
            aria-current={tab === "community" ? "page" : undefined}
            onClick={() => navigate("community")}
          >
            <UsersRound size={19} /> Community note{" "}
            <ArrowRight className="nav-arrow" size={16} />
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon">
              <Leaf size={20} />
            </div>
            <strong>Your day, remembered.</strong>
            <p>
              {account
                ? "Plans and chats sync to your account."
                : "Plans and chats stay on this device until you sign in."}
            </p>
          </div>
          <div className="sidebar-foot">
            {account ? `@${account.username}` : "Guest mode"} <span>✳</span>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label={mobileNav ? "Close menu" : "Open menu"}
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(!mobileNav)}
          >
            {mobileNav ? <X /> : <Menu />}
          </button>
          <div className="topbar-context">
            <span className="live-dot" /> PLAN YOUR AIR
          </div>
          <div className="topbar-actions">
            <span
              className={`sync-pill ${syncStatus}`}
              title={account ? "Account sync status" : "Saved in this browser"}
            >
              {syncStatus === "saving" ? (
                <RefreshCw size={14} className="spin" />
              ) : syncStatus === "offline" ? (
                <CloudOff size={14} />
              ) : (
                <Check size={14} />
              )}
              {syncStatus === "saving"
                ? "Saving"
                : syncStatus === "saved"
                  ? "Synced"
                  : syncStatus === "offline"
                    ? "On this device"
                    : "On this device"}
            </span>
            <div className="city-picker">
              <button
                className="city-button"
                onClick={() => {
                  setCityOpen(!cityOpen);
                  setAccountOpen(false);
                  setCityQuery("");
                }}
                aria-expanded={cityOpen}
              >
                <MapPin size={17} />
                <span>
                  {place.name}
                  {place.country ? `, ${place.country}` : ""}
                </span>
                <ChevronDown size={15} />
              </button>
              {cityOpen && (
                <div className="city-popover">
                  <button
                    className="locate-option"
                    onClick={useDeviceLocation}
                    disabled={locating}
                  >
                    <LocateFixed size={17} />
                    <span>
                      <strong>
                        {locating
                          ? "Finding your area…"
                          : "Use my current area"}
                      </strong>
                      <small>
                        Asks for browser permission · saves rounded coordinates
                      </small>
                    </span>
                  </button>
                  <div className="city-search">
                    <Search size={17} />
                    <input
                      ref={citySearchInput}
                      aria-label="Search for a city"
                      placeholder="Search for a city"
                      value={cityQuery}
                      onChange={(event) => setCityQuery(event.target.value)}
                    />
                  </div>
                  <div className="city-results">
                    {searching ? (
                      <p>Searching…</p>
                    ) : cityQuery.length < 2 ? (
                      <p>Or enter a city name above.</p>
                    ) : places.length ? (
                      places.map((result) => (
                        <button
                          key={`${result.id}-${result.country}`}
                          onClick={() => choosePlace(result)}
                        >
                          <MapPin size={15} />
                          <span>
                            {result.name}
                            <small>
                              {[result.admin1, result.country]
                                .filter(Boolean)
                                .join(", ")}
                            </small>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p>No cities found.</p>
                    )}
                  </div>
                  {locationError && (
                    <p className="location-error">{locationError}</p>
                  )}
                </div>
              )}
            </div>
            <div className="account-picker">
              <button
                className="account-button"
                aria-label={
                  account
                    ? `Account: ${account.username}`
                    : "Sign in or create account"
                }
                onClick={() => {
                  setAccountOpen(!accountOpen);
                  setCityOpen(false);
                }}
                aria-expanded={accountOpen}
              >
                <UserRound size={16} />
                <span>{account ? account.username : "Sign in"}</span>
                <ChevronDown size={14} />
              </button>
              {accountOpen && (
                <div className="account-popover">
                  {account ? (
                    <>
                      <div className="account-pop-head">
                        <strong>@{account.username}</strong>
                        <small>
                          {syncStatus === "saved"
                            ? "Your data is synced"
                            : "Your data is on this device"}
                        </small>
                      </div>
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          signOut().catch(() =>
                            setToast("Could not sign out. Try again."),
                          );
                        }}
                      >
                        Sign out
                      </button>
                      <button
                        className="danger-text"
                        onClick={() => {
                          setAccountOpen(false);
                          setAuthMode("delete");
                        }}
                      >
                        Delete account & data
                      </button>
                    </>
                  ) : (
                    <>
                      <p>Keep your plans and chats across devices.</p>
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          setAuthMode("login");
                        }}
                      >
                        Sign in
                      </button>
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          setAuthMode("signup");
                        }}
                      >
                        Create account
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
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
            onUseDeviceLocation={useDeviceLocation}
            onUpdateSchedule={updateSchedule}
            onUpdateWeekdaysOnly={updateWeekdaysOnly}
            onSavePlan={saveCurrentPlan}
            onRefresh={() => setRefreshCount((value) => value + 1)}
            onOptionChange={updateOption}
            onClearChat={clearChat}
            onQuestionChange={setQuestion}
            onAsk={ask}
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
        <div className="toast" role="status">
          <Check size={16} /> {toast}
        </div>
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
