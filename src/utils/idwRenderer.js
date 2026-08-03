import L from 'leaflet';

/**
 * Custom IDW interpolation function
 * @param {Array} points - Array of {x, y, value} objects
 * @param {number} targetX - X coordinate to interpolate
 * @param {number} targetY - Y coordinate to interpolate
 * @param {number} power - IDW power parameter (default: 2)
 * @returns {number} Interpolated value
 */
function idwInterpolate(points, targetX, targetY, power = 2) {
    let numerator = 0;
    let denominator = 0;

    for (const point of points) {
        const dx = targetX - point.x;
        const dy = targetY - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const weight = 1 / Math.pow(dist, power);
        numerator += weight * point.value;
        denominator += weight;
    }

    return numerator / denominator;
}

/**
 * Render IDW layer to a canvas
 * @param {Array} data - Weather data points
 * @param {string} property - Property to interpolate (precip_mm, wind_kph, temp_c)
 * @param {Object} bounds - Map bounds {minLat, maxLat, minLng, maxLng}
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Promise<HTMLCanvasElement>} Rendered canvas with IDW layer
 */
export function renderIDWToCanvas(data, property, bounds, width, height) {
    return new Promise((resolve, reject) => {
        if (!data || data.length === 0) {
            reject(new Error('No data provided'));
            return;
        }

        try {
            // Step 1: Convert data points to projected coordinates
            const points = data.map(item => {
                const coord = L.CRS.EPSG3857.project(L.latLng(item.latitude, item.longitude));
                return {
                    x: coord.x,
                    y: coord.y,
                    value: parseFloat(item[property]),
                };
            });

            // Step 2: Get bounds in projected coordinates
            const sw = L.CRS.EPSG3857.project(L.latLng(bounds.minLat, bounds.minLng));
            const ne = L.CRS.EPSG3857.project(L.latLng(bounds.maxLat, bounds.maxLng));

            const minX = sw.x;
            const maxX = ne.x;
            const minY = sw.y;
            const maxY = ne.y;


            // Add padding
            const padX = (maxX - minX) * 0.1;
            const padY = (maxY - minY) * 0.1;

            // Step 3: Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Step 4: Calculate min/max for color scaling
            let min = Infinity;
            let max = -Infinity;
            data.forEach(item => {
                const value = parseFloat(item[property]);
                if (value < min) min = value;
                if (value > max) max = value;
            });
            const range = max - min || 1;

            // Step 5: Render IDW pixel by pixel
            const imageData = ctx.createImageData(width, height);
            const dataArray = imageData.data;
            const power = 2;
            const gridSize = 2; // Smaller = better quality, slower

            // Filter points to those within or near bounds
            const visiblePoints = points.filter(p => {
                return p.x >= minX - padX && p.x <= maxX + padX &&
                    p.y >= minY - padY && p.y <= maxY + padY;
            });

            if (visiblePoints.length < 3) {
                reject(new Error('Not enough visible points for interpolation'));
                return;
            }

            // Interpolate each pixel
            for (let py = 0; py < height; py += gridSize) {
                for (let px = 0; px < width; px += gridSize) {
                    // Map pixel to coordinate space
                    const x = minX - padX + (px / width) * ((maxX - minX) + 2 * padX);
                    const y = minY - padY + (py / height) * ((maxY - minY) + 2 * padY);

                    // Skip if outside bounds
                    if (x < minX || x > maxX || y < minY || y > maxY) {
                        continue;
                    }

                    // Interpolate value using IDW
                    const value = idwInterpolate(visiblePoints, x, y, power);
                    const normalized = Math.max(0, Math.min(1, (value - min) / range));

                    // Get color
                    const [r, g, b] = getColor(normalized);

                    // Fill pixel and neighboring pixels (gridSize)
                    for (let dy = 0; dy < gridSize; dy++) {
                        for (let dx = 0; dx < gridSize; dx++) {
                            const idx = ((py + dy) * width + (px + dx)) * 4;
                            if (idx < dataArray.length) {
                                dataArray[idx] = r;
                                dataArray[idx + 1] = g;
                                dataArray[idx + 2] = b;
                                dataArray[idx + 3] = 200; // Alpha
                            }
                        }
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas);

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get color based on normalized value (0-1)
 * Blue -> Cyan -> Green -> Yellow -> Red
 */
function getColor(value) {
    if (value < 0.2) return [0, 0, 255];      // Blue
    if (value < 0.4) return [0, 255, 255];    // Cyan
    if (value < 0.6) return [0, 255, 0];      // Green
    if (value < 0.8) return [255, 255, 0];    // Yellow
    return [255, 0, 0];                        // Red
}