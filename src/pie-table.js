import {anchorOfGeometry} from './anchor.js';
import {lngLatToMercator} from './mercator.js';

export const MAX_SLICES = 8;
// mercator.xy, radius in CSS pixels, then MAX_SLICES cumulative shares.
export const INSTANCE_FLOATS = 2 + 1 + MAX_SLICES;

export function buildPieTable(features, options) {
    const instances = new Float32Array(features.length * INSTANCE_FLOATS);
    let count = 0;

    for (const feature of features) {
        if (!feature?.geometry) continue;
        const anchor = anchorOfGeometry(feature.geometry);
        if (!anchor) continue;
        const values = sliceValues(options.slices, (name) => feature.properties?.[name]);
        if (!values) continue;
        writeInstance(instances, count, anchor[0], anchor[1], radiusForSum(values.sum, options.radius), values.shares);
        count += 1;
    }

    return finishTable(instances, count, options.slices.length);
}

export function buildPieTableFromColumns(geometry, valueColumns, options) {
    const rowCount = geometry.length;
    const instances = new Float32Array(rowCount * INSTANCE_FLOATS);
    let count = 0;

    for (let row = 0; row < rowCount; row++) {
        const anchor = anchorOfGeometry(geometry[row]);
        if (!anchor) continue;
        const values = sliceValues(options.slices, (name, index) => valueColumns[index][row]);
        if (!values) continue;
        writeInstance(instances, count, anchor[0], anchor[1], radiusForSum(values.sum, options.radius), values.shares);
        count += 1;
    }

    return finishTable(instances, count, options.slices.length);
}

function sliceValues(names, read) {
    const shares = new Array(names.length);
    let sum = 0;
    for (let i = 0; i < names.length; i++) {
        const raw = Number(read(names[i], i));
        const value = Number.isFinite(raw) && raw > 0 ? raw : 0;
        shares[i] = value;
        sum += value;
    }
    if (sum <= 0) return null;
    return {shares, sum};
}

function radiusForSum(sum, radius) {
    if (typeof radius === 'number') return radius;
    for (const [total, size] of radius.steps) {
        if (sum <= total) return size;
    }
    return radius.fallback;
}

function writeInstance(instances, index, lng, lat, radius, values) {
    const cursor = index * INSTANCE_FLOATS;
    const [x, y] = lngLatToMercator(lng, lat);
    instances[cursor] = x;
    instances[cursor + 1] = y;
    instances[cursor + 2] = radius;

    let sum = 0;
    for (const value of values) sum += value;
    let cumulative = 0;
    for (let i = 0; i < values.length; i++) {
        cumulative += values[i] / sum;
        instances[cursor + 3 + i] = cumulative;
    }
    instances[cursor + 3 + values.length - 1] = 1;
}

// featuresCount is zero when a writer leaves it unset, so the buffer grows
// as rows are accepted.
export function createPieAccumulator(options, capacity = 0) {
    const sliceCount = options.slices.length;
    let size = capacity > 0 ? capacity : 256;
    let instances = new Float32Array(size * INSTANCE_FLOATS);
    let count = 0;

    return {
        push(lng, lat, rawValues) {
            const values = sliceValues(options.slices, (_name, index) => rawValues[index]);
            if (!values) return;
            if (count === size) {
                size *= 2;
                const grown = new Float32Array(size * INSTANCE_FLOATS);
                grown.set(instances.subarray(0, count * INSTANCE_FLOATS));
                instances = grown;
            }
            writeInstance(instances, count, lng, lat, radiusForSum(values.sum, options.radius), values.shares);
            count += 1;
        },
        finish() {
            return finishTable(instances, count, sliceCount);
        },
    };
}

function finishTable(instances, count, sliceCount) {
    return {
        count,
        sliceCount,
        instances: instances.subarray(0, count * INSTANCE_FLOATS),
    };
}
