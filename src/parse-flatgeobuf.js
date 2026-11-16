import {anchorOfGeometry} from './anchor.js';
import {createPieAccumulator} from './pie-table.js';

// Streams a whole FlatGeobuf file into the instance buffer. Properties stay
// in the feature byte layout: only the named slice columns are decoded.
export async function pieTableFromFlatGeobuf(source) {
    const {deserialize, ColumnType, GeometryType} = await import('flatgeobuf/generic');
    const bytes = await fetchBytes(source);
    const reader = createReader(source, ColumnType, GeometryType);
    for await (const _feature of deserialize(bytes, reader)) {
        // The callback writes each feature. The yielded value is unused.
    }
    return reader.finish();
}

async function fetchBytes(source) {
    const response = await fetch(source.url, source.requestInit);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${source.url}: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
}

function createReader(source, ColumnType, GeometryType) {
    let accumulator = null;
    let plan = null;
    return {
        headerMetaFn(header) {
            assertWgs84(header.crs);
            plan = columnPlan(header, source.slices, ColumnType);
            const count = header.featuresCount;
            accumulator = createPieAccumulator(source, Number.isFinite(count) && count > 0 ? count : 0);
        },
        fromFeature(_id, feature, header) {
            const geometry = geometryOf(feature, header.geometryType, GeometryType);
            const anchor = geometry && anchorOfGeometry(geometry);
            if (anchor) accumulator.push(anchor[0], anchor[1], readSliceValues(feature, plan, ColumnType));
            return null;
        },
        finish() {
            if (!accumulator) throw new Error('FlatGeobuf file has no header');
            return accumulator.finish();
        },
    };
}

function columnPlan(header, slices, ColumnType) {
    const columns = header.columns ?? [];
    const indexByName = new Map(columns.map((column, index) => [column.name, index]));
    const widths = new Int8Array(columns.length);
    const types = new Int8Array(columns.length);
    const slotByColumn = new Int16Array(columns.length).fill(-1);
    for (let i = 0; i < columns.length; i++) {
        types[i] = columns[i].type;
        widths[i] = valueWidth(columns[i].type, ColumnType);
    }
    slices.forEach((name, slot) => {
        const index = indexByName.get(name);
        if (index == null) throw new Error(`FlatGeobuf file has no column "${name}"`);
        if (!isSliceNumber(columns[index].type, ColumnType)) {
            throw new Error(`FlatGeobuf column "${name}" is not numeric`);
        }
        slotByColumn[index] = slot;
    });
    return {widths, types, slotByColumn, sliceCount: slices.length};
}

function readSliceValues(feature, plan, ColumnType) {
    const values = new Float64Array(plan.sliceCount);
    values.fill(NaN);
    const array = feature.propertiesArray();
    if (!array || array.length === 0) return values;
    const view = new DataView(array.buffer, array.byteOffset, array.byteLength);
    const length = Math.min(feature.propertiesLength(), array.byteLength);
    let offset = 0;
    while (offset + 2 <= length) {
        const column = view.getUint16(offset, true);
        offset += 2;
        if (column >= plan.widths.length) {
            throw new Error('FlatGeobuf property refers to a missing column');
        }
        const width = plan.widths[column];
        if (width < 0) {
            if (offset + 4 > length) throw new Error('FlatGeobuf properties are truncated');
            const byteLength = view.getUint32(offset, true);
            offset += 4 + byteLength;
            continue;
        }
        if (offset + width > length) throw new Error('FlatGeobuf properties are truncated');
        const slot = plan.slotByColumn[column];
        if (slot >= 0) values[slot] = readNumber(view, offset, plan.types[column], ColumnType);
        offset += width;
    }
    return values;
}

function valueWidth(type, ColumnType) {
    switch (type) {
        case ColumnType.Byte:
        case ColumnType.UByte:
        case ColumnType.Bool:
            return 1;
        case ColumnType.Short:
        case ColumnType.UShort:
            return 2;
        case ColumnType.Int:
        case ColumnType.UInt:
        case ColumnType.Float:
            return 4;
        case ColumnType.Long:
        case ColumnType.ULong:
        case ColumnType.Double:
            return 8;
        case ColumnType.String:
        case ColumnType.Json:
        case ColumnType.DateTime:
        case ColumnType.Binary:
            return -1;
        default:
            throw new Error(`Unknown FlatGeobuf column type ${type}`);
    }
}

