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
    const [isPlaying, setIsPlaying] = useState(true);
    const [isRendering, setIsRendering] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(2000);

    const isPlayingRef = useRef(true);
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
            if (err.status === 401) {
                // authFetch is already redirecting to /login — just avoid
                // showing a misleading "no data" error in the meantime.
                setError('Session expired — redirecting to login...');
                console.warn('Session expired, redirecting...');
            } else {
                setError(err.message || 'Failed to fetch monthly weather data');
                console.error(' Error fetching monthly weather data:', err);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const changeMonth = useCallback((monthKey) => {
        if (!allMonthlyData) return;

        if (isRendering) {
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

        setIsRendering(true);

        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current);
        }

        renderTimeoutRef.current = setTimeout(() => {
            setIsRendering(false);
            // console.log('IDW rendering complete, ready for next month');

            if (pendingMonthRef.current) {
                const pending = pendingMonthRef.current;
                pendingMonthRef.current = null;
                changeMonth(pending);
            }
        }, 1200);
    }, [allMonthlyData, months, isRendering]);

    const nextMonth = useCallback(() => {
        if (months.length === 0 || isRendering) {
            return;
        }
        const nextIndex = (currentMonthIndex + 1) % months.length;
        changeMonth(months[nextIndex]);
    }, [months, currentMonthIndex, changeMonth, isRendering]);

    const prevMonth = useCallback(() => {
        if (months.length === 0 || isRendering) {
            return;
        }
        const prevIndex = (currentMonthIndex - 1 + months.length) % months.length;
        changeMonth(months[prevIndex]);
    }, [months, currentMonthIndex, changeMonth, isRendering]);

    const startPlayback = useCallback(() => {
        if (months.length === 0) return;
        isPlayingRef.current = true;
        setIsPlaying(true);
    }, [months.length]);

    const stopPlayback = useCallback(() => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        pendingMonthRef.current = null;
        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current);
            renderTimeoutRef.current = null;
        }
    }, []);

    const changeLayer = useCallback((layer) => {
        if (['rainfall', 'wind', 'temperature'].includes(layer)) {
            setSelectedLayer(layer);
            setIsRendering(true);

            if (renderTimeoutRef.current) {
                clearTimeout(renderTimeoutRef.current);
                renderTimeoutRef.current = null;
            }

            if (selectedMonth && allMonthlyData) {
                const monthData = allMonthlyData.filter(item =>
                    `${item.year}-${String(item.month).padStart(2, '0')}` === selectedMonth
                );
                setWeatherData(monthData);
            } else if (allMonthlyData && months.length > 0) {

                const firstMonth = months[0];
                setSelectedMonth(firstMonth);
                const monthData = allMonthlyData.filter(item =>
                    `${item.year}-${String(item.month).padStart(2, '0')}` === firstMonth
                );
                setWeatherData(monthData);
            }

            let renderTimeout = 1200;
            if (layer === 'wind') {
                renderTimeout = 2500;
            }

            renderTimeoutRef.current = setTimeout(() => {
                setIsRendering(false);


                if (pendingMonthRef.current) {
                    const pending = pendingMonthRef.current;
                    pendingMonthRef.current = null;
                    changeMonth(pending);
                }
            }, renderTimeout);

        } else {
            console.warn(`Unknown layer: ${layer}`);
        }
    }, [selectedMonth, allMonthlyData, months]);

    // Auto-playback effect
    useEffect(() => {
        let intervalId = null;

        if (isPlaying && months.length > 0) {
            intervalId = setInterval(() => {
                if (!isRendering) {
                    nextMonth();
                } else {

                }
            }, playbackSpeed);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isPlaying, months, nextMonth, playbackSpeed, isRendering]);

    // ✅ FIXED: Don't clear allMonthlyData
    // const clearData = useCallback(() => {
    //     setWeatherData(null);
    //     // ✅ Keep allMonthlyData for when user selects a new layer
    //     // setAllMonthlyData(null); // ← DO NOT CLEAR THIS
    //     setSelectedMonth(null);
    //     setError(null);
    //     setMonths([]);
    //     setCurrentMonthIndex(0);
    //     setIsPlaying(false);
    //     isPlayingRef.current = false;
    //     pendingMonthRef.current = null;
    //     if (renderTimeoutRef.current) {
    //         clearTimeout(renderTimeoutRef.current);
    //         renderTimeoutRef.current = null;
    //     }
    // }, []);


    // In useIDWWeather.js - clearData function
    const clearData = useCallback(() => {
        setWeatherData(null);
        // ✅ DO NOT clear allMonthlyData
        // setAllMonthlyData(null);
        setSelectedMonth(null);
        setError(null);
        // ✅ Keep months
        // setMonths([]);
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
