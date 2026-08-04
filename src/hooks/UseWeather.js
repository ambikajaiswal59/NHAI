import { useState, useEffect, useRef } from "react";
import { sendLocationToAPI } from "../services/api";

// target: { flyoverId, lat, lng } | null — pass null to clear/hide weather
export function useWeather(target) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!target) {
      setWeather(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    sendLocationToAPI(target)
      .then((response) => {
        if (requestIdRef.current === requestId) setWeather(response);
      })
      .catch((err) => {
        console.error("Failed to load weather:", err);
        if (requestIdRef.current === requestId) setWeather(null);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }, [target?.flyoverId, target?.lat, target?.lng]);

  return { weather, loading };
}