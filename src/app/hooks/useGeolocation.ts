import { useState } from "react";
import type { Place } from "../../shared/saved";

export function useGeolocation(
  onSuccess: (place: Place) => void,
  onToast: (message: string) => void,
) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const requestLocation = () => {
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
        onSuccess({
          id: 0,
          name: "Current area",
          latitude,
          longitude,
          source: "device",
        });
        setLocating(false);
        onToast(
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

  return {
    locating,
    locationError,
    setLocationError,
    requestLocation,
  };
}
