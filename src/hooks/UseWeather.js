// hooks/useWeather.js
import { useState, useCallback } from "react";
import { weather as mockWeather } from "../data/mockData";

const USE_MOCK = true;

export function useWeather() {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastFetched, setLastFetched] = useState(null);

    const fetchWeather = useCallback(async (latitude, longitude, label) => {
        setLoading(true);
        console.log(`🌤️ Fetching weather for: ${latitude}, ${longitude} (${label || 'unnamed'})`);

        if (USE_MOCK) {
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 300));

            // Update the mock weather with the new location. Prefer the
            // human-readable label (e.g. "NH 152") passed in from the click;
            // fall back to coordinates only if no label was given.
            const updatedWeather = {
                ...mockWeather,
                location: label || `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`,
                // You could add logic to vary weather based on location here
            };
            setWeather(updatedWeather);
            setLastFetched(new Date());
            setLoading(false);
            return;
        }

        // Real API call goes here later
        // try {
        //     const response = await fetch(
        //         `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}`
        //     );
        //     const data = await response.json();
        //     setWeather(transformApiResponse(data));
        //     setLastFetched(new Date());
        // } catch (error) {
        //     console.error('Weather fetch error:', error);
        // } finally {
        //     setLoading(false);
        // }
    }, []);

    // No automatic fetching here on purpose: the caller (App.jsx) decides
    // exactly when to fetch — once on initial load, and once per explicit
    // map click. That keeps a click's exact coordinates from ever being
    // silently overwritten by a "switched active card" side effect.

    return { weather, loading, fetchWeather, lastFetched };
}








