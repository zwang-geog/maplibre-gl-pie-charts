import {buildPieTableFromColumns} from './pie-table.js';

// Reads geometryColumn and the slice columns. The column arrays live only
// until buildPieTableFromColumns returns the instance view.
export async function pieTableFromGeoParquet(source) {
    const {asyncBufferFromUrl, parquetMetadataAsync, parquetRead, parquetSchema} = await import('hyparquet');
    const {compressors} = await import('hyparquet-compressors');
    const file = await asyncBufferFromUrl({
        url: source.url,
        requestInit: source.requestInit,
    });
    const metadata = await parquetMetadataAsync(file);
    const available = new Set(parquetSchema(metadata).children.map((child) => child.element.name));
    const geometryColumn = source.geometryColumn;
    requireColumn(available, geometryColumn);
    for (const name of source.slices) {
        if (name === geometryColumn) {
            throw new Error(`slice name "${name}" matches geometryColumn`);
        }
        requireColumn(available, name);
    }

    const rowCount = Number(metadata.num_rows);
    const geometry = new Array(rowCount);
    const valueColumns = source.slices.map(() => new Float64Array(rowCount));
    const valueIndex = new Map(source.slices.map((name, index) => [name, index]));

    await parquetRead({
        file,
        metadata,
        columns: [geometryColumn, ...source.slices],
        compressors,
        onChunk(chunk) {
            if (chunk.columnName === geometryColumn) {
                copyObjects(geometry, chunk.columnData, chunk.rowStart);
                return;
            }
            copyNumbers(valueColumns[valueIndex.get(chunk.columnName)], chunk.columnData, chunk.rowStart);
        },
    });

    return buildPieTableFromColumns(geometry, valueColumns, source);
}

function requireColumn(available, name) {
    if (!available.has(name)) throw new Error(`GeoParquet file has no column "${name}"`);
}

function copyObjects(dest, data, rowStart) {
    for (let i = 0; i < data.length; i++) dest[rowStart + i] = data[i];
}

function copyNumbers(dest, data, rowStart) {
    for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const number = value == null ? NaN : Number(value);
        dest[rowStart + i] = Number.isFinite(number) ? number : NaN;
    }
}
