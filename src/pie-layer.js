import {pieTableFromFlatGeobuf} from './parse-flatgeobuf.js';
import {featuresFromGeoJSON} from './parse-geojson.js';
import {pieTableFromGeoParquet} from './parse-geoparquet.js';
import {buildPieTable, MAX_SLICES} from './pie-table.js';
import {
    bindPieAttributes,
    createPieProgram,
    deletePieProgram,
    uploadInstances,
} from './program.js';

const COLOR_SLOTS = 8;

export class PieChartLayer {
    constructor({
        id,
        url,
        data,
        geometryColumn,
        slices,
        colors,
        radius = 16,
        hole = 0,
        opacity = 1,
        requestInit,
        slot,
        readyForDisplay = true,
    } = {}) {
        if (!id) throw new Error('PieChartLayer needs an id');

        const hasUrl = typeof url === 'string' && url.length > 0;
        const hasData = data != null;
        if (hasUrl === hasData) {
            throw new Error('PieChartLayer needs url or data, and not both');
        }

        const format = hasData ? 'geojson' : formatFromUrl(url);

        if (format === 'geoparquet') {
            geometryColumn = geometryColumn ?? 'geometry';
            if (geometryColumn === '') throw new Error('geometryColumn cannot be set empty for geoparquet sources');
        } else {
            geometryColumn = undefined;
        }

        this.id = id;
        this.type = 'custom';
        this.renderingMode = '2d';
        if (slot !== undefined) {
            this.slot = slot;
        }

        this.url = hasUrl ? url : undefined;
        this.data = hasData ? data : undefined;
        this.format = format;
        this.geometryColumn = geometryColumn;
        this.slices = validateSlices(slices);
        this.colors = validateColors(colors, this.slices.length);
        this.radius = validateRadius(radius);
        this.hole = validateZeroToOneFloat(hole, 'hole');
        this.opacity = validateZeroToOneFloat(opacity, 'opacity');
        this.readyForDisplay = readyForDisplay;
        this.requestInit = requestInit;

        this.map = null;
        this.gl = null;
        this.resources = null;
        this.count = 0;
        this.sliceCount = this.slices.length;
        this.colorBuffer = new Float32Array(COLOR_SLOTS * 4);
        this.colorBuffer.fill(0);
        this.colors.forEach((color, index) => {
            this.colorBuffer.set(parseColor(color), index * 4);
        });
        this.error = null;
        this.loaded = Promise.resolve();
    }

