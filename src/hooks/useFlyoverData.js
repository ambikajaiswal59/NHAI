// src/hooks/useFlyoverData.js
import { useState, useEffect } from 'react';
import { loadFlyoverData } from '../utils/geoJsonParser';

export function useFlyoverData() {
    const [flyovers, setFlyovers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await loadFlyoverData();

                // console.log("Flyover Data is:", data)

                if (data) {
                    setFlyovers(data);
                } else {
                    setError('Failed to load flyover data');
                }
            } catch (err) {
                setError(err.message);
                console.error('Error loading flyover data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return { flyovers, loading, error };
}