// src/components/MovementPointsChart.jsx
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { X, GripVertical } from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";




// Numerically stable polynomial least-squares fit via QR decomposition
function fitPolynomialTrend(xs, ys, degree) {
    const n = xs.length;
    const numCoeffs = degree + 1;

    // Center and scale x — this alone hugely improves conditioning
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const stdX = Math.sqrt(xs.reduce((a, b) => a + (b - meanX) ** 2, 0) / n) || 1;
    const norm = (x) => (x - meanX) / stdX;

    // Build Vandermonde matrix in normalized x
    const A = xs.map((x) => {
        const xn = norm(x);
        const row = [];
        let p = 1;
        for (let k = 0; k < numCoeffs; k++) { row.push(p); p *= xn; }
        return row;
    });

    // Modified Gram-Schmidt QR decomposition (stable, avoids squaring condition number)
    const Q = A.map((row) => [...row]);
    const R = Array.from({ length: numCoeffs }, () => new Array(numCoeffs).fill(0));

    for (let k = 0; k < numCoeffs; k++) {
        let norm2 = 0;
        for (let i = 0; i < n; i++) norm2 += Q[i][k] * Q[i][k];
        R[k][k] = Math.sqrt(norm2) || 1e-12;
        for (let i = 0; i < n; i++) Q[i][k] /= R[k][k];

        for (let j = k + 1; j < numCoeffs; j++) {
            let dot = 0;
            for (let i = 0; i < n; i++) dot += Q[i][k] * Q[i][j];
            R[k][j] = dot;
            for (let i = 0; i < n; i++) Q[i][j] -= dot * Q[i][k];
        }
    }

    // Qᵀy
    const Qty = new Array(numCoeffs).fill(0);
    for (let k = 0; k < numCoeffs; k++) {
        for (let i = 0; i < n; i++) Qty[k] += Q[i][k] * ys[i];
    }

    // Back-substitution: R * coeffs = Qty
    const coeffs = new Array(numCoeffs).fill(0);
    for (let k = numCoeffs - 1; k >= 0; k--) {
        let sum = Qty[k];
        for (let j = k + 1; j < numCoeffs; j++) sum -= R[k][j] * coeffs[j];
        coeffs[k] = sum / (R[k][k] || 1e-12);
    }

    return (x) => {
        const xn = norm(x);
        let p = 1;
        let sum = 0;
        for (let k = 0; k < numCoeffs; k++) { sum += coeffs[k] * p; p *= xn; }
        return sum;
    };
}



