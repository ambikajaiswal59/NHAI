import L from 'leaflet';

/**
 * IDW interpolation matching ol-ext behavior with 'count' weight
 * Uses ALL points with distance weighting (no search radius limitation)
 */
function idwInterpolate(points, targetX, targetY, power = 2) {
    let numerator = 0;
    let denominator = 0;

    for (const point of points) {
        const dx = targetX - point.x;
        const dy = targetY - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

        // Standard IDW weight (like ol-ext)
        const weight = 1 / Math.pow(dist, power);

        // Multiply by 'count' value for additional weighting
        const countWeight = point.count || 1;

        numerator += weight * point.value * countWeight;
        denominator += weight * countWeight;
    }

    return numerator / denominator;
}

/**
 * VIBRANT color gradient for IDW
 */
function getColor(value) {
    const v = Math.max(0, Math.min(1, value));

    // 10-stop vibrant gradient
    const stops = [
        { pos: 0.00, r: 10, g: 20, b: 80 },      // Deep Navy
        { pos: 0.10, r: 20, g: 50, b: 130 },     // Dark Blue
        { pos: 0.25, r: 30, g: 90, b: 190 },     // Blue
        { pos: 0.40, r: 60, g: 160, b: 220 },    // Light Blue
        { pos: 0.50, r: 80, g: 200, b: 220 },    // Cyan
        { pos: 0.60, r: 120, g: 220, b: 140 },   // Light Green
        { pos: 0.70, r: 200, g: 230, b: 60 },    // Yellow-Green
        { pos: 0.80, r: 255, g: 210, b: 40 },    // Yellow
        { pos: 0.90, r: 255, g: 150, b: 20 },    // Orange
        { pos: 1.00, r: 220, g: 20, b: 20 },     // Red
    ];

    let i = 0;
    while (i < stops.length - 1 && stops[i + 1].pos < v) i++;

    if (i >= stops.length - 1) {
        const last = stops[stops.length - 1];
        return [last.r, last.g, last.b];
    }

    const from = stops[i];
    const to = stops[i + 1];
    const t = (v - from.pos) / (to.pos - from.pos);
    const smooth = t * t * (3 - 2 * t);

    return [
        Math.round(from.r + (to.r - from.r) * smooth),
        Math.round(from.g + (to.g - from.g) * smooth),
        Math.round(from.b + (to.b - from.b) * smooth)
    ];
}

// Yield to the browser every N rows so a cache-miss render never blocks
// the main thread for one long stretch. This is what removes the
// "freeze then snap" feeling on the first render of a given month.
const ROWS_PER_CHUNK = 40;

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Main IDW Renderer - For Monthly Aggregated Data
 * Handles data with fields: rain_precip, avg_temp, wind
 */
export async function renderIDWToCanvas(data, property, bounds, width, height) {
    if (!data || data.length === 0) {
        throw new Error('No data provided');
    }

    console.time('IDW Render');
    console.log(`🎨 Starting IDW: ${width}x${height}, ${data.length} stations`);
    console.log(`📊 Property: ${property}`);

    // First pass: calculate min/max for the selected property
    let minVal = Infinity;
    let maxVal = -Infinity;
    let validDataCount = 0;

    data.forEach(item => {
        const value = parseFloat(item[property]);
        if (!Number.isNaN(value) && value !== null && value !== undefined) {
            if (value < minVal) minVal = value;
            if (value > maxVal) maxVal = value;
            validDataCount++;
        }
    });

    if (validDataCount === 0) {
        throw new Error('No valid data points found');
    }

    const range = maxVal - minVal || 1;
    console.log(`📊 Data Range: ${minVal.toFixed(2)} to ${maxVal.toFixed(2)} (${validDataCount} valid points)`);

    // Second pass: create points with optimized weighting for monthly data
    const points = data
        .map(item => {
            const value = parseFloat(item[property]);
            if (Number.isNaN(value) || value === null || value === undefined) return null;

            // Convert lat/lng to Web Mercator projection
            const coord = L.CRS.EPSG3857.project(
                L.latLng(item.latitude, item.longitude)
            );

            // Calculate count weight (0-100) based on value range
            const normalized = (value - minVal) / range;
            const count = Math.max(1, Math.round(normalized * 100));

            return {
                x: coord.x,
                y: coord.y,
                value: value,
                count: count,
                lat: item.latitude,
                lng: item.longitude
            };
        })
        .filter(Boolean);

    if (points.length < 3) {
        throw new Error(`Not enough valid points: ${points.length} (need at least 3)`);
    }

    console.log(`📍 Using ${points.length} points for interpolation`);

    // Get map bounds in projected coordinates
    const sw = L.CRS.EPSG3857.project(L.latLng(bounds.minLat, bounds.minLng));
    const ne = L.CRS.EPSG3857.project(L.latLng(bounds.maxLat, bounds.maxLng));

    const minX = sw.x;
    const maxX = ne.x;
    const minY = sw.y;
    const maxY = ne.y;

    console.log(`📍 Map size: ${((maxX - minX) / 1000).toFixed(0)}km x ${((maxY - minY) / 1000).toFixed(0)}km`);

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const power = 2.0; // Standard IDW power
    const imageData = ctx.createImageData(width, height);
    const dataArray = imageData.data;

    const scaleX = (maxX - minX) / width;
    const scaleY = (maxY - minY) / height;

    let pixelsRendered = 0;

    // Render each pixel, yielding to the browser periodically so this
    // never shows up as a single long blocking task.
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const x = minX + px * scaleX;
            const y = minY + py * scaleY;

            if (x < minX || x > maxX || y < minY || y > maxY) {
                continue;
            }

            const value = idwInterpolate(points, x, y, power);
            const normalized = Math.max(0, Math.min(1, (value - minVal) / range));
            const [r, g, b] = getColor(normalized);

            const idx = (py * width + px) * 4;
            if (idx < dataArray.length) {
                dataArray[idx] = r;
                dataArray[idx + 1] = g;
                dataArray[idx + 2] = b;
                dataArray[idx + 3] = 255; // FULL OPAQUE
            }
            pixelsRendered++;
        }

        if (py % ROWS_PER_CHUNK === 0) {
            await nextFrame();
        }
    }

    ctx.putImageData(imageData, 0, 0);

    console.log(`✅ Rendered ${pixelsRendered} pixels`);
    console.timeEnd('IDW Render');
    return canvas;
}

export { getColor };