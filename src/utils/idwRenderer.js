
import L from 'leaflet';

/**
 * IDW interpolation matching ol-ext behavior with 'count' weight
 * Uses ALL points with distance weighting (no search radius limitation)
 * This matches exactly what ol-ext does internally
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

        // IMPORTANT: Multiply by 'count' value (like ol-ext's weight: 'count')
        // In ol-ext, 'count' is the weight factor
        // Your Angular code passes count as the weight
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

/**
 * Main IDW Renderer - Matching Angular/ol-ext behavior
 */
export function renderIDWToCanvas(data, property, bounds, width, height) {
    return new Promise((resolve, reject) => {
        if (!data || data.length === 0) {
            reject(new Error('No data provided'));
            return;
        }

        try {
            console.time('IDW Render');
            console.log(`🎨 Starting IDW: ${width}x${height}, ${data.length} stations`);

            // Convert points to projected coordinates with COUNT
            // count = normalized value (0-100) like in Angular
            let minVal = Infinity;
            let maxVal = -Infinity;

            // First pass: calculate min/max
            data.forEach(item => {
                const value = parseFloat(item[property]);
                if (!Number.isNaN(value)) {
                    if (value < minVal) minVal = value;
                    if (value > maxVal) maxVal = value;
                }
            });
            const range = maxVal - minVal || 1;

            // Second pass: create points with count (like Angular)
            const points = data
                .map(item => {
                    const value = parseFloat(item[property]);
                    if (Number.isNaN(value) || value === null) return null;

                    const coord = L.CRS.EPSG3857.project(
                        L.latLng(item.latitude, item.longitude)
                    );

                    // Calculate count like Angular does
                    // count = percentage of max value (0-100)
                    const normalized = (value - minVal) / range;
                    const count = Math.max(1, Math.round(normalized * 100));

                    return {
                        x: coord.x,
                        y: coord.y,
                        value: value,
                        count: count, // ← This matches Angular's 'count'
                        lat: item.latitude,
                        lng: item.longitude
                    };
                })
                .filter(Boolean);

            if (points.length < 3) {
                reject(new Error(`Not enough points: ${points.length}`));
                return;
            }

            // Get map bounds
            const sw = L.CRS.EPSG3857.project(L.latLng(bounds.minLat, bounds.minLng));
            const ne = L.CRS.EPSG3857.project(L.latLng(bounds.maxLat, bounds.maxLng));

            const minX = sw.x;
            const maxX = ne.x;
            const minY = sw.y;
            const maxY = ne.y;

            // Calculate map dimensions
            const mapWidth = maxX - minX;
            const mapHeight = maxY - minY;

            console.log(`📊 Range: ${minVal.toFixed(2)} to ${maxVal.toFixed(2)}`);
            console.log(`📍 Map size: ${(mapWidth / 1000).toFixed(0)}km x ${(mapHeight / 1000).toFixed(0)}km`);

            // Create canvas with HIGH quality
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Use power=2 like ol-ext default
            const gridSize = 1; // Full resolution
            const power = 2.0; // Standard IDW power (matches ol-ext)

            const imageData = ctx.createImageData(width, height);
            const dataArray = imageData.data;

            const scaleX = (maxX - minX) / width;
            const scaleY = (maxY - minY) / height;

            let pixelsRendered = 0;

            // Render each pixel - using ALL points (no search radius)
            // This matches ol-ext's behavior exactly
            for (let py = 0; py < height; py += gridSize) {
                for (let px = 0; px < width; px += gridSize) {
                    const x = minX + px * scaleX;
                    const y = minY + py * scaleY;

                    // Skip outside bounds
                    if (x < minX || x > maxX || y < minY || y > maxY) {
                        continue;
                    }

                    // Interpolate using ALL points (like ol-ext)
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
            }

            ctx.putImageData(imageData, 0, 0);

            console.log(`✅ Rendered ${pixelsRendered} pixels`);
            console.timeEnd('IDW Render');
            resolve(canvas);

        } catch (error) {
            console.error('❌ IDW Error:', error);
            reject(error);
        }
    });
}

export { getColor };