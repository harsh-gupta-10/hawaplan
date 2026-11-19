import { useEffect, useMemo, useState } from "react";
import type { Forecast } from "../../shared/planner";
import type { Place } from "../../shared/saved";

export const forecastKey = (place: Place): string =>
  `hawaplan-forecast-v2:${place.latitude.toFixed(2)}:${place.longitude.toFixed(2)}`;

export function loadForecast(place: Place): Forecast | null {
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

export function useForecast(place: Place, refreshCount: number) {
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

  const requestKey = [locationKey, place.name, refreshCount].join(":");
  const forecast =
    forecastResult?.locationKey === locationKey
      ? forecastResult.value
      : cachedForecast;
  const forecastError =
    forecastRequest?.key === requestKey ? forecastRequest.error : "";
  const loadingForecast = forecastRequest?.key !== requestKey;

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
      .catch((error: Error) => {
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

  return {
    forecast,
    loadingForecast,
    forecastError,
  };
}
