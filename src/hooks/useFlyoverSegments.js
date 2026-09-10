// src/hooks/useFlyoverSegments.js
import { useState, useEffect, useCallback } from 'react';
import {
    fetchLiveSegments,
    fetchPolygonSegment,
    fetchLiveSegmentStats
} from '../services/api'

export const useFlyoverSegments = () => {
    const [liveSegments, setLiveSegments] = useState(null);
    const [polygonSegments, setPolygonSegments] = useState(null);
    const [segmentStats, setSegmentStats] = useState(null);
    const [loading, setLoading] = useState({
        live: false,
        polygon: false,
        stats: false
    });
    const [error, setError] = useState({
        live: null,
        polygon: null,
        stats: null
    });

    // Fetch all live segments (LineString GeoJSON)
    const loadLiveSegments = useCallback(async () => {
        setLoading(prev => ({ ...prev, live: true }));
        setError(prev => ({ ...prev, live: null }));

        try {
            const response = await fetchLiveSegments();
            if (response.status === 'success') {
                setLiveSegments(response.data);
                return response.data;
            } else {
                throw new Error('Failed to fetch live segments');
            }
        } catch (err) {
            setError(prev => ({ ...prev, live: err.message }));
            console.error('Error loading live segments:', err);
            return null;
        } finally {
            setLoading(prev => ({ ...prev, live: false }));
        }
    }, []);

    // Fetch polygon segment by ID or Location
    const loadPolygonSegment = useCallback(async ({ type, id = null, latitude = null, longitude = null }) => {
        setLoading(prev => ({ ...prev, polygon: true }));
        setError(prev => ({ ...prev, polygon: null }));

        try {
            const response = await fetchPolygonSegment({ type, id, latitude, longitude });
            if (response.status === 'success') {
                setPolygonSegments(response.data);
                return response.data;
            } else {
                throw new Error('Failed to fetch polygon segment');
            }
        } catch (err) {
            setError(prev => ({ ...prev, polygon: err.message }));
            console.error('Error loading polygon segment:', err);
            return null;
        } finally {
            setLoading(prev => ({ ...prev, polygon: false }));
        }
    }, []);

    // Fetch segment statistics (no geometry)
    const loadSegmentStats = useCallback(async () => {
        setLoading(prev => ({ ...prev, stats: true }));
        setError(prev => ({ ...prev, stats: null }));

        try {
            const response = await fetchLiveSegmentStats();
            if (response.status === 'success') {
                setSegmentStats(response.data);
                return response.data;
            } else {
                throw new Error('Failed to fetch segment stats');
            }
        } catch (err) {
            setError(prev => ({ ...prev, stats: err.message }));
            console.error('Error loading segment stats:', err);
            return null;
        } finally {
            setLoading(prev => ({ ...prev, stats: false }));
        }
    }, []);

    // Load all data on mount
    useEffect(() => {
        loadLiveSegments();
        loadSegmentStats();
    }, [loadLiveSegments, loadSegmentStats]);

    // Get velocity color for segment styling
    const getVelocityColor = useCallback((velocity) => {
        if (velocity === null || velocity === undefined) return '#888888';

        if (velocity < -25) return '#e00f00'; // Red - high negative
        if (velocity < -15) return '#FFDF00'; // Yellow - moderate negative
        if (velocity < 20) return '#ffffff';   // White - stable
        if (velocity < 30) return '#00FFFF';   // Cyan - moderate positive
        return '#4B00E0';                      // Blue - high positive
    }, []);

    // Get segment style based on velocity
    const getSegmentStyle = useCallback((feature) => {
        const velocity = feature?.properties?.avg_velocity;
        const color = getVelocityColor(velocity);

        return {
            color: color,
            weight: 3,
            opacity: 0.8,
            fillColor: color,
            fillOpacity: 0.3
        };
    }, [getVelocityColor]);

    // Get popup content for a segment
    const getPopupContent = useCallback((feature) => {
        const props = feature?.properties || {};
        const geometryType = feature?.geometry?.type || 'Unknown';

        return `
      <div style="padding: 8px; font-family: Arial, sans-serif; min-width: 180px;">
        <h4 style="margin: 0 0 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
          ${props.name || 'Unknown Segment'}
        </h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 2px 0; color: #6b7280;">ID:</td>
            <td style="padding: 2px 0; font-weight: 600;">${props.objectid || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 2px 0; color: #6b7280;">Type:</td>
            <td style="padding: 2px 0; font-weight: 600;">${geometryType}</td>
          </tr>
          <tr>
            <td style="padding: 2px 0; color: #6b7280;">Velocity:</td>
            <td style="padding: 2px 0; font-weight: 600; ${props.avg_velocity < -15 ? 'color: #dc2626;' : props.avg_velocity > 15 ? 'color: #2563eb;' : 'color: #16a34a;'}">
              ${props.avg_velocity !== null && props.avg_velocity !== undefined ? props.avg_velocity + ' mm/yr' : 'N/A'}
            </td>
          </tr>
          <tr>
            <td style="padding: 2px 0; color: #6b7280;">Direction:</td>
            <td style="padding: 2px 0; font-weight: 600;">${props.direction || 'N/A'}</td>
          </tr>
          ${props.insert_at ? `
          <tr>
            <td style="padding: 2px 0; color: #6b7280;">Updated:</td>
            <td style="padding: 2px 0; font-weight: 600; font-size: 10px;">${new Date(props.insert_at).toLocaleString()}</td>
          </tr>
          ` : ''}
        </table>
      </div>
    `;
    }, []);

    return {
        liveSegments,
        polygonSegments,
        segmentStats,
        loading,
        error,
        loadLiveSegments,
        loadPolygonSegment,
        loadSegmentStats,
        getVelocityColor,
        getSegmentStyle,
        getPopupContent
    };
};