export default function MovementPointsChart({ pointData, detailData, onClose }) {
    const [showData, setShowData] = useState(true);
    const [showLines, setShowLines] = useState(true);
    const [showTrend, setShowTrend] = useState(false);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isPositioned, setIsPositioned] = useState(false);
    const chartRef = useRef(null);

    // Center the chart when it mounts
    useEffect(() => {
        const centerChart = () => {
            if (!chartRef.current) return;

            const container = chartRef.current.parentElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const chartWidth = chartRef.current.offsetWidth || 600;
            const chartHeight = chartRef.current.offsetHeight || 400;

            // Only center if container has valid dimensions
            if (containerRect.width > 0 && containerRect.height > 0) {
                setPosition({
                    x: (containerRect.width - chartWidth) / 2,
                    y: (containerRect.height - chartHeight) / 2
                });
                setIsPositioned(true);
            } else {
                // If container dimensions are 0, try again after a short delay
                setTimeout(centerChart, 100);
            }
        };

        // Small delay to ensure DOM is ready
        const timer = setTimeout(centerChart, 50);
        return () => clearTimeout(timer);
    }, []);

    // Re-center on window resize
    useEffect(() => {
        const handleResize = () => {
            if (!chartRef.current || !isPositioned) return;

            const container = chartRef.current.parentElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const chartWidth = chartRef.current.offsetWidth || 600;
            const chartHeight = chartRef.current.offsetHeight || 400;

            // Keep chart within bounds on resize
            setPosition(prev => ({
                x: Math.max(0, Math.min(containerRect.width - chartWidth, prev.x)),
                y: Math.max(0, Math.min(containerRect.height - chartHeight, prev.y))
            }));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isPositioned]);

    // Handle drag start
    const handleMouseDown = useCallback((e) => {
        // Only drag if clicking on the header area (not on checkboxes or close button)
        const target = e.target;
        if (target.closest('input') || target.closest('button')) {
            return;
        }

        const rect = chartRef.current?.getBoundingClientRect();
        if (!rect) return;

        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setIsDragging(true);
        e.preventDefault();
    }, []);

    // Handle drag move
    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;

        const chartWidth = chartRef.current?.offsetWidth || 600;
        const chartHeight = chartRef.current?.offsetHeight || 400;

        // Get container bounds
        const container = chartRef.current?.parentElement;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();

        // Calculate position relative to container
        let newX = e.clientX - containerRect.left - dragOffset.x;
        let newY = e.clientY - containerRect.top - dragOffset.y;

        // Keep chart within container bounds
        newX = Math.max(0, Math.min(containerRect.width - chartWidth, newX));
        newY = Math.max(0, Math.min(containerRect.height - chartHeight, newY));

        setPosition({ x: newX, y: newY });
        e.preventDefault();
    }, [isDragging, dragOffset]);

    // Handle drag end
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Add/remove event listeners
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (!pointData || !detailData) return null;

    const { id, longitude, latitude, velocity, coherence } = pointData.data;
    const timeseries = detailData?.data?.timeseries || [];

    // Compute a smooth (cubic) trend curve and merge it into the chart data
    // const chartData = useMemo(() => {
    //     const n = timeseries.length;
    //     if (n === 0) return [];

    //     const xs = timeseries.map((_, i) => i / Math.max(1, n - 1));
    //     const ys = timeseries.map(d => d.displacement);

    //     const degree = 5
    //     const predict = fitPolynomialTrend(xs, ys, degree);

    //     console.log(JSON.stringify(timeseries.map(d => ({ date: d.date, displacement: d.displacement }))));

    //     return timeseries.map((d, i) => ({ ...d, trend: predict(xs[i]) }));
    // }, [timeseries]);

    const chartData = useMemo(() => {
        const n = timeseries.length;
        if (n === 0) return [];

        const xs = timeseries.map((_, i) => i / Math.max(1, n - 1));
        const ys = timeseries.map(d => d.displacement);

        const degree = 5;
        const predict = fitPolynomialTrend(xs, ys, degree);

        // Real data points (unchanged)
        const realPoints = timeseries.map((d, i) => ({
            date: d.date,
            displacement: d.displacement,
            trend: predict(xs[i]),
            sortKey: xs[i],
        }));

        // Extra interpolated points, purely for a smooth trend curve
        const SAMPLES_PER_GAP = 6; // increase for even smoother
        const extraPoints = [];
        const minTime = new Date(timeseries[0].date).getTime();
        const maxTime = new Date(timeseries[n - 1].date).getTime();

        for (let i = 0; i < n - 1; i++) {
            for (let s = 1; s < SAMPLES_PER_GAP; s++) {
                const x = xs[i] + (xs[i + 1] - xs[i]) * (s / SAMPLES_PER_GAP);
                const t0 = new Date(timeseries[i].date).getTime();
                const t1 = new Date(timeseries[i + 1].date).getTime();
                const t = t0 + (t1 - t0) * (s / SAMPLES_PER_GAP);
                extraPoints.push({
                    date: new Date(t).toISOString().slice(0, 10),
                    displacement: null,          // no dot/line for these
                    trend: predict(x),
                    sortKey: x,
                });
            }
        }

        return [...realPoints, ...extraPoints].sort((a, b) => a.sortKey - b.sortKey);
    }, [timeseries]);

    const tickInterval = Math.max(0, Math.ceil(chartData.length / 8) - 1);

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-sm text-gray-800">
                        Displacement: <strong>{payload[0].value} mm</strong>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div
            ref={chartRef}
            className="absolute z-[2000] bg-white rounded-xl shadow-2xl border border-gray-200 w-[95%] max-w-2xl max-h-[90%] overflow-y-auto"
            style={{
                top: position.y,
                left: position.x,
                width: 'min(95%, 600px)',
                touchAction: 'none',
                userSelect: 'none',
                cursor: isDragging ? 'grabbing' : 'default',
                opacity: isPositioned ? 1 : 0,
                transition: isPositioned ? 'opacity 0.2s ease' : 'none'
            }}
        >
            <div className="p-3 sm:p-4">
                {/* Header - Drag handle area */}
                <div
                    className="mb-2 sm:mb-3 cursor-grab active:cursor-grabbing"
                    onMouseDown={handleMouseDown}
                    style={{ touchAction: 'none' }}
                >
                    {/* Row 1: Title + Checkboxes + Close */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <GripVertical size={16} className="text-gray-400 flex-shrink-0" />
                            <h4 className="text-base sm:text-lg font-semibold text-gray-800">
                                Movement Analysis
                            </h4>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Checkboxes - Responsive */}
                            <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs font-medium">
                                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={showData}
                                        onChange={() => setShowData(v => !v)}
                                        className="w-3 h-3 sm:w-3.5 sm:h-3.5 accent-blue-500 rounded cursor-pointer"
                                    />
                                    <span className="text-gray-700">Data</span>
                                </label>
                                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={showLines}
                                        onChange={() => setShowLines(v => !v)}
                                        className="w-3 h-3 sm:w-3.5 sm:h-3.5 accent-blue-500 rounded cursor-pointer"
                                    />
                                    <span className="text-gray-700">Lines</span>
                                </label>
                                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={showTrend}
                                        onChange={() => setShowTrend(v => !v)}
                                        className="w-3 h-3 sm:w-3.5 sm:h-3.5 accent-red-500 rounded cursor-pointer"
                                    />
                                    <span className="text-gray-700">Trend</span>
                                </label>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 sm:p-1.5 bg-white hover:bg-red-50 hover:scale-105 rounded-full transition-all duration-200 hover:shadow-md"
                                style={{ pointerEvents: 'auto' }}
                            >
                                <X size={14} className="sm:w-4 sm:h-4 text-gray-500 hover:text-red-500" />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Info - Full width */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-[11px] sm:text-sm text-gray-600 w-full">
                        <span className="whitespace-nowrap">
                            <strong className="text-gray-800 text-[10px] sm:text-sm">
                                {latitude.toFixed(5)}, {longitude.toFixed(5)}
                            </strong>
                        </span>
                        <span className="whitespace-nowrap">
                            Velocity: <strong className={velocity > 0 ? 'text-green-600' : 'text-red-600'}>
                                {velocity} mm/yr
                            </strong>
                        </span>
                        <span className="whitespace-nowrap">
                            Coherence: <strong>{coherence}%</strong>
                        </span>
                    </div>
                </div>

                {/* Chart - Responsive height */}
                <div className="h-40 sm:h-48 md:h-56 lg:h-64 w-full" style={{ pointerEvents: 'auto' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, sm: 12 }}
                                interval={tickInterval}
                                tickFormatter={(date) => {
                                    const d = new Date(date);
                                    return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().slice(-2)}`;
                                }}
                            />
                            <YAxis
                                tick={{ fontSize: 10, sm: 10 }}
                                label={{
                                    value: 'Displacement (mm)',
                                    angle: -90,
                                    position: 'Left',
                                    style: { fontSize: 10, sm: 12, fill: '#666' }
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0} stroke="#ccc" strokeDasharray="3 3" />

                            <Line
                                type="monotone"
                                dataKey="displacement"
                                stroke={showLines ? "#3b82f6" : "transparent"}
                                strokeWidth={1.5}
                                dot={showData ? { r: 2.5, fill: '#3b82f6' } : false}
                                activeDot={{ r: 5 }}
                                name="Displacement (mm)"
                                isAnimationActive={false}
                            />

                            {showTrend && (
                                <Line
                                    type="monotone"
                                    dataKey="trend"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 4"
                                    dot={false}
                                    activeDot={false}
                                    name="Trend"
                                    isAnimationActive={false}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}