// Web Mercator, matching MapLibre's MercatorCoordinate: x and y are in 0..1.
const MAX_LATITUDE = 85.05112877980659;

export function lngLatToMercator(lng, lat) {
    const clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
    const x = (lng + 180) / 360;
    const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))) / 360;
    return [x, y];
}
