// src/components/map/IDWLegend.jsx
import React from 'react';

// The 10-stop gradient from idwRenderer.js
const STOPS = [
    { pos: 0.00, r: 10, g: 20, b: 80 },
    { pos: 0.10, r: 20, g: 50, b: 130 },
    { pos: 0.25, r: 30, g: 90, b: 190 },
    { pos: 0.40, r: 60, g: 160, b: 220 },
    { pos: 0.50, r: 80, g: 200, b: 220 },
    { pos: 0.60, r: 120, g: 220, b: 140 },
    { pos: 0.70, r: 200, g: 230, b: 60 },
    { pos: 0.80, r: 255, g: 210, b: 40 },
    { pos: 0.90, r: 255, g: 150, b: 20 },
    { pos: 1.00, r: 220, g: 20, b: 20 },
];

function getColorAtPos(pos) {
    const v = Math.max(0, Math.min(1, pos));
    let i = 0;
    while (i < STOPS.length - 1 && STOPS[i + 1].pos < v) i++;

    if (i >= STOPS.length - 1) {
        const last = STOPS[STOPS.length - 1];
        return `rgb(${last.r}, ${last.g}, ${last.b})`;
    }

    const from = STOPS[i];
    const to = STOPS[i + 1];
    const t = (v - from.pos) / (to.pos - from.pos);
    const smooth = t * t * (3 - 2 * t);

    return `rgb(${Math.round(from.r + (to.r - from.r) * smooth)}, ${Math.round(from.g + (to.g - from.g) * smooth)}, ${Math.round(from.b + (to.b - from.b) * smooth)})`;
}

function formatValue(value, property) {
    const unit = property === 'avg_temp' ? '°C' :
        property === 'rain_precip' ? 'mm' :
            property === 'wind' ? 'km/h' : '';
    return `${value.toFixed(1)}${unit}`;
}

const IDWLegend = ({ data, property }) => {
    let minVal = Infinity, maxVal = -Infinity;
    data.forEach(item => {
        const value = parseFloat(item[property]);
        if (!Number.isNaN(value)) {
            if (value < minVal) minVal = value;
            if (value > maxVal) maxVal = value;
        }
    });

    const range = maxVal - minVal || 1;

    const getValueAtPercent = (percent) => {
        const normalized = percent / 100;
        return minVal + normalized * range;
    };

    return (
        <div className="absolute bottom-3 right-3 z-[500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-1.5 py-1.5 min-w-[60px]">
            <div className="flex items-start gap-1">
                {/* Gradient bar - reduced width */}
                <div className="relative w-2 h-28 rounded-md overflow-hidden flex-shrink-0">
                    <div
                        className="w-full h-full"
                        style={{
                            background: `linear-gradient(to bottom, 
                                ${getColorAtPos(1)}, 
                                ${getColorAtPos(0.9)}, 
                                ${getColorAtPos(0.8)}, 
                                ${getColorAtPos(0.7)}, 
                                ${getColorAtPos(0.6)}, 
                                ${getColorAtPos(0.5)}, 
                                ${getColorAtPos(0.4)}, 
                                ${getColorAtPos(0.25)}, 
                                ${getColorAtPos(0.1)}, 
                                ${getColorAtPos(0)})`
                        }}
                    />
                </div>

                {/* Value labels - reduced gap */}
                <div className="flex flex-col justify-between h-28 py-0.5">
                    <span className="text-[8px] font-medium text-gray-900 leading-none whitespace-nowrap">
                        {formatValue(getValueAtPercent(100), property)}
                    </span>
                    <span className="text-[8px] font-medium text-gray-900 leading-none whitespace-nowrap">
                        {formatValue(getValueAtPercent(75), property)}
                    </span>
                    <span className="text-[8px] font-medium text-gray-900 leading-none whitespace-nowrap">
                        {formatValue(getValueAtPercent(50), property)}
                    </span>
                    <span className="text-[8px] font-medium text-gray-900 leading-none whitespace-nowrap">
                        {formatValue(getValueAtPercent(25), property)}
                    </span>
                    <span className="text-[8px] font-medium text-gray-900 leading-none whitespace-nowrap">
                        {formatValue(getValueAtPercent(0), property)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default IDWLegend;