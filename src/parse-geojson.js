export function featuresFromGeoJSON(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('GeoJSON data must be an object');
    }
    if (data.type === 'FeatureCollection') {
        if (!Array.isArray(data.features)) {
            throw new Error('FeatureCollection is missing features');
        }
        return data.features;
    }
    if (data.type === 'Feature') return [data];
    if (data.type && data.coordinates) {
        return [{type: 'Feature', geometry: data, properties: {}}];
    }
    throw new Error(`Unsupported GeoJSON type "${data.type}"`);
}
