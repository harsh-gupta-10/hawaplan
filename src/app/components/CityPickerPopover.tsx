import { useEffect, useRef } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import type { Place } from "../../shared/saved";
import type { CityResult } from "../hooks/useCitySearch";

interface CityPickerPopoverProps {
  cityQuery: string;
  searching: boolean;
  places: CityResult[];
  locating: boolean;
  locationError: string;
  onQueryChange: (query: string) => void;
  onSelectPlace: (place: Place) => void;
  onUseDeviceLocation: () => void;
  onClose: () => void;
}

export default function CityPickerPopover({
  cityQuery,
  searching,
  places,
  locating,
  locationError,
  onQueryChange,
  onSelectPlace,
  onUseDeviceLocation,
  onClose,
}: CityPickerPopoverProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="city-popover"
      role="dialog"
      aria-label="Choose a city or location"
    >
      <button
        className="locate-option"
        onClick={onUseDeviceLocation}
        disabled={locating}
        type="button"
      >
        <LocateFixed size={17} />
        <span>
          <strong>
            {locating ? "Finding your area…" : "Use my current area"}
          </strong>
          <small>Asks for browser permission · saves rounded coordinates</small>
        </span>
      </button>

      <div className="city-search">
        <Search size={17} aria-hidden="true" />
        <input
          ref={searchInputRef}
          aria-label="Search for a city"
          placeholder="Search for a city"
          value={cityQuery}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="city-results" role="region" aria-live="polite">
        {searching ? (
          <p>Searching…</p>
        ) : cityQuery.length < 2 ? (
          <p>Or enter a city name above.</p>
        ) : places.length ? (
          places.map((result) => (
            <button
              key={`${result.id}-${result.latitude}-${result.longitude}`}
              onClick={() => onSelectPlace(result)}
              type="button"
            >
              <MapPin size={15} aria-hidden="true" />
              <span>
                {result.name}
                <small>
                  {[result.admin1, result.country].filter(Boolean).join(", ")}
                </small>
              </span>
            </button>
          ))
        ) : (
          <p>No cities found.</p>
        )}
      </div>

      {locationError && (
        <p className="location-error" role="alert">
          {locationError}
        </p>
      )}
    </div>
  );
}
