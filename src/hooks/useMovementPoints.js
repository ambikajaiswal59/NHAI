// src/hooks/useMovementPoints.js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    fetchMovementPoints,
    fetchMovementPointById,
} from '../services/api';

export function useMovementPoints() {
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);
    const [availableDates, setAvailableDates] = useState([]); // NEW
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [selectedPointData, setSelectedPointData] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const cacheRef = useRef(new Map());

    // Fetch all points
    const fetchPoints = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMovementPoints();
            setPoints(data.features || []);
            setTotal(data.total || 0);
            setAvailableDates(data.available_dates || []); // NEW
            console.log('📅 Available dates:', data.available_dates);
        } catch (err) {
            setError(err.message || 'Failed to fetch movement points');
            console.error('Error fetching points:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch single point detail with timeseries
    const fetchPointDetail = useCallback(async (pointId) => {
        if (cacheRef.current.has(pointId)) {
            const cached = cacheRef.current.get(pointId);
            setSelectedPointData(cached);
            return cached;
        }

        setLoadingDetail(true);
        try {
            const data = await fetchMovementPointById(pointId);
            cacheRef.current.set(pointId, data);
            setSelectedPointData(data);
            return data;
        } catch (err) {
            console.error(`Error fetching point ${pointId}:`, err);
            throw err;
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    // Select a point
    const selectPoint = useCallback(async (pointId) => {
        setSelectedPoint(pointId);
        if (pointId) {
            return await fetchPointDetail(pointId);
        } else {
            setSelectedPointData(null);
            return null;
        }
    }, [fetchPointDetail]);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedPoint(null);
        setSelectedPointData(null);
    }, []);

    // Get point by ID
    const getPointById = useCallback((id) => {
        return points.find(p => p.data?.id === id);
    }, [points]);

    // Get filtered points
    const getFilteredPoints = useCallback((filters = {}) => {
        let filtered = [...points];

        if (filters.minVelocity !== undefined) {
            filtered = filtered.filter(p =>
                Math.abs(p.data?.velocity || 0) >= filters.minVelocity
            );
        }

        if (filters.maxVelocity !== undefined) {
            filtered = filtered.filter(p =>
                Math.abs(p.data?.velocity || 0) <= filters.maxVelocity
            );
        }

        if (filters.minCoherence !== undefined) {
            filtered = filtered.filter(p =>
                (p.data?.coherence || 0) >= filters.minCoherence
            );
        }

        return filtered;
    }, [points]);

    // Load data on mount
    useEffect(() => {
        fetchPoints();
    }, [fetchPoints]);

    return {
        points,
        loading,
        error,
        total,
        availableDates, // NEW
        selectedPoint,
        selectedPointData,
        loadingDetail,
        fetchPoints,
        selectPoint,
        clearSelection,
        getPointById,
        getFilteredPoints,
        cache: cacheRef.current,
    };
}