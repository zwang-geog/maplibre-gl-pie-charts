// One longitude/latitude per feature. A polygon uses the shoelace centroid of
// its outer ring. A multipolygon uses the outer ring of its first polygon.
// That centroid can fall outside a strongly concave ring; a point-in-polygon
// anchor can replace this later.

export function anchorOfGeometry(geometry) {
    if (!geometry) return null;
    switch (geometry.type) {
        case 'Point':
            return pair(geometry.coordinates);
        case 'MultiPoint':
        case 'LineString':
            return average(geometry.coordinates);
        case 'MultiLineString':
            return average(geometry.coordinates[0]);
        case 'Polygon':
            return ringCentroid(geometry.coordinates[0]);
        case 'MultiPolygon':
            return ringCentroid(geometry.coordinates[0]?.[0]);
        default:
            return null;
    }
}

function pair(coordinates) {
    if (!coordinates || coordinates.length < 2) return null;
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat];
}

function average(coordinates) {
    if (!coordinates || coordinates.length === 0) return null;
    const first = pair(coordinates[0]);
    if (coordinates.length === 1) return first;
    const second = pair(coordinates[1]);
    if (first && second) return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
    return first || second;
}

function ringCentroid(ring) {
    const stats = ringStats(ring);
    return stats ? [stats.lng, stats.lat] : null;
}

function ringStats(ring) {
    if (!ring || ring.length === 0) return null;
    let count = ring.length;
    const first = ring[0];
    const last = ring[count - 1];
    if (count > 1 && first[0] === last[0] && first[1] === last[1]) count -= 1;
    if (count === 1) return {lng: first[0], lat: first[1]};
    if (count < 3) return {lng: ring[0][0], lat: ring[0][1]};

    let twiceArea = 0;
    let lngMoment = 0;
    let latMoment = 0;
    for (let i = 0; i < count; i++) {
        const j = (i + 1) % count;
        const cross = ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
        twiceArea += cross;
        lngMoment += (ring[i][0] + ring[j][0]) * cross;
        latMoment += (ring[i][1] + ring[j][1]) * cross;
    }
    if (twiceArea === 0) return {lng: ring[0][0], lat: ring[0][1]};
    return {
        lng: lngMoment / (3 * twiceArea),
        lat: latMoment / (3 * twiceArea),
    };
}
