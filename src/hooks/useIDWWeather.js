import { useState, useCallback } from "react";
import { fetchIDWWeatherData } from "../services/api";


export function useIDWWeather() {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedLayer, setSelectedLayer] = useState('rainfall'); // 'rainfall' | 'wind' | 'temperature'

    // Fetch weather data for a specific date

    const fetchWeather = useCallback(async (date) => {
        if (!date) {
            setError('Please select a date');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetchIDWWeatherData(date);

            if (response && response.data) {
                setWeatherData(response.data);
                setSelectedDate(date);
                console.log(`✅ Weather data loaded for ${date}:`, response.data.length, 'stations');
            } else {
                throw new Error('No data received from server');
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch weather data');
            console.error('❌ Error fetching weather:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Change the active layer (only rainfall, wind, temperature)
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
        setSelectedDate(null);
        setError(null);
    }, []);

    return {
        weatherData,
        loading,
        error,
        selectedDate,
        selectedLayer,
        fetchWeather,
        changeLayer,
        clearData,
    };

}