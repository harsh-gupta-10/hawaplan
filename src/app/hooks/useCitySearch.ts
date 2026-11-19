import { useEffect, useState } from "react";
import type { Place } from "../../shared/saved";

export type CityResult = Place & { id: number };

export function useCitySearch(isOpen: boolean) {
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

  useEffect(() => {
    if (!isOpen || activeCityQuery.length < 2) return;
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
  }, [isOpen, activeCityQuery]);

  return {
    cityQuery,
    setCityQuery,
    activeCityQuery,
    places,
    searching,
    resetSearch: () => {
      setCityQuery("");
      setCitySearch({ query: "", loading: false, results: [] });
    },
  };
}
