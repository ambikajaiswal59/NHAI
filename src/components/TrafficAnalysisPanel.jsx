// src/components/TrafficAnalysisPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Activity, ArrowUp, ArrowDown, AlertTriangle, X } from "lucide-react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine, ReferenceArea, ComposedChart
} from 'recharts';
import { useTrafficData } from "../hooks/useTrafficData";

// Custom tooltip for chart
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'white',
                padding: '10px 14px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid #e5e7eb',
                fontSize: '12px'
            }}>
                <p style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    {label}
                </p>
                {payload.map((entry, index) => (
                    <div key={index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '20px',
                        color: entry.color
                    }}>
                        <span>{entry.name}:</span>
                        <span style={{ fontWeight: '600' }}>
                            {entry.value.toFixed(2)}
                            {entry.value > 1 && ' 🔴'}
                        </span>
                    </div>
                ))}
                <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px', borderTop: '1px solid #e5e7eb', paddingTop: '4px' }}>
                    Ratio &gt; 1 = Traffic
                </div>
            </div>
        );
    }
    return null;
};

export default function TrafficAnalysisPanel({
    selectedFlyoverForTraffic,
    onClose,
    isMobile
}) {
    // Use the traffic data hook
    const { trafficData, loading: trafficLoading, error: trafficError } = useTrafficData(selectedFlyoverForTraffic);

    // Full 24h merged series
    const fullChartData = useMemo(() => {
        if (!trafficData?.traffic_data) return [];
        const upData = trafficData.traffic_data.up || [];
        const downData = trafficData.traffic_data.down || [];
        const map = new Map();

        const upsert = (item, valKey, hasKey) => {
            const existing = map.get(item.time) || {
                time: item.time, up_ratio: null, up_has_traffic: null,
                down_ratio: null, down_has_traffic: null,
            };
            existing[valKey] = item.traffic_ratio;
            existing[hasKey] = item.has_traffic;
            map.set(item.time, existing);
        };

        upData.forEach(i => upsert(i, 'up_ratio', 'up_has_traffic'));
        downData.forEach(i => upsert(i, 'down_ratio', 'down_has_traffic'));

        return Array.from(map.values()).sort((a, b) => new Date(a.time) - new Date(b.time));
    }, [trafficData]);

    // Function to get dynamic intervals based on current time
    const getDynamicIntervals = () => {
        const now = new Date();
        const currentHour = now.getHours();

        const blockStartHour = Math.floor(currentHour / 4) * 4;

        const intervals = [];
        for (let i = 0; i < 6; i++) {
            const startHour = (blockStartHour - (i * 4) + 24) % 24;
            const endHour = (startHour + 4) % 24;

            let label;
            if (endHour === 0) {
                label = `${startHour}:00–24:00`;
            } else if (startHour === 0) {
                label = `00:00–${endHour}:00`;
            } else {
                label = `${startHour}:00–${endHour}:00`;
            }

            intervals.push({
                key: `block-${i}`,
                label: label,
                startHour: startHour,
                endHour: endHour,
                isCurrent: i === 0
            });
        }

        return intervals;
    };

    // State for dynamic intervals
    const [dynamicIntervals, setDynamicIntervals] = useState(getDynamicIntervals);
    const [selectedInterval, setSelectedInterval] = useState('block-0');
    const [zoomDomain, setZoomDomain] = useState(null);
    const [refAreaLeft, setRefAreaLeft] = useState('');
    const [refAreaRight, setRefAreaRight] = useState('');

    const intervalFilteredData = useMemo(() => {
        if (!fullChartData || fullChartData.length === 0) return [];

        const interval = dynamicIntervals.find(i => i.key === selectedInterval);
        if (!interval) return fullChartData;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        return fullChartData.filter(d => {
            const date = new Date(d.time);
            const hours = date.getHours();

            const isToday = date.getFullYear() === today.getFullYear() &&
                date.getMonth() === today.getMonth() &&
                date.getDate() === today.getDate();

            const isYesterday = date.getFullYear() === yesterday.getFullYear() &&
                date.getMonth() === yesterday.getMonth() &&
                date.getDate() === yesterday.getDate();

            let hourMatch = false;
            if (interval.startHour >= interval.endHour) {
                hourMatch = hours >= interval.startHour || hours < interval.endHour;
            } else {
                hourMatch = hours >= interval.startHour && hours < interval.endHour;
            }

            if (interval.isCurrent) {
                return isToday && hourMatch;
            } else {
                const hasTodayData = fullChartData.some(d => {
                    const dDate = new Date(d.time);
                    const dHours = dDate.getHours();
                    const isTodayCheck = dDate.getFullYear() === today.getFullYear() &&
                        dDate.getMonth() === today.getMonth() &&
                        dDate.getDate() === today.getDate();
                    let hourMatchCheck = false;
                    if (interval.startHour >= interval.endHour) {
                        hourMatchCheck = dHours >= interval.startHour || dHours < interval.endHour;
                    } else {
                        hourMatchCheck = dHours >= interval.startHour && dHours < interval.endHour;
                    }
                    return isTodayCheck && hourMatchCheck;
                });

                if (hasTodayData) {
                    return isToday && hourMatch;
                } else {
                    return isYesterday && hourMatch;
                }
            }
        });
    }, [fullChartData, selectedInterval, dynamicIntervals]);

    function downsample(data, maxPoints = 300) {
        if (data.length <= maxPoints) return data;
        const bucketSize = Math.ceil(data.length / maxPoints);
        const result = [];
        for (let i = 0; i < data.length; i += bucketSize) {
            const bucket = data.slice(i, i + bucketSize);
            const maxUp = bucket.reduce((m, d) => (d.up_ratio ?? 0) > (m.up_ratio ?? 0) ? d : m, bucket[0]);
            const maxDown = bucket.reduce((m, d) => (d.down_ratio ?? 0) > (m.down_ratio ?? 0) ? d : m, bucket[0]);
            result.push({
                time: bucket[Math.floor(bucket.length / 2)].time,
                up_ratio: maxUp.up_ratio,
                up_has_traffic: bucket.some(d => d.up_has_traffic),
                down_ratio: maxDown.down_ratio,
                down_has_traffic: bucket.some(d => d.down_has_traffic),
            });
        }
        return result;
    }

    const displayedChartData = useMemo(() => {
        let data = intervalFilteredData;
        if (zoomDomain) {
            data = data.filter(d => {
                const t = new Date(d.time).getTime();
                return t >= zoomDomain.start && t <= zoomDomain.end;
            });
        }
        return data.length > 300 ? downsample(data, 300) : data;
    }, [intervalFilteredData, zoomDomain]);

    const handleMouseDown = (e) => e?.activeLabel && setRefAreaLeft(e.activeLabel);
    const handleMouseMove = (e) => refAreaLeft && e?.activeLabel && setRefAreaRight(e.activeLabel);
    const handleMouseUp = () => {
        if (refAreaLeft && refAreaRight) {
            let start = new Date(refAreaLeft).getTime();
            let end = new Date(refAreaRight).getTime();
            if (start > end) [start, end] = [end, start];
            if (end - start > 1000) setZoomDomain({ start, end });
        }
        setRefAreaLeft('');
        setRefAreaRight('');
    };
    const resetZoom = () => setZoomDomain(null);

    // Reset zoom whenever a new flyover/traffic dataset loads
    useEffect(() => {
        setZoomDomain(null);
        setSelectedInterval('block-0');
        setDynamicIntervals(getDynamicIntervals());
    }, [selectedFlyoverForTraffic]);

    return (
        <div style={{
            width: isMobile ? "100%" : "400px",
            height: isMobile ? "auto" : "100%",
            minHeight: isMobile ? "400px" : "auto",
            maxHeight: isMobile ? "500px" : "100%",
            minWidth: isMobile ? "unset" : "320px",
            maxWidth: isMobile ? "100%" : "480px",
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            transition: "all 0.3s ease",
            position: "relative",
            marginBottom: isMobile ? "16px" : "0",
        }}>
            {/* Panel Header */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: isMobile ? "12px 16px" : "16px 20px",
                borderBottom: "1px solid #e5e7eb",
                background: "#f8fafc",
                flexShrink: 0,
            }}>
                <div style={{ minWidth: 0 }}>
                    <h3 style={{
                        fontSize: isMobile ? "13px" : "15px",
                        fontWeight: "bold",
                        color: "#1f2937",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}>
                        {selectedFlyoverForTraffic}
                    </h3>
                    <p style={{
                        fontSize: isMobile ? "10px" : "11px",
                        color: "#6b7280"
                    }}>
                        Real-time Traffic Analysis
                    </p>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        width: isMobile ? "28px" : "32px",
                        height: isMobile ? "28px" : "32px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        background: "#f8fafc",
                        cursor: "pointer",
                        color: "#6b7280",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = "#fef2f2";
                        e.target.style.borderColor = "#fca5a5";
                        e.target.style.color = "#dc2626";
                        e.target.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = "#f8fafc";
                        e.target.style.borderColor = "#e5e7eb";
                        e.target.style.color = "#6b7280";
                        e.target.style.transform = "scale(1)";
                    }}
                >
                    <X size={isMobile ? 16 : 18} strokeWidth={2} />
                </button>
            </div>

            {/* Panel Content */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: isMobile ? "12px 16px" : "16px 20px",
                WebkitOverflowScrolling: "touch",
            }}>
                {trafficLoading ? (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        minHeight: "200px",
                        gap: "12px",
                    }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            border: "3px solid #e5e7eb",
                            borderTop: "3px solid #3b82f6",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                        }} />
                        <p style={{ fontSize: "13px", color: "#6b7280" }}>Loading traffic data...</p>
                    </div>
                ) : trafficError ? (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        minHeight: "200px",
                        gap: "8px",
                    }}>
                        <AlertTriangle size={32} color="#ef4444" />
                        <p style={{ fontSize: "13px", color: "#ef4444", fontWeight: "500" }}>Failed to load traffic data</p>
                        <p style={{ fontSize: "11px", color: "#6b7280" }}>{trafficError}</p>
                    </div>
                ) : !trafficData ? (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        minHeight: "200px",
                        gap: "8px",
                    }}>
                        <Activity size={32} color="#d1d5db" />
                        <p style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>No traffic data available</p>
                    </div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div style={{ marginBottom: "8px", marginTop: "-10px" }}>
                            <div style={{
                                fontSize: isMobile ? "13px" : "14px",
                                fontWeight: "600",
                                color: "#1f2937",
                                marginBottom: "8px",
                            }}>
                                Traffic Summary
                            </div>

                            <div style={{
                                display: "grid",
                                gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr",
                                gap: "8px",
                            }}>
                                <div style={{
                                    background: "#f9fafb",
                                    borderRadius: "8px",
                                    padding: isMobile ? "10px" : "12px",
                                }}>
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: isMobile ? "10px" : "11px",
                                        color: "#6b7280"
                                    }}>
                                        <span>Total Points</span>
                                        <span style={{
                                            fontWeight: "600",
                                            color: "#1f2937"
                                        }}>
                                            {trafficData?.summary?.total_data_points || 0}
                                        </span>
                                    </div>
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: isMobile ? "10px" : "11px",
                                        color: "#6b7280",
                                        marginTop: "4px"
                                    }}>
                                        <span>Traffic Events</span>
                                        <span style={{
                                            fontWeight: "600",
                                            color: trafficData?.summary?.total_traffic_events > 0
                                                ? "#ef4444"
                                                : "#22c55e"
                                        }}>
                                            {trafficData?.summary?.total_traffic_events || 0}
                                        </span>
                                    </div>
                                </div>

                                <div style={{
                                    background: "#f9fafb",
                                    borderRadius: "8px",
                                    padding: isMobile ? "10px" : "12px",
                                }}>
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: isMobile ? "10px" : "11px",
                                        color: "#6b7280"
                                    }}>
                                        <span>Worst Direction</span>
                                        <span style={{
                                            fontWeight: "600",
                                            color: trafficData?.summary?.worst_direction === "none"
                                                ? "#22c55e"
                                                : "#ef4444"
                                        }}>
                                            {trafficData?.summary?.worst_direction || "none"}
                                        </span>
                                    </div>
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: isMobile ? "10px" : "11px",
                                        color: "#6b7280",
                                        marginTop: "4px"
                                    }}>
                                        <span>Best Direction</span>
                                        <span style={{
                                            fontWeight: "600",
                                            color: "#22c55e"
                                        }}>
                                            {trafficData?.summary?.best_direction || "none"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TRAFFIC CHART */}
                        {fullChartData.length > 0 && (
                            <div style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                                padding: isMobile ? "10px" : "12px",
                                marginBottom: "12px",
                                background: "#fafafa"
                            }}>
                                {/* Header row */}
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "8px",
                                    flexWrap: "wrap",
                                    gap: "4px",
                                }}>
                                    <span style={{
                                        fontSize: isMobile ? "11px" : "12px",
                                        fontWeight: "600",
                                        color: "#374151"
                                    }}>
                                        Traffic Chart
                                        {zoomDomain ? " (Zoomed)" : ` (${dynamicIntervals.find(i => i.key === selectedInterval)?.label || 'Selected Range'})`}
                                        {dynamicIntervals.find(i => i.key === selectedInterval)?.isCurrent && (
                                            <span style={{
                                                fontSize: isMobile ? "8px" : "10px",
                                                fontWeight: "400",
                                                color: '#22c55e',
                                                marginLeft: '6px'
                                            }}>
                                                Current
                                            </span>
                                        )}
                                    </span>
                                </div>

                                {/* Interval tabs */}
                                <div style={{
                                    display: 'flex',
                                    gap: isMobile ? "4px" : "6px",
                                    marginBottom: "10px",
                                    flexWrap: 'wrap'
                                }}>
                                    {dynamicIntervals.map(interval => (
                                        <button
                                            key={interval.key}
                                            onClick={() => { setSelectedInterval(interval.key); setZoomDomain(null); }}
                                            style={{
                                                fontSize: isMobile ? "8px" : "10px",
                                                padding: isMobile ? "2px 6px" : "3px 8px",
                                                borderRadius: "6px",
                                                cursor: "pointer",
                                                border: selectedInterval === interval.key ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                                                background: selectedInterval === interval.key ? '#eff6ff' : 'white',
                                                color: selectedInterval === interval.key ? '#1d4ed8' : '#6b7280',
                                                fontWeight: selectedInterval === interval.key ? '600' : '500',
                                                position: 'relative',
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {interval.label}
                                        </button>
                                    ))}
                                    {zoomDomain && (
                                        <button onClick={resetZoom} style={{
                                            fontSize: isMobile ? "8px" : "10px",
                                            padding: isMobile ? "2px 6px" : "3px 8px",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            border: '1px solid #ef4444',
                                            background: '#fef2f2',
                                            color: '#dc2626',
                                            fontWeight: '600',
                                            whiteSpace: "nowrap",
                                        }}>
                                            Reset Zoom
                                        </button>
                                    )}
                                </div>

                                <div style={{
                                    height: isMobile ? "120px" : "180px",
                                    width: "100%"
                                }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart
                                            data={displayedChartData}
                                            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                                            onMouseDown={handleMouseDown}
                                            onMouseMove={handleMouseMove}
                                            onMouseUp={handleMouseUp}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="time"
                                                tick={{ fontSize: isMobile ? 6 : 8, fill: '#181b21' }}
                                                tickFormatter={(value) => {
                                                    const date = new Date(value);
                                                    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                                                }}
                                                interval="preserveStart"
                                            />
                                            <YAxis
                                                tick={{ fontSize: isMobile ? 6 : 8, fill: '#181b21' }}
                                                domain={[0.5, 1.5]}
                                                ticks={[0.5, 0.75, 1.0, 1.25, 1.5]}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: isMobile ? '8px' : '10px' }} />
                                            <ReferenceLine y={1} stroke="#9ca3af" strokeDasharray="3 3" />
                                            <Line
                                                type="monotone"
                                                dataKey="up_ratio"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                dot={(props) => {
                                                    const { cx, cy, payload } = props;
                                                    if (payload?.up_has_traffic) {
                                                        return <circle cx={cx} cy={cy} r={isMobile ? 4 : 5} fill="#ef4444" stroke="#fff" strokeWidth={1} />;
                                                    }
                                                    return <circle cx={cx} cy={cy} r={isMobile ? 2 : 2} fill="#3b82f6" />;
                                                }}
                                                name="Up"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="down_ratio"
                                                stroke="#ef4444"
                                                strokeWidth={2}
                                                dot={(props) => {
                                                    const { cx, cy, payload } = props;
                                                    if (payload?.down_has_traffic) {
                                                        return <circle cx={cx} cy={cy} r={isMobile ? 4 : 5} fill="#ef4444" stroke="#fff" strokeWidth={1} />;
                                                    }
                                                    return <circle cx={cx} cy={cy} r={isMobile ? 2 : 2} fill="#ef4444" />;
                                                }}
                                                name="Down"
                                            />
                                            {refAreaLeft && refAreaRight && (
                                                <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.15} />
                                            )}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                <div style={{
                                    fontSize: isMobile ? "9px" : "11px",
                                    color: "#181b21",
                                    textAlign: "center",
                                    marginTop: "4px"
                                }}>
                                    {zoomDomain
                                        ? "Drag again to zoom further • Click Reset Zoom to go back"
                                        : "Drag on chart to zoom in • Red spikes = Traffic detected | Line at 1.0 = Normal travel time"}
                                </div>
                            </div>
                        )}

                        {/* Direction Stats */}
                        {trafficData?.direction_data && (
                            <>
                                {/* Up Direction */}
                                <div style={{
                                    border: "1px solid #bfdbfe",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    marginBottom: "12px",
                                }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: isMobile ? "8px 12px" : "10px 14px",
                                        background: "#eff6ff",
                                        flexWrap: "wrap",
                                        gap: "4px",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <ArrowUp size={isMobile ? 14 : 16} color="#2563eb" />
                                            <span style={{
                                                fontSize: isMobile ? "11px" : "12px",
                                                fontWeight: "600",
                                                color: "#1d4ed8"
                                            }}>
                                                Up Direction
                                            </span>
                                        </div>
                                        <span style={{
                                            fontSize: isMobile ? "10px" : "11px",
                                            fontWeight: "500",
                                            padding: "2px 10px",
                                            borderRadius: "999px",
                                            background: trafficData?.direction_data?.up?.avg_traffic_ratio > 1 ? "#fee2e2" : "#dcfce7",
                                            color: trafficData?.direction_data?.up?.avg_traffic_ratio > 1 ? "#dc2626" : "#16a34a",
                                        }}>
                                            {trafficData?.direction_data?.up?.avg_traffic_ratio > 1 ? '🔴 Traffic' : '✅ Clear'}
                                        </span>
                                    </div>
                                    <div style={{
                                        padding: isMobile ? "10px 12px" : "12px 14px",
                                        display: "grid",
                                        gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr",
                                        gap: "6px"
                                    }}>
                                        <div>
                                            <p style={{ fontSize: isMobile ? "9px" : "10px", color: "#6b7280" }}>Avg Duration</p>
                                            <p style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: "600", color: "#1f2937" }}>
                                                {trafficData?.direction_data?.up?.avg_duration || 0}s
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: isMobile ? "9px" : "10px", color: "#6b7280" }}>Static Duration</p>
                                            <p style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: "600", color: "#1f2937" }}>
                                                {trafficData?.direction_data?.up?.static_duration || 0}s
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: isMobile ? "9px" : "10px", color: "#6b7280" }}>Traffic Ratio</p>
                                            <p style={{
                                                fontSize: isMobile ? "12px" : "13px",
                                                fontWeight: "600",
                                                color: trafficData?.direction_data?.up?.avg_traffic_ratio > 1 ? "#dc2626" : "#16a34a"
                                            }}>
                                                {trafficData?.direction_data?.up?.avg_traffic_ratio || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: isMobile ? "9px" : "10px", color: "#6b7280" }}>Data Points</p>
                                            <p style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: "600", color: "#1f2937" }}>
                                                {trafficData?.direction_data?.up?.count || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Down Direction */}
                                <div style={{
                                    border: "1px solid #fca5a5",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: isMobile ? "8px 12px" : "10px 14px",
                                        background: "#fef2f2",
                                        flexWrap: "wrap",
                                        gap: "4px",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <ArrowDown size={isMobile ? 14 : 16} color="#dc2626" />
                                            <span style={{
                                                fontSize: isMobile ? "11px" : "12px",
                                                fontWeight: "600",
                                                color: "#b91c1c"
                                            }}>
                                                Down Direction
                                            </span>
                                        </div>
                                        <span style={{
                                            fontSize: isMobile ? "10px" : "11px",
                                            fontWeight: "500",
                                            padding: "2px 10px",
                                            borderRadius: "999px",
                                            background: trafficData?.direction_data?.down?.avg_traffic_ratio > 1 ? "#fee2e2" : "#dcfce7",
                                            color: trafficData?.direction_data?.down?.avg_traffic_ratio > 1 ? "#dc2626" : "#16a34a",
                                        }}>
                                            {trafficData?.direction_data?.down?.avg_traffic_ratio > 1 ? '🔴 Traffic' : '✅ Clear'}
                                        </span>
                                    </div>
                                    <div style={{
                                        padding: isMobile ? "10px 12px" : "12px 14px",
                                        display: "grid",
                                        gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr",
                                        gap: "6px"
                                    }}>
                                        <div>
                                            <p style={{ fontSize: isMobile ? "9px" : "10px", color: "#6b7280" }}>Avg Duration</p>
                                            <p style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: "600", color: "#1f2937" }}>
                                                {trafficData?.direction_data?.down?.avg_duration || 0}s
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: isMobile ? "9px" : "10px", color: "#6b7280" }}>Static Duration</p>
                                            <p style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: "600", color: "#1f2937" }}>
                                                {trafficData?.direction_data?.down?.static_duration || 0}s
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: isMobile ? "9px" : "10px", color: "#6b7280" }}>Traffic Ratio</p>
                                            <p style={{
                                                fontSize: isMobile ? "12px" : "13px",
                                                fontWeight: "600",
                                                color: trafficData?.direction_data?.down?.avg_traffic_ratio > 1 ? "#dc2626" : "#16a34a"
                                            }}>
                                                {trafficData?.direction_data?.down?.avg_traffic_ratio || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: isMobile ? "9px" : "10px", color: "#6b7280" }}>Data Points</p>
                                            <p style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: "600", color: "#1f2937" }}>
                                                {trafficData?.direction_data?.down?.count || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}