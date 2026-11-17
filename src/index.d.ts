/// <reference lib="dom" />

export type PieChartColor =
    | string
    | readonly [number, number, number]
    | readonly [number, number, number, number];

/** `[total, size]` pairs. Totals must increase. The first total greater than or equal to the slice sum supplies the size. */
export interface PieChartRadiusScale {
    steps: ReadonlyArray<readonly [number, number]>;
    fallback: number;
}

export type PieChartFilterOperator = '==' | '>' | '>=' | '<' | '<=';

/**
 * `[op, operand, number]`. A slice name compares that slice's share, from 0 to 1.
 * `'$step'` compares the radius step index: 0 for the first step, and the
 * fallback after the last step. A uniform radius is step 0.
 */
export type PieChartFilterCondition = readonly [PieChartFilterOperator, string, number];

/** One condition, or one `all` or `any` holding 1 to 18 conditions. No nesting. */
export type PieChartFilter =
    | PieChartFilterCondition
    | readonly ['all' | 'any', ...PieChartFilterCondition[]];

export type PieChartData =
    | {type: 'FeatureCollection'; features: ReadonlyArray<PieChartFeature>}
    | PieChartFeature
    | {type: string; coordinates: unknown};

export interface PieChartFeature {
    type: 'Feature';
    geometry?: {type: string; coordinates: unknown} | null;
    properties?: Record<string, unknown> | null;
}

interface PieChartLayerOptionsBase {
    /** Layer id used by `map.addLayer` and `setLayoutProperty`. */
    id: string;
    /**
     * GeoParquet geometry column. Defaults to `"geometry"`.
     * An empty string is rejected. Applies to a GeoParquet `url`.
     */
    geometryColumn?: string;
    /** Numeric attribute names, in slice order. Two to eight unique, non-empty strings. */
    slices: readonly string[];
    /** One color per slice, in the same order. Hex, `rgb()`, `rgba()`, or a numeric channel array. */
    colors: readonly PieChartColor[];
    /** Chart size in CSS pixels. A number is a uniform radius. Defaults to 16. A step scale has at most 15 steps. */
    radius?: number | PieChartRadiusScale;
    /** Inner radius as a fraction of the chart radius, from 0 to 1. Defaults to 0. */
    hole?: number;
    /** Chart opacity, from 0 to 1. Defaults to 1. */
    opacity?: number;
    /** Draws only the charts that pass. `null` draws every chart. Defaults to `null`. */
    filter?: PieChartFilter | null;
    /** Forwarded to the `url` fetch for GeoParquet, FlatGeobuf, and GeoJSON. */
    requestInit?: RequestInit;
    /** Mapbox GL JS slot. Set on the layer only when provided. */
    slot?: string;
    /** When false, `render` draws nothing. The features are still read. Defaults to true. */
    readyForDisplay?: boolean;
}

export type PieChartLayerOptions = PieChartLayerOptionsBase & (
    | {url: string; data?: never}
    | {data: PieChartData; url?: never}
);

export interface PieChartMap {
    getPixelRatio?: () => number;
    triggerRepaint(): void;
}

export class PieChartLayer {
    constructor(options: PieChartLayerOptions);

    readonly id: string;
    readonly type: 'custom';
    readonly renderingMode: '2d';
    slot?: string;
    readonly url: string | undefined;
    readonly data: PieChartData | undefined;
    readonly geometryColumn: string | undefined;
    readonly slices: readonly string[];
    readonly colors: readonly PieChartColor[];
    readonly radius: number | PieChartRadiusScale;
    readonly hole: number;
    readonly opacity: number;
    readonly requestInit: RequestInit | undefined;
    readyForDisplay: boolean;

    /**
     * Replaced when the layer is added. Resolves after the features are uploaded.
     * `null` means the upload was discarded because the layer was removed.
     */
    loaded: Promise<{count: number; sliceCount: number} | null>;
    count: number;
    error: Error | null;

    /** Replaces the client-side filter on the next frame. The charts are not read or uploaded again. */
    setFilter(filter: PieChartFilter | null): void;

    onAdd(map: PieChartMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    onRemove(map: PieChartMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: unknown): void;
}
