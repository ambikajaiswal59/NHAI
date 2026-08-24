// src/hooks/useIDWWeather.js
import { useState, useCallback, useEffect, useRef } from "react";
import { fetchMonthlyWeatherData } from "../services/api";

export function useIDWWeather() {
    const [weatherData, setWeatherData] = useState(null);
    const [allMonthlyData, setAllMonthlyData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [selectedLayer, setSelectedLayer] = useState('rainfall');
    const [months, setMonths] = useState([]);
    const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(3000);

    // Refs for managing playback
    const isPlayingRef = useRef(false);
    const renderTimeoutRef = useRef(null);
    const pendingMonthRef = useRef(null);

    // Fetch all monthly data at once
    const fetchAllMonthlyData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetchMonthlyWeatherData();

            if (Array.isArray(response) && response.length > 0) {
                setAllMonthlyData(response);

                const uniqueMonths = [...new Set(response.map(item =>
                    `${item.year}-${String(item.month).padStart(2, '0')}`
                ))].sort();

                // console.log("Unique months are", uniqueMonths)

                setMonths(uniqueMonths);

                if (uniqueMonths.length > 0) {
                    const firstMonth = uniqueMonths[0];
                    setSelectedMonth(firstMonth);
                    const monthData = response.filter(item =>
                        `${item.year}-${String(item.month).padStart(2, '0')}` === firstMonth
                    );
                    setWeatherData(monthData);
                }
            } else {
                throw new Error('No data received from server or invalid data format');
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch monthly weather data');
            console.error('❌ Error fetching monthly weather data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Change to specific month with rendering check
    const changeMonth = useCallback((monthKey) => {
        if (!allMonthlyData) return;

        // If currently rendering, queue this month change
        if (isRendering) {
            console.log('⏳ IDW is rendering, queuing month change to:', monthKey);
            pendingMonthRef.current = monthKey;
            return;
        }

        setSelectedMonth(monthKey);
        const monthData = allMonthlyData.filter(item =>
            `${item.year}-${String(item.month).padStart(2, '0')}` === monthKey
        );
        setWeatherData(monthData);

        const index = months.indexOf(monthKey);
        if (index !== -1) {
            setCurrentMonthIndex(index);
        }

        // Notify that we're starting to render
        setIsRendering(true);

        // Clear any pending render timeout
        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current);
        }

        // Assume rendering takes ~500ms, then allow next month switch
        renderTimeoutRef.current = setTimeout(() => {
            setIsRendering(false);
            console.log('✅ IDW rendering complete, ready for next month');

            // If there's a pending month, switch to it
            if (pendingMonthRef.current) {
                const pending = pendingMonthRef.current;
                pendingMonthRef.current = null;
                console.log('🔄 Switching to pending month:', pending);
                changeMonth(pending);
            }
        }, 800); // Adjust based on your IDW render time
    }, [allMonthlyData, months, isRendering]);

    // Go to next month
    const nextMonth = useCallback(() => {
        if (months.length === 0 || isRendering) {
            if (isRendering) {
                console.log('⏳ Skipping next month - IDW is rendering');
            }
            return;
        }
        const nextIndex = (currentMonthIndex + 1) % months.length;
        changeMonth(months[nextIndex]);
    }, [months, currentMonthIndex, changeMonth, isRendering]);

    // Go to previous month
    const prevMonth = useCallback(() => {
        if (months.length === 0 || isRendering) {
            if (isRendering) {
                console.log('⏳ Skipping previous month - IDW is rendering');
            }
            return;
        }
        const prevIndex = (currentMonthIndex - 1 + months.length) % months.length;
        changeMonth(months[prevIndex]);
    }, [months, currentMonthIndex, changeMonth, isRendering]);

    // Play through months
    const startPlayback = useCallback(() => {
        if (months.length === 0) return;
        isPlayingRef.current = true;
        setIsPlaying(true);
    }, [months.length]);

    const stopPlayback = useCallback(() => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        // Clear pending month when stopping
        pendingMonthRef.current = null;
        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current);
            renderTimeoutRef.current = null;
        }
    }, []);

    // Auto-playback effect with rendering check
    useEffect(() => {
        let intervalId = null;

        if (isPlaying && months.length > 0) {
            intervalId = setInterval(() => {
                // Only switch if not currently rendering
                if (!isRendering) {
                    nextMonth();
                } else {
                    console.log('⏳ Skipping interval - IDW is rendering');
                }
            }, playbackSpeed);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isPlaying, months, nextMonth, playbackSpeed, isRendering]);

    // Change the active layer
    const changeLayer = useCallback((layer) => {
        if (['rainfall', 'wind', 'temperature'].includes(layer)) {
            setSelectedLayer(layer);
        } else {
            console.warn(`⚠️ Unknown layer: ${layer}`);
        }
    }, []);

    // Clear the current data
    const clearData = useCallback(() => {
        setWeatherData(null);
        setAllMonthlyData(null);
        setSelectedMonth(null);
        setError(null);
        setMonths([]);
        setCurrentMonthIndex(0);
        setIsPlaying(false);
        isPlayingRef.current = false;
        pendingMonthRef.current = null;
        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current);
            renderTimeoutRef.current = null;
        }
    }, []);

    return {
        weatherData,
        allMonthlyData,
        loading,
        error,
        selectedMonth,
        selectedLayer,
        months,
        currentMonthIndex,
        isPlaying,
        isRendering,
        playbackSpeed,
        setPlaybackSpeed,
        fetchAllMonthlyData,
        changeMonth,
        nextMonth,
        prevMonth,
        startPlayback,
        stopPlayback,
        changeLayer,
        clearData,
    };
}