function isSliceNumber(type, ColumnType) {
    switch (type) {
        case ColumnType.Byte:
        case ColumnType.UByte:
        case ColumnType.Short:
        case ColumnType.UShort:
        case ColumnType.Int:
        case ColumnType.UInt:
        case ColumnType.Long:
        case ColumnType.ULong:
        case ColumnType.Float:
        case ColumnType.Double:
            return true;
        default:
            return false;
    }
}

function readNumber(view, offset, type, ColumnType) {
    switch (type) {
        case ColumnType.Byte:
            return view.getInt8(offset);
        case ColumnType.UByte:
            return view.getUint8(offset);
        case ColumnType.Short:
            return view.getInt16(offset, true);
        case ColumnType.UShort:
            return view.getUint16(offset, true);
        case ColumnType.Int:
            return view.getInt32(offset, true);
        case ColumnType.UInt:
            return view.getUint32(offset, true);
        case ColumnType.Long:
            return Number(view.getBigInt64(offset, true));
        case ColumnType.ULong:
            return Number(view.getBigUint64(offset, true));
        case ColumnType.Float:
            return view.getFloat32(offset, true);
        case ColumnType.Double:
            return view.getFloat64(offset, true);
        default:
            return NaN;
    }
}

function assertWgs84(crs) {
    if (!crs) return;
    const org = crs.org?.trim().toUpperCase() ?? '';
    const codeString = crs.code_string?.trim().toUpperCase() ?? '';
    const name = crs.name?.trim().toUpperCase() ?? '';
    if (!org && !crs.code && !codeString && !name && !crs.wkt) return;
    if ((org === 'EPSG' || org === '') && crs.code === 4326) return;
    if (codeString === 'EPSG:4326' || codeString === 'OGC:CRS84' || codeString === 'CRS84') return;
    if (name === 'WGS 84' || name === 'WGS84' || name === 'CRS84' || name === 'OGC:CRS84') return;
    if (crs.wkt && isWgs84Wkt(crs.wkt)) return;
    const declared = codeString || (org && crs.code ? `${org}:${crs.code}` : '') || name || 'custom';
    throw new Error(`FlatGeobuf CRS must be WGS84 longitude and latitude, found ${declared}`);
}

function isWgs84Wkt(wkt) {
    const upper = wkt.toUpperCase();
    if (upper.includes('PROJCS') || upper.includes('PROJECTEDCRS')) return false;
    return upper.includes('4326') || upper.includes('CRS84') || upper.includes('WGS_1984') || upper.includes('WGS 84');
}

function geometryOf(feature, headerType, GeometryType) {
    const geometry = feature.geometry();
    if (!geometry) return null;
    const type = headerType === GeometryType.Unknown ? geometry.type() : headerType;
    switch (type) {
        case GeometryType.Point: {
            const xy = geometry.xyArray();
            if (!xy || xy.length < 2) return null;
            return {type: 'Point', coordinates: [xy[0], xy[1]]};
        }
        case GeometryType.MultiPoint:
            return {type: 'MultiPoint', coordinates: partCoordinates(geometry).flat()};
        case GeometryType.LineString:
            return {type: 'LineString', coordinates: partCoordinates(geometry).flat()};
        case GeometryType.MultiLineString:
            return {type: 'MultiLineString', coordinates: partCoordinates(geometry)};
        case GeometryType.Polygon:
            return {type: 'Polygon', coordinates: partCoordinates(geometry)};
        case GeometryType.MultiPolygon:
            return {type: 'MultiPolygon', coordinates: polygonCoordinates(geometry)};
        default:
            return null;
    }
}

function partCoordinates(geometry) {
    const xy = geometry.xyArray();
    const vertexCount = xy ? xy.length >> 1 : 0;
    const ends = geometry.endsArray();
    if (!ends || ends.length === 0) return [pairs(xy, 0, vertexCount)];
    const parts = [];
    let start = 0;
    for (let i = 0; i < ends.length; i++) {
        const end = ends[i];
        parts.push(pairs(xy, start, end));
        start = end;
    }
    return parts;
}

function polygonCoordinates(geometry) {
    const coordinates = [];
    const count = geometry.partsLength();
    for (let i = 0; i < count; i++) {
        const part = geometry.parts(i);
        if (part) coordinates.push(partCoordinates(part));
    }
    return coordinates;
}

function pairs(xy, start, end) {
    if (!xy) return [];
    const last = Math.min(end, xy.length >> 1);
    const coordinates = [];
    for (let i = start; i < last; i++) coordinates.push([xy[i * 2], xy[i * 2 + 1]]);
    return coordinates;
}
