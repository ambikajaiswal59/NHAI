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
            setError(err.message || 'Failed to fetch monthly weather data');
            console.error(' Error fetching monthly weather data:', err);
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
            console.log('IDW rendering complete, ready for next month');

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

    // ✅ FIXED: Change the active layer with proper data handling
    const changeLayer = useCallback((layer) => {
        if (['rainfall', 'wind', 'temperature'].includes(layer)) {
            setSelectedLayer(layer);
            setIsRendering(true);

            if (renderTimeoutRef.current) {
                clearTimeout(renderTimeoutRef.current);
                renderTimeoutRef.current = null;
            }

            // ✅ If weatherData is null or empty, populate it from allMonthlyData
            if (selectedMonth && allMonthlyData) {
                const monthData = allMonthlyData.filter(item =>
                    `${item.year}-${String(item.month).padStart(2, '0')}` === selectedMonth
                );
                setWeatherData(monthData);
            } else if (allMonthlyData && months.length > 0) {
                // ✅ If selectedMonth is null, use first month
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
                console.log(`Layer switch complete (${layer}), playback resuming`);

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






// // src/hooks/useIDWWeather.js
// import { useState, useCallback, useEffect, useRef } from "react";
// import { fetchMonthlyWeatherData } from "../services/api";

// export function useIDWWeather() {
//     const [weatherData, setWeatherData] = useState(null);
//     const [allMonthlyData, setAllMonthlyData] = useState(null);
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState(null);
//     const [selectedMonth, setSelectedMonth] = useState(null);
//     const [selectedLayer, setSelectedLayer] = useState('rainfall');
//     const [months, setMonths] = useState([]);
//     const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
//     const [isPlaying, setIsPlaying] = useState(true);
//     const [isRendering, setIsRendering] = useState(false);
//     const [playbackSpeed, setPlaybackSpeed] = useState(2000);

//     const isPlayingRef = useRef(true);
//     const renderTimeoutRef = useRef(null);
//     const pendingMonthRef = useRef(null);

//     // Fetch all monthly data at once
//     const fetchAllMonthlyData = useCallback(async () => {
//         setLoading(true);
//         setError(null);

//         try {
//             const response = await fetchMonthlyWeatherData();

//             if (Array.isArray(response) && response.length > 0) {
//                 setAllMonthlyData(response);

//                 const uniqueMonths = [...new Set(response.map(item =>
//                     `${item.year}-${String(item.month).padStart(2, '0')}`
//                 ))].sort();

//                 setMonths(uniqueMonths);

//                 if (uniqueMonths.length > 0) {
//                     const firstMonth = uniqueMonths[0];
//                     setSelectedMonth(firstMonth);
//                     const monthData = response.filter(item =>
//                         `${item.year}-${String(item.month).padStart(2, '0')}` === firstMonth
//                     );
//                     setWeatherData(monthData);
//                 }
//             } else {
//                 throw new Error('No data received from server or invalid data format');
//             }
//         } catch (err) {
//             setError(err.message || 'Failed to fetch monthly weather data');
//             console.error(' Error fetching monthly weather data:', err);
//         } finally {
//             setLoading(false);
//         }
//     }, []);

//     // Change to specific month with rendering check
//     const changeMonth = useCallback((monthKey) => {
//         if (!allMonthlyData) return;

//         if (isRendering) {
//             pendingMonthRef.current = monthKey;
//             return;
//         }

//         setSelectedMonth(monthKey);
//         const monthData = allMonthlyData.filter(item =>
//             `${item.year}-${String(item.month).padStart(2, '0')}` === monthKey
//         );
//         setWeatherData(monthData);

//         const index = months.indexOf(monthKey);
//         if (index !== -1) {
//             setCurrentMonthIndex(index);
//         }

//         setIsRendering(true);

//         if (renderTimeoutRef.current) {
//             clearTimeout(renderTimeoutRef.current);
//         }

//         renderTimeoutRef.current = setTimeout(() => {
//             setIsRendering(false);
//             console.log('IDW rendering complete, ready for next month');

//             if (pendingMonthRef.current) {
//                 const pending = pendingMonthRef.current;
//                 pendingMonthRef.current = null;
//                 changeMonth(pending);
//             }
//         }, 1200);
//     }, [allMonthlyData, months, isRendering]);

//     // Go to next month
//     const nextMonth = useCallback(() => {
//         if (months.length === 0 || isRendering) {
//             return;
//         }
//         const nextIndex = (currentMonthIndex + 1) % months.length;
//         changeMonth(months[nextIndex]);
//     }, [months, currentMonthIndex, changeMonth, isRendering]);

//     // Go to previous month
//     const prevMonth = useCallback(() => {
//         if (months.length === 0 || isRendering) {
//             return;
//         }
//         const prevIndex = (currentMonthIndex - 1 + months.length) % months.length;
//         changeMonth(months[prevIndex]);
//     }, [months, currentMonthIndex, changeMonth, isRendering]);

//     // Play through months
//     const startPlayback = useCallback(() => {
//         if (months.length === 0) return;
//         isPlayingRef.current = true;
//         setIsPlaying(true);
//     }, [months.length]);

//     const stopPlayback = useCallback(() => {
//         isPlayingRef.current = false;
//         setIsPlaying(false);
//         pendingMonthRef.current = null;
//         if (renderTimeoutRef.current) {
//             clearTimeout(renderTimeoutRef.current);
//             renderTimeoutRef.current = null;
//         }
//     }, []);

//     // ✅ FIXED: Change the active layer with dynamic timeout based on layer
//     const changeLayer = useCallback((layer) => {
//         if (['rainfall', 'wind', 'temperature'].includes(layer)) {
//             setSelectedLayer(layer);

//             // ✅ Set isRendering to true to prevent nextMonth() during render
//             setIsRendering(true);

//             // Clear any existing timeout
//             if (renderTimeoutRef.current) {
//                 clearTimeout(renderTimeoutRef.current);
//                 renderTimeoutRef.current = null;
//             }

//             // Update data for current month with new layer
//             if (selectedMonth && allMonthlyData) {
//                 const monthData = allMonthlyData.filter(item =>
//                     `${item.year}-${String(item.month).padStart(2, '0')}` === selectedMonth
//                 );
//                 setWeatherData(monthData);
//             }

//             // ✅ Dynamic timeout based on layer type
//             // Wind takes longer to render than Temperature and Rainfall
//             let renderTimeout = 1200; // Default
//             if (layer === 'wind') {
//                 renderTimeout = 2500; // Wind needs more time
//             } else if (layer === 'temperature') {
//                 renderTimeout = 1200;
//             } else if (layer === 'rainfall') {
//                 renderTimeout = 1200;
//             }

//             // ✅ Allow rendering to complete before allowing next month switch
//             renderTimeoutRef.current = setTimeout(() => {
//                 setIsRendering(false);
//                 console.log(`Layer switch complete (${layer}), playback resuming`);

//                 if (pendingMonthRef.current) {
//                     const pending = pendingMonthRef.current;
//                     pendingMonthRef.current = null;
//                     changeMonth(pending);
//                 }
//             }, renderTimeout);

//         } else {
//             console.warn(`Unknown layer: ${layer}`);
//         }
//     }, [selectedMonth, allMonthlyData]);

//     // Auto-playback effect with rendering check
//     useEffect(() => {
//         let intervalId = null;

//         if (isPlaying && months.length > 0) {
//             intervalId = setInterval(() => {
//                 if (!isRendering) {
//                     nextMonth();
//                 } else {
//                     console.log('⏳ Skipping interval - IDW is rendering');
//                 }
//             }, playbackSpeed);
//         }

//         return () => {
//             if (intervalId) {
//                 clearInterval(intervalId);
//             }
//         };
//     }, [isPlaying, months, nextMonth, playbackSpeed, isRendering]);

//     // Clear the current data
//     const clearData = useCallback(() => {
//         setWeatherData(null);
//         setAllMonthlyData(null);
//         setSelectedMonth(null);
//         setError(null);
//         setMonths([]);
//         setCurrentMonthIndex(0);
//         setIsPlaying(false);
//         isPlayingRef.current = false;
//         pendingMonthRef.current = null;
//         if (renderTimeoutRef.current) {
//             clearTimeout(renderTimeoutRef.current);
//             renderTimeoutRef.current = null;
//         }
//     }, []);

//     return {
//         weatherData,
//         allMonthlyData,
//         loading,
//         error,
//         selectedMonth,
//         selectedLayer,
//         months,
//         currentMonthIndex,
//         isPlaying,
//         isRendering,
//         playbackSpeed,
//         setPlaybackSpeed,
//         fetchAllMonthlyData,
//         changeMonth,
//         nextMonth,
//         prevMonth,
//         startPlayback,
//         stopPlayback,
//         changeLayer,
//         clearData,
//     };
// }
