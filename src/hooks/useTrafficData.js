// src/hooks/useTrafficData.js
import { useState, useEffect } from 'react';
import { fetchTrafficData } from '../services/api';

export function useTrafficData(flyoverName) {
    const [trafficData, setTrafficData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Don't fetch if no flyover name is provided
        if (!flyoverName) {
            setTrafficData(null);
            setLoading(false);
            setError(null);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        const loadTrafficData = async () => {
            try {
                console.log(`📤 Fetching traffic data for: ${flyoverName}`); // ✅ Add this log
                const data = await fetchTrafficData(flyoverName);
                if (isMounted) {
                    setTrafficData(data);
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.message || 'Failed to fetch traffic data');
                    setLoading(false);
                    setTrafficData(null);
                }
            }
        };

        loadTrafficData();

        return () => {
            isMounted = false;
        };
    }, [flyoverName]); // Re-fetch when flyoverName changes

    return { trafficData, loading, error };
}