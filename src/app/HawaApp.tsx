import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CloudFog,
  CloudOff,
  Copy,
  History,
  House,
  Info,
  Leaf,
  LocateFixed,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
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
import AirChart from "./AirChart";

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

function formatSavedDate(value: number) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const [places, setPlaces] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [forecast, setForecast] = useState<Forecast | null>(() =>
    loadForecast(place),
  );
  const [forecastError, setForecastError] = useState("");
  const [loadingForecast, setLoadingForecast] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const [question, setQuestion] = useState(readDraft);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const autoLocationAttempted = useRef(false);
  const chatEnd = useRef<HTMLDivElement>(null);

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
    setForecast(cached);
    setForecastError("");
    setLoadingForecast(true);
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
        setForecast(result);
        try {
          localStorage.setItem(forecastKey(place), JSON.stringify(result));
        } catch {
          /* Live forecast is still usable. */
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setForecastError(
            cached
              ? "Showing your last saved forecast. Check back when online."
              : error.message,
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingForecast(false);
      });
    return () => controller.abort();
  }, [place.latitude, place.longitude, place.name, refreshCount]);

  useEffect(() => {
    if (!cityOpen || cityQuery.trim().length < 2) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      fetch(`/api/places?q=${encodeURIComponent(cityQuery.trim())}`, {
        signal: controller.signal,
      })
        .then(
          (response) => response.json() as Promise<{ results?: CityResult[] }>,
        )
        .then((result) => setPlaces(result.results ?? []))
        .catch(() => setPlaces([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cityOpen, cityQuery]);

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
    forecast?.currentTime.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
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
  const forecastIsOld = Boolean(
    forecast && Date.now() - Date.parse(forecast.updatedAt) > 20 * 60_000,
  );
  const current = forecast?.currentPm25;
  const forecastDate = formatScheduleDate(startDate);
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
            onClick={() => navigate("today")}
          >
            <CloudFog size={19} /> Today’s plan{" "}
            <ArrowRight className="nav-arrow" size={16} />
          </button>
          <button
            className={`nav-item ${tab === "plans" ? "active" : ""}`}
            onClick={() => navigate("plans")}
          >
            <History size={19} /> Saved plans{" "}
            <span className="nav-count">{data.plans.length}</span>
          </button>
          <button
            className={`nav-item ${tab === "indoors" ? "active" : ""}`}
            onClick={() => navigate("indoors")}
          >
            <House size={19} /> Indoor air guide{" "}
            <ArrowRight className="nav-arrow" size={16} />
          </button>
          <button
            className={`nav-item ${tab === "community" ? "active" : ""}`}
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
            aria-label="Open menu"
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
                      autoFocus
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
                  A thoughtful plan for the places you need to go and the people
                  you care for.
                </p>
              </div>
              <div className="date-badge">{forecastDate}</div>
            </div>
            {(place.source === "network" ||
              data.preferencesUpdatedAt === 0) && (
              <div className="location-nudge">
                <span className="nudge-icon">
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
                <button onClick={useDeviceLocation} disabled={locating}>
                  {locating ? "Locating…" : "Use my location"}{" "}
                  <ArrowRight size={15} />
                </button>
                {locationError && (
                  <span className="nudge-error">{locationError}</span>
                )}
              </div>
            )}
            <section className="schedule-bar" aria-label="Choose when to plan">
              <div className="schedule-bar-title">
                <span className="schedule-icon">
                  <CalendarDays size={21} />
                </span>
                <div>
                  <strong>When are you planning?</strong>
                  <small>
                    Pick a day, then plan one outing or a repeatable routine.
                  </small>
                </div>
              </div>
              <label>
                Start date
                <input
                  aria-label="Plan start date"
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={(event) =>
                    updateSchedule(event.target.value || today, spanDays)
                  }
                />
              </label>
              <label>
                Plan length
                <select
                  aria-label="Plan length"
                  value={spanDays}
                  onChange={(event) =>
                    updateSchedule(
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
              <button className="save-plan-button" onClick={saveCurrentPlan}>
                <Save size={16} /> Save plan
              </button>
              <a
                className="calendar-link"
                href={calendarUrl}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarDays size={16} /> Review in Google Calendar{" "}
                <ArrowUpRight size={15} />
              </a>
            </section>
            {spanDays > 1 && (
              <div className="schedule-caveat">
                <label className="weekday-toggle">
                  <input
                    type="checkbox"
                    checked={weekdaysOnly}
                    onChange={(event) =>
                      updateWeekdaysOnly(event.target.checked)
                    }
                  />{" "}
                  Weekdays only
                </label>
                <p>
                  Calendar repeats your preferred time on the selected days.
                  Air-based timing appears only where a forecast is available;
                  recheck before each outing.
                </p>
              </div>
            )}
            <section className="hero-grid">
              <div className="hero-card">
                <div className="hero-copy">
                  <span className="hero-kicker">
                    <span className="mini-star">✳</span> A LITTLE PLANNING HELPS
                  </span>
                  <h2>
                    {loadingForecast && !forecast
                      ? "Finding your air outlook…"
                      : "A calmer day starts with one good choice."}
                  </h2>
                  <p>
                    See the next hours, shape an outing around your real
                    schedule, and know what each choice changes.
                  </p>
                  <button
                    className="hero-link"
                    onClick={() =>
                      document
                        .getElementById("planner")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Build today’s plan <ArrowUpRight size={18} />
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
                  <CloudFog size={21} />
                </div>
                <div className="now-number">
                  {current == null ? "—" : Math.round(current)}
                  <span>µg/m³</span>
                </div>
                <div className="now-sub">PM₂.₅ around {place.name}</div>
                <div className="now-divider" />
                <div className="now-bottom">
                  <span
                    className={`status-dot ${forecastIsOld ? "high" : ""}`}
                  />
                  <strong>
                    {forecastIsOld ? "Saved forecast" : "Latest forecast"}
                  </strong>
                  <span className="now-timestamp">
                    {forecast?.currentTime
                      ? formatTime(forecast.currentTime)
                      : "—"}
                  </span>
                </div>
                <p>
                  Outdoor model estimate. Your exact route or indoor air can
                  differ.
                </p>
              </div>
            </section>
            {forecastError && (
              <div className="inline-error">
                <Info size={18} /> {forecastError}
                <button onClick={() => setRefreshCount((value) => value + 1)}>
                  <RefreshCw size={15} /> Retry
                </button>
              </div>
            )}
            {forecast && (
              <div className="chart-card">
                <AirChart
                  forecast={forecast}
                  selectedTime={plan?.best?.start}
                />
                <button
                  className="chart-refresh"
                  onClick={() => setRefreshCount((value) => value + 1)}
                  disabled={loadingForecast}
                >
                  <RefreshCw
                    size={14}
                    className={loadingForecast ? "spin" : ""}
                  />{" "}
                  Refresh forecast
                </button>
              </div>
            )}
            <section className="planner-section" id="planner">
              <div className="section-title">
                <div>
                  <span className="eyebrow">BUILT AROUND YOUR LIFE</span>
                  <h2>Plan your next outing</h2>
                  <p>
                    Set your real constraints. We’ll compare practical options.
                  </p>
                </div>
                <div className="section-icon">
                  <Activity size={22} />
                </div>
              </div>
              <div className="planner-grid">
                <div className="controls-card">
                  <div className="controls-title">
                    <span className="step-number">01</span>
                    <h3>Tell us what matters today</h3>
                  </div>
                  <div className="field-grid">
                    <label className="field">
                      <span>What are you planning?</span>
                      <select
                        value={options.activity}
                        onChange={(event) =>
                          updateOption("activity", event.target.value as Outing)
                        }
                      >
                        <option value="school">School run</option>
                        <option value="walk">Family walk</option>
                        <option value="errands">Errands</option>
                        <option value="exercise">Outdoor exercise</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Preferred start time</span>
                      <select
                        value={options.preferredHour}
                        onChange={(event) =>
                          updateOption(
                            "preferredHour",
                            Number(event.target.value),
                          )
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
                    </label>
                    <label className="field">
                      <span>Time outdoors</span>
                      <select
                        value={options.durationMinutes}
                        onChange={(event) =>
                          updateOption(
                            "durationMinutes",
                            Number(event.target.value),
                          )
                        }
                      >
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1½ hours</option>
                        <option value={120}>2 hours</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Your flexibility</span>
                      <select
                        value={options.flexibilityHours}
                        onChange={(event) =>
                          updateOption(
                            "flexibilityHours",
                            Number(event.target.value),
                          )
                        }
                      >
                        <option value={0}>Fixed time</option>
                        <option value={2}>± 2 hours</option>
                        <option value={4}>± 4 hours</option>
                        <option value={6}>± 6 hours</option>
                      </select>
                    </label>
                    <label className="field full">
                      <span>How will you travel?</span>
                      <select
                        value={options.travelMode}
                        onChange={(event) =>
                          updateOption(
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
                    </label>
                  </div>
                  <label className="toggle-row">
                    <span className="toggle-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <span>
                      <strong>Someone needs extra care</strong>
                      <small>
                        For example, a child, older adult, or someone with a
                        health condition
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      checked={options.sensitive}
                      onChange={(event) =>
                        updateOption("sensitive", event.target.checked)
                      }
                    />
                    <span className="toggle-track" />
                  </label>
                  <div className="controls-foot">
                    <Check size={15} /> Changes are saved automatically{" "}
                    {account
                      ? "and synced to your account."
                      : "on this device."}
                  </div>
                </div>
                <div className="results-card">
                  <div className="controls-title">
                    <span className="step-number green">02</span>
                    <h3>Your options, explained</h3>
                  </div>
                  {plan?.baseline && plan.best ? (
                    <>
                      <div className="recommend-card">
                        <div className="recommend-top">
                          <span>
                            <Sparkles size={15} /> LOWER FORECAST WINDOW
                          </span>
                          <span className="recommend-badge">
                            {bestDifferent
                              ? "A practical shift"
                              : "Your current time"}
                          </span>
                        </div>
                        <div className="recommend-time">
                          {formatTime(plan.best.start)} <ArrowRight size={21} />{" "}
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
                          <Wind size={17} />
                          <span>
                            {bestDifferent
                              ? `${plan.reductionPercent}% lower ambient PM₂.₅ during this window`
                              : `${plan.best.averagePm25} µg/m³ modeled ambient PM₂.₅`}
                          </span>
                        </div>
                      </div>
                      <div className="option-row">
                        <span className="option-icon mint">
                          <Leaf size={19} />
                        </span>
                        <div>
                          <strong>Make the trip count</strong>
                          <p>{plan.emissionAction}</p>
                        </div>
                      </div>
                      <div className="option-row">
                        <span className="option-icon sand">
                          <House size={19} />
                        </span>
                        <div>
                          <strong>Have an indoor alternative</strong>
                          <p>{plan.indoorAction}</p>
                        </div>
                      </div>
                      {plan.careAction && (
                        <div className="option-row">
                          <span className="option-icon mint">
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
                          className="save-plan-button"
                          onClick={saveCurrentPlan}
                        >
                          <Save size={16} /> Save this plan
                        </button>
                        <span>
                          Outdoor model comparison, not a personal exposure
                          estimate.
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="results-placeholder">
                      <CloudFog size={35} />
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
                            <Leaf size={17} />
                            <span>{plan.emissionAction}</span>
                          </div>
                          <div>
                            <House size={17} />
                            <span>{plan.indoorAction}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
            {spanDays > 1 && (
              <section className="schedule-overview">
                <div className="schedule-overview-head">
                  <div>
                    <span className="eyebrow">YOUR UPCOMING ROUTINE</span>
                    <h2>{spanDays}-day plan</h2>
                    <p>
                      Each scheduled day uses the same preferred time in Google
                      Calendar. Forecast windows below are a planning guide and
                      can change.
                    </p>
                  </div>
                  <span className="schedule-count">
                    {schedule.filter((day) => day.dayPlan?.best).length}{" "}
                    forecast days
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
                    className="save-plan-button"
                    onClick={saveCurrentPlan}
                  >
                    <Save size={16} /> Save this routine
                  </button>
                  <a
                    className="calendar-link"
                    href={calendarUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <CalendarDays size={16} /> Review in Google Calendar{" "}
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              </section>
            )}
            <section className="conversation-section">
              <div className="conversation-head">
                <div className="assistant-avatar">
                  <Sparkles size={21} />
                </div>
                <div>
                  <span className="eyebrow">YOUR AIR ASSISTANT</span>
                  <h2>Ask HawaPlan</h2>
                  <p>
                    Your conversation is{" "}
                    {account
                      ? "synced to your account"
                      : "saved on this device"}
                    .
                  </p>
                </div>
                {data.messages.length > 0 && (
                  <button
                    className="text-action"
                    onClick={() => {
                      if (window.confirm("Clear this conversation history?"))
                        clearChat();
                    }}
                  >
                    <Trash2 size={15} /> Clear chat
                  </button>
                )}
              </div>
              <div className="chat-window">
                {data.messages.length === 0 ? (
                  <div className="chat-welcome">
                    <div className="chat-welcome-icon">
                      <MessageCircle size={25} />
                    </div>
                    <strong>What does your day look like?</strong>
                    <p>
                      Ask about a fixed school pickup, an indoor alternative, or
                      a lower-emission trip.
                    </p>
                  </div>
                ) : (
                  data.messages.map((message) => (
                    <div
                      className={`chat-bubble ${message.role}`}
                      key={message.id}
                    >
                      <div className="chat-bubble-avatar">
                        {message.role === "assistant" ? (
                          <Sparkles size={16} />
                        ) : (
                          <UserRound size={16} />
                        )}
                      </div>
                      <div>
                        <span className="chat-author">
                          {message.role === "assistant" ? "HawaPlan" : "You"} ·{" "}
                          {message.city}
                        </span>
                        <p>{message.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {asking && (
                  <div className="chat-thinking">
                    <Sparkles size={17} className="spin" /> Thinking with your
                    plan…
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              <div className="conversation-compose">
                <div className="prompt-suggestions">
                  {[
                    "What if pickup cannot move?",
                    "What can we do indoors?",
                    "How do we make fewer car trips?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setQuestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <div className="ask-box">
                  <MessageCircle size={20} />
                  <input
                    aria-label="Ask HawaPlan"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") ask();
                    }}
                    placeholder="Ask about your family’s day…"
                    maxLength={500}
                  />
                  <button
                    onClick={ask}
                    disabled={!forecast || !question.trim() || asking}
                    aria-label="Send message"
                  >
                    {asking ? (
                      <RefreshCw size={18} className="spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
                {askError && (
                  <p className="ask-error">
                    {askError} Your question is saved; you can try again.
                  </p>
                )}
                <p className="ai-note">
                  Answers use a broad-area model forecast. For personal medical
                  advice, consult a clinician.
                </p>
              </div>
            </section>
          </div>
        )}
        {tab === "plans" && (
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
            {data.plans.length ? (
              <div className="saved-grid">
                {data.plans.map((saved) => (
                  <article className="saved-card" key={saved.id}>
                    <div className="saved-top">
                      <span>
                        <Save size={15} /> {saved.activity}
                      </span>
                      <button
                        onClick={() => removePlan(saved.id)}
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
                      <button onClick={() => restorePlan(saved)}>
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
                <button onClick={() => navigate("today")}>
                  Plan an outing <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
        {tab === "indoors" && (
          <div className="page-content secondary-page">
            <div className="breadcrumb">
              PRACTICAL GUIDE <span>/</span> AT HOME
            </div>
            <h1>
              Make home a <em>cleaner space.</em>
            </h1>
            <p className="page-intro">
              Outdoor pollution can enter buildings, while cooking and other
              indoor sources can add to it. Start with what fits your home and
              budget.
            </p>
            <div className="guide-grid">
              <article className="guide-card">
                <span className="guide-num">01</span>
                <div className="guide-icon">
                  <House size={25} />
                </div>
                <h2>Cut smoke at the source</h2>
                <p>
                  Avoid indoor smoking and burning incense or candles when
                  possible. These add particles indoors, even when windows are
                  closed.
                </p>
                <span className="guide-tag">LOW COST</span>
              </article>
              <article className="guide-card">
                <span className="guide-num">02</span>
                <div className="guide-icon">
                  <Wind size={25} />
                </div>
                <h2>Manage cooking air</h2>
                <p>
                  Use a kitchen exhaust that vents outdoors if available.
                  Cleaner cooking fuels and technologies reduce pollution at the
                  source.
                </p>
                <span className="guide-tag">EVERYDAY HABIT</span>
              </article>
              <article className="guide-card">
                <span className="guide-num">03</span>
                <div className="guide-icon">
                  <ShieldCheck size={25} />
                </div>
                <h2>Know what a filter does</h2>
                <p>
                  A correctly sized portable air cleaner may help some
                  households. Check its filter and room rating; it does not
                  remove every pollutant.
                </p>
                <span className="guide-tag">IF AVAILABLE</span>
              </article>
            </div>
            <div className="guide-callout">
              <Info size={21} />
              <div>
                <strong>There is no one perfect window rule.</strong>
                <p>
                  Ventilation choices depend on outdoor conditions and indoor
                  sources. HawaPlan cannot know indoor air quality without an
                  indoor sensor.
                </p>
              </div>
            </div>
            <div className="source-list">
              <h3>Evidence behind this guide</h3>
              <a
                href="https://www.who.int/news-room/questions-and-answers/item/air-pollution-personal-interventions-and-risk-communication"
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen size={17} /> WHO: Personal interventions and risk
                communication <ArrowUpRight size={16} />
              </a>
              <a
                href="https://www.who.int/news-room/fact-sheets/detail/household-air-pollution-and-health"
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen size={17} /> WHO: Household air pollution{" "}
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        )}
        {tab === "community" && (
          <div className="page-content secondary-page">
            <div className="breadcrumb">
              BETTER TOGETHER <span>/</span> COMMUNITY
            </div>
            <h1>
              Share a plan. <em>Start a habit.</em>
            </h1>
            <p className="page-intro">
              Turn your family’s plan into a simple note for a school group,
              neighbour, or community chat.
            </p>
            <div className="community-layout">
              <div className="community-main">
                <div className="community-banner">
                  <div className="community-banner-icon">
                    <UsersRound size={30} />
                  </div>
                  <span className="eyebrow">SMALL ACTION, SHARED IMPACT</span>
                  <h2>A calmer pickup starts with one message.</h2>
                  <p>
                    Share a lower forecast window where timing is flexible, and
                    suggest combining necessary trips or avoiding idling near
                    entrances.
                  </p>
                </div>
                <div className="community-steps">
                  <div>
                    <span>01</span>
                    <p>Make a plan on the Today page.</p>
                  </div>
                  <div>
                    <span>02</span>
                    <p>Check that the timing works for your group.</p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>Copy the note and share it yourself.</p>
                  </div>
                </div>
              </div>
              <div className="share-card">
                <span className="eyebrow">READY TO SHARE</span>
                <h3>Community note</h3>
                <p>{shareText}</p>
                <button onClick={copyPlan}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? "Copied" : "Copy message"}
                </button>
                <small>We do not post this message for you.</small>
              </div>
            </div>
          </div>
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
          onClose={() => setAuthMode(null)}
          onAuthenticate={authenticate}
          onDelete={deleteAccount}
        />
      )}
    </div>
  );
}