    onAdd(map, gl) {
        this.map = map;
        this.gl = gl;
        const pixelRatio = typeof map.getPixelRatio === 'function' ? map.getPixelRatio() : window.devicePixelRatio;
        this.pixelRatio = pixelRatio || 1;
        const resources = createPieProgram(gl);
        bindPieAttributes(gl, resources);
        this.resources = resources;

        this.loaded = (async () => {
            let table;
            if (this.format === 'geoparquet') {
                table = await pieTableFromGeoParquet(this);
            } else if (this.format === 'flatgeobuf') {
                table = await pieTableFromFlatGeobuf(this);
            } else if (this.data != null) {
                table = buildPieTable(featuresFromGeoJSON(this.data), this);
            } else {
                const response = await fetch(this.url, this.requestInit);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${this.url}: ${response.status}`);
                }
                table = buildPieTable(featuresFromGeoJSON(await response.json()), this);
            }
            if (this.resources !== resources) return null;
            uploadInstances(gl, resources.instances, table.instances);
            this.count = table.count;
            table.instances = null;
            this.error = null;
            map.triggerRepaint();
            return {count: table.count, sliceCount: table.sliceCount};
        })().catch((error) => {
            if (this.resources === resources) this.error = error;
            throw error;
        });
    }

    onRemove(map, gl) {
        this.count = 0;
        deletePieProgram(gl, this.resources);
        this.resources = null;
        this.map = null;
        this.gl = null;
    }

    render(gl, args) {
        if (!this.readyForDisplay || !this.resources || this.count === 0) return;

        // MapLibre 5+ passes an options object. MapLibre 4 and Mapbox pass the mercator matrix.
        const matrix = args?.defaultProjectionData?.mainMatrix
            ?? args?.modelViewProjectionMatrix
            ?? args;
        const {program, uniforms, vao} = this.resources;

        gl.useProgram(program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.CULL_FACE);

        gl.uniformMatrix4fv(uniforms.matrix, false, matrix);
        // One device pixel in clip units. NDC is 2 units across the drawing
        // buffer; y is negative because clip +y is up and canvas +y points down.
        gl.uniform2f(uniforms.pixelScale, 2 / gl.drawingBufferWidth, -2 / gl.drawingBufferHeight);
        // CSS pixels per the ratio captured in onAdd. The drawing buffer is
        // the CSS size times this same ratio.
        gl.uniform1f(uniforms.pixelRatio, this.pixelRatio);
        gl.uniform4fv(uniforms.colors, this.colorBuffer);
        gl.uniform1i(uniforms.sliceCount, this.sliceCount);
        gl.uniform1f(uniforms.hole, this.hole);
        gl.uniform1f(uniforms.opacity, this.opacity);

        gl.bindVertexArray(vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
        gl.bindVertexArray(null);
    }
}

function formatFromUrl(url) {
    const path = url.split(/[?#]/, 1)[0].toLowerCase();
    if (path.endsWith('.parquet') || path.endsWith('.geoparquet')) return 'geoparquet';
    if (path.endsWith('.fgb')) return 'flatgeobuf';
    if (path.endsWith('.geojson') || path.endsWith('.json')) return 'geojson';
    throw new Error(`Cannot tell the format of ${url}. Use a .parquet, .fgb, .geojson, or .json file.`);
}

function validateSlices(slices) {
    if (!Array.isArray(slices) || slices.length < 2) {
        throw new Error('slices needs at least 2 names');
    }
    if (slices.length > MAX_SLICES) {
        throw new Error(`slices supports at most ${MAX_SLICES} names`);
    }
    const seen = new Set();
    for (const name of slices) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new Error('slice names must be non-empty strings');
        }
        if (seen.has(name)) throw new Error(`duplicate slice name "${name}"`);
        seen.add(name);
    }
    return slices;
}

function validateColors(colors, count) {
    if (!Array.isArray(colors) || colors.length !== count) {
        throw new Error('colors must have one entry per slice');
    }
    return colors;
}

function validateRadius(radius) {
    if (typeof radius === 'number') {
        if (!(radius > 0)) throw new Error('radius must be greater than 0');
        return radius;
    }
    if (radius == null || typeof radius !== 'object' || !Array.isArray(radius.steps)) {
        throw new Error('radius must be a number or a step scale');
    }
    if (radius.steps.length === 0) throw new Error('radius.steps needs at least one step');
    const steps = [];
    let previous = -Infinity;
    for (const step of radius.steps) {
        if (!Array.isArray(step) || step.length !== 2) {
            throw new Error('radius.steps entries are [total, size]');
        }
        const [total, size] = step;
        if (typeof total !== 'number' || !Number.isFinite(total)) {
            throw new Error('radius step total must be a finite number');
        }
        if (!(total > previous)) throw new Error('radius step totals must increase');
        if (typeof size !== 'number' || !(size > 0)) {
            throw new Error('radius step size must be greater than 0');
        }
        steps.push([total, size]);
        previous = total;
    }
    if (typeof radius.fallback !== 'number' || !(radius.fallback > 0)) {
        throw new Error('radius.fallback must be greater than 0');
    }
    return {steps, fallback: radius.fallback};
}

function validateZeroToOneFloat(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`${name} must be between 0 and 1`);
    }
    return value;
}

// Returns [r, g, b, a] in 0..1.
function parseColor(input) {
    if (Array.isArray(input)) {
        const [r, g, b, a = 1] = input;
        const scale = r > 1 || g > 1 || b > 1 ? 255 : 1;
        return [
            r / scale,
            g / scale,
            b / scale,
            a > 1 ? a / 255 : a,
        ];
    }

    if (typeof input !== 'string') {
        throw new Error(`Cannot parse color ${String(input)}`);
    }

    const value = input.trim();
    if (value.startsWith('#')) return parseHex(value);

    const channels = value.match(/^rgba?\(([^)]+)\)$/i);
    if (channels) {
        const parts = channels[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return parseColor(parts);
    }

    throw new Error(`Cannot parse color "${input}"`);
}

function parseHex(value) {
    const hex = value.slice(1);
    const expanded = hex.length === 3 || hex.length === 4
        ? [...hex].map((digit) => digit + digit).join('')
        : hex;
    if (expanded.length !== 6 && expanded.length !== 8) {
        throw new Error(`Cannot parse color "${value}"`);
    }
    const digits = expanded.match(/../g).map((pair) => Number.parseInt(pair, 16) / 255);
    return digits.length === 3 ? [...digits, 1] : digits;
}
