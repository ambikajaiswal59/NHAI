// src/components/MovementDiffChart.jsx
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { X, GripVertical, Calendar, ArrowRight } from "lucide-react";
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

// Solve a system of linear equations (Gaussian elimination with partial pivoting)
function solveLinearSystem(A, b) {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
        }
        [M[col], M[maxRow]] = [M[maxRow], M[col]];

        const pivot = M[col][col];
        if (Math.abs(pivot) < 1e-12) continue;

        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = M[row][col] / pivot;
            for (let c = col; c <= n; c++) {
                M[row][c] -= factor * M[col][c];
            }
        }
    }

    return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

// Fit a polynomial of given degree to (x, y) points using least squares
function fitPolynomialTrend(xs, ys, degree) {
    const n = xs.length;
    const numCoeffs = degree + 1;

    const XtX = Array.from({ length: numCoeffs }, () => new Array(numCoeffs).fill(0));
    const Xty = new Array(numCoeffs).fill(0);

    for (let i = 0; i < n; i++) {
        const powers = [];
        let p = 1;
        for (let k = 0; k < numCoeffs; k++) {
            powers.push(p);
            p *= xs[i];
        }
        for (let a = 0; a < numCoeffs; a++) {
            Xty[a] += powers[a] * ys[i];
            for (let bIdx = 0; bIdx < numCoeffs; bIdx++) {
                XtX[a][bIdx] += powers[a] * powers[bIdx];
            }
        }
    }

    const coeffs = solveLinearSystem(XtX, Xty);
    return (x) => coeffs.reduce((sum, c, k) => sum + c * Math.pow(x, k), 0);
}

export default function MovementDiffChart({
    pointData,
    detailData,
    startDate,
    endDate,
    onClose
}) {
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

            if (containerRect.width > 0 && containerRect.height > 0) {
                setPosition({
                    x: (containerRect.width - chartWidth) / 2,
                    y: (containerRect.height - chartHeight) / 2
                });
                setIsPositioned(true);
            } else {
                setTimeout(centerChart, 100);
            }
        };

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

        const container = chartRef.current?.parentElement;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();

        let newX = e.clientX - containerRect.left - dragOffset.x;
        let newY = e.clientY - containerRect.top - dragOffset.y;

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

    // Filter timeseries between start and end dates
    const filteredTimeseries = useMemo(() => {
        if (!startDate || !endDate) return timeseries;

        return timeseries.filter(item => {
            return item.date >= startDate && item.date <= endDate;
        });
    }, [timeseries, startDate, endDate]);

    // Compute chart data with trend
    const chartData = useMemo(() => {
        const n = filteredTimeseries.length;
        if (n === 0) return [];

        const xs = filteredTimeseries.map((_, i) => i / Math.max(1, n - 1));
        const ys = filteredTimeseries.map(d => d.displacement);

        const degree = Math.min(3, Math.max(1, n - 1));
        const predict = fitPolynomialTrend(xs, ys, degree);

        return filteredTimeseries.map((d, i) => ({ ...d, trend: predict(xs[i]) }));
    }, [filteredTimeseries]);

    // Calculate displacement difference
    const displacementDiff = useMemo(() => {
        if (filteredTimeseries.length < 2) return null;

        const first = filteredTimeseries[0];
        const last = filteredTimeseries[filteredTimeseries.length - 1];

        return {
            startDate: first.date,
            endDate: last.date,
            startDisplacement: first.displacement,
            endDisplacement: last.displacement,
            difference: last.displacement - first.displacement,
            percentChange: ((last.displacement - first.displacement) / Math.abs(first.displacement || 1)) * 100
        };
    }, [filteredTimeseries]);

    // Format date for display
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
    };

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
                            <h4 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                                Movement Difference
                            </h4>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Checkboxes */}
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

                    {/* Row 2: Point Info - Single Line */}
                    <div className="flex items-center gap-2 sm:gap-4 mt-1 text-[10px] sm:text-xs text-gray-500 w-full border-t border-gray-100 pt-1 overflow-x-auto">
                        <span className="whitespace-nowrap">
                            <strong className="text-gray-700">
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

                        {displacementDiff && (
                            <>
                                <span className="whitespace-nowrap">
                                    Change: <strong className={displacementDiff.difference > 0 ? 'text-red-600' : 'text-green-600'}>
                                        {displacementDiff.difference > 0 ? '+' : ''}{displacementDiff.difference.toFixed(2)} mm
                                    </strong>
                                </span>
                                <span className="whitespace-nowrap">
                                    ({displacementDiff.percentChange.toFixed(1)}%)
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Chart */}
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

                            {/* Highlight the date range with a background */}
                            {chartData.length > 0 && (
                                <ReferenceLine
                                    x={chartData[0]?.date}
                                    stroke="#3b82f6"
                                    strokeDasharray="5 5"
                                    strokeWidth={1}
                                    label={{
                                        value: 'Start',
                                        position: 'top',
                                        style: { fontSize: 9, fill: '#3b82f6' }
                                    }}
                                />
                            )}
                            {chartData.length > 1 && (
                                <ReferenceLine
                                    x={chartData[chartData.length - 1]?.date}
                                    stroke="#3b82f6"
                                    strokeDasharray="5 5"
                                    strokeWidth={1}
                                    label={{
                                        value: 'End',
                                        position: 'top',
                                        style: { fontSize: 9, fill: '#3b82f6' }
                                    }}
                                />
                            )}

                            <Line
                                type="monotone"
                                dataKey="displacement"
                                stroke={showLines ? "#3b82f6" : "transparent"}
                                strokeWidth={2}
                                dot={showData ? { r: 3, fill: '#3b82f6' } : false}
                                activeDot={{ r: 6 }}
                                name="Displacement (mm)"
                                isAnimationActive={false}
                            />

                            {showTrend && (
                                <Line
                                    type="monotone"
                                    dataKey="trend"
                                    stroke="#ef4444"
                                    strokeWidth={2}
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