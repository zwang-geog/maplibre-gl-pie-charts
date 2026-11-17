import {anchorOfGeometry} from './anchor.js';
import {lngLatToMercator} from './mercator.js';

export const MAX_SLICES = 8;
// Radius sizes the shader can look up: every step plus the fallback.
export const MAX_RADIUS_SIZES = 16;
// mercator.xy, radius step index, then MAX_SLICES cumulative shares. The
// index selects a size from the layer's step sizes; a uniform radius is
// index 0, and a sum above every step total is the fallback index.
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
        writeInstance(instances, count, anchor[0], anchor[1], stepForSum(values.sum, options.radius), values.shares);
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
        writeInstance(instances, count, anchor[0], anchor[1], stepForSum(values.sum, options.radius), values.shares);
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

function stepForSum(sum, radius) {
    if (typeof radius === 'number') return 0;
    const {steps} = radius;
    for (let i = 0; i < steps.length; i++) {
        if (sum <= steps[i][0]) return i;
    }
    return steps.length;
}

function writeInstance(instances, index, lng, lat, step, values) {
    const cursor = index * INSTANCE_FLOATS;
    const [x, y] = lngLatToMercator(lng, lat);
    instances[cursor] = x;
    instances[cursor + 1] = y;
    instances[cursor + 2] = step;

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
            writeInstance(instances, count, lng, lat, stepForSum(values.sum, options.radius), values.shares);
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
