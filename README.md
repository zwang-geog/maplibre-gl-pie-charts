# maplibre-gl-pie-charts

[![npm version](https://img.shields.io/npm/v/maplibre-gl-pie-charts)](https://www.npmjs.com/package/maplibre-gl-pie-charts)

**Add a WebGL pie or donut chart layer on a MapLibre GL JS or Mapbox GL JS map to compare share patterns across geographic units.**

<p align="center">
  <img src="https://raw.githubusercontent.com/zwang-geog/maplibre-gl-pie-charts/refs/heads/master/assets/pie-chart-layer-screenshot.png" width="48%" alt="Pie charts of educational attainment for counties in Florida">
  <img src="https://raw.githubusercontent.com/zwang-geog/maplibre-gl-pie-charts/refs/heads/master/assets/donut-chart-layer-screenshot.png" width="48%" alt="Donut charts of educational attainment for the same counties in Florida">
</p>

*Figure 1: US Educational attainment by counties, viewed over Florida, using maplibre-gl-pie-charts PieChartLayer class*

To explore what the package can do, open the [live demo of US educational attainment by county](https://zwang-geog.github.io/maplibre-gl-pie-charts/demos/us-education/).

A pie chart layer **draws one pie chart for each geographic feature** (point recommended, polygon or polyline also acceptable), using the feature's **two or more non-negative numeric attributes**, and those **attributes are parts of a whole** (e.g., number of votes received by each candidate, areas of land use or vegetation type categories, number of people grouped by different population characteristics). Such a pie chart is a direct way to explore the **shares** of those attributes that represent distinct groups or categories: each attribute becomes one **slice**—the wedge of the pie—and the angle of that slice is **the attribute's share of the feature's total**. A pie chart layer therefore provides a quick look showing **how the mix differs from place to place**.

A pie chart layer suits data like these:

| Use case | Attributes representing categories or groups | Value of each attribute for a feature |
| --- | --- | --- |
| Votes by candidate in a precinct | Candidate A, candidate B, and the other candidates | Number of votes the candidate received in the precinct |
| Languages spoken at home in a census tract | English, Spanish, and Chinese | Number of residents in the tract who speak that language at home |
| Land use or vegetation type in a subdivision | Forest, cropland, and developed land | Area of that land type in the subdivision |
| Educational attainment in a county | No high school diploma, high school, some college, a bachelor's degree, and a graduate degree | Number of adults in the county whose highest level of education is that category |

With maplibre-gl-pie-charts `PieChartLayer` class, every chart can share one uniform radius, or **the radius can follow a step scale based on the sum of the slice values**. For example, the charts in Figure 1 use a step radius, so a county with a larger total is drawn larger (see Quick start 2 for details).

Charts can also be filtered by a slice's share or by radius step. The filter runs on the client side, so it can be updated as the user interacts with the map (see Quick start 5).

Additionally, maplibre-gl-pie-charts supports **styling the charts as donuts**. A donut chart is that same pie chart with a round hole in the middle. The donut chart layer styling is controlled by the `hole` constructor option, which is the inner radius as a fraction of the chart's radius. A value of 0 leaves a solid pie, and any greater value opens a hole. A `hole` of 0.5, for example, makes the hole half as wide as the chart. In Figure 1, the map on the left uses solid pies, and the map on the right uses donuts. The ring of a donut can look lighter than a filled pie, and the open center is a place for a label if you want one.

> [!TIP]
> People judge angle and area poorly, so a pie chart is a weak way to decide which category is largest by a small margin (i.e., a close ranking). Rather, a pie chart layer is a better fit for seeing diversity and broad geographic patterns: where one group dominates, where the mix is even, and where that mix changes across the map. The [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/visualization/data-driven-styles/charts/) describes the same use of pie charts on features.

## Quick start

### 0 Installation

Use 0 (1) when the page is built from installed packages. Use 0 (2) when the page is one HTML document.

#### 0 (1) Install with npm

Install one map library. The layer is added to a map you create.

```bash
npm install maplibre-gl
```

```bash
npm install mapbox-gl
```

Install the reader for the file type you will use. GeoJSON needs no extra package. For GeoParquet:

```bash
npm install hyparquet hyparquet-compressors
```

For FlatGeobuf:

```bash
npm install flatgeobuf
```

Then install this package:

```bash
npm install maplibre-gl-pie-charts
```

Import the class from the package name:

```js
import {PieChartLayer} from 'maplibre-gl-pie-charts';
```

#### 0 (2) Load from a single HTML document

MapLibre GL JS is imported from its ESM build. The stylesheet is a separate link, and this package is imported in the same module script.

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@^6.18.0/dist/maplibre-gl.css">
<script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.18.0/dist/maplibre-gl.mjs';
    import {PieChartLayer} from 'https://cdn.jsdelivr.net/npm/maplibre-gl-pie-charts/dist/index.mjs';
</script>
```

Mapbox GL JS is loaded from a script tag. Import this package in a module script after it.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mapbox-gl@3/dist/mapbox-gl.css">
<script src="https://cdn.jsdelivr.net/npm/mapbox-gl@3/dist/mapbox-gl.js"></script>
<script type="module">
    import {PieChartLayer} from 'https://cdn.jsdelivr.net/npm/maplibre-gl-pie-charts/dist/index.mjs';
</script>
```

A page that reads GeoParquet or FlatGeobuf also needs an import map. The package loads those readers by bare name, and the map points each name at its file. Place the map before the module script. GeoJSON needs no map.

For GeoParquet:

```html
<script type="importmap">
{
    "imports": {
        "hyparquet": "https://cdn.jsdelivr.net/npm/hyparquet@1.33.0/src/index.js",
        "hyparquet-compressors": "https://cdn.jsdelivr.net/npm/hyparquet-compressors@1.1.3/src/index.js",
        "fzstd": "https://cdn.jsdelivr.net/npm/fzstd@0.1.1/esm/index.mjs",
        "hysnappy": "https://cdn.jsdelivr.net/npm/hysnappy@1.1.1/js/index.js"
    }
}
</script>
```

For FlatGeobuf, `flatgeobuf/generic` imports the other three names:

```html
<script type="importmap">
{
    "imports": {
        "flatgeobuf/generic": "https://cdn.jsdelivr.net/npm/flatgeobuf@4.6.1/dist/esm/generic.js",
        "flatbuffers": "https://cdn.jsdelivr.net/npm/flatbuffers@25.9.23/+esm",
        "slice-source": "https://cdn.jsdelivr.net/npm/slice-source@0.4.1/+esm",
        "@repeaterjs/repeater": "https://cdn.jsdelivr.net/npm/@repeaterjs/repeater@3.1.0/+esm"
    }
}
</script>
```

### 1 (1) Initialize with a file URL

Pass `url` pointing at one GeoParquet, FlatGeobuf, or GeoJSON file. The extension selects the reader. The check is case-insensitive and uses the path before any `?` or `#`.

| Extension | Format |
| --- | --- |
| `.parquet`, `.geoparquet` | GeoParquet |
| `.fgb` | FlatGeobuf |
| `.geojson`, `.json` | GeoJSON |

- Any other extension is rejected.
- A `.json` file is read as GeoJSON.
- A GeoParquet file is read from the column dictated by the constructor option `geometryColumn`, which defaults to `geometry`.
- `slices` names the numeric attributes, and `colors` supplies one color for each slice, in the same order.

  > **Warning:** At least 2 slices and at most 8 slices are supported. `slices` and `colors` must be the same length, so both arrays are limited to that range.

- Point geometry is recommended. One coordinate pair per feature is smaller to transfer and faster to parse. Other geometry is still drawn, with each chart placed at one anchor:
  - A `Point` uses its coordinate.
  - A `MultiPoint` or `LineString` uses the midpoint of its first two positions. A single position is used as it is.
  - A `MultiLineString` uses the midpoint of the first two positions of its first line.
  - A `Polygon` uses the centroid of its outer ring.
  - A `MultiPolygon` uses the centroid of the outer ring of its first polygon. The centroid can fall outside a concave ring.

```js
const pies = new PieChartLayer({
    id: 'education',
    url: './tl_2025_us_county_points.parquet',
    // geometryColumn: 'geometry' // only optionally applicable to GeoParquet
    slices: ['below_hs', 'high_school', 'some_college', 'bachelors', 'graduate'],
    colors: ['#c4533a', '#e09a3e', '#3d8ea6', '#5c8f3a', '#5b4d8a'],
});
```

### 1 (2) Initialize with data

Pass `data` when the GeoJSON is already in memory, and omit `url`. `data` is a GeoJSON `FeatureCollection` or `Feature`. `slices` and `colors` are unchanged from 1 (1).

```js
const pies = new PieChartLayer({
    id: 'education',
    data: counties, // a GeoJSON FeatureCollection
    slices: ['below_hs', 'high_school', 'some_college', 'bachelors', 'graduate'],
    colors: ['#c4533a', '#e09a3e', '#3d8ea6', '#5c8f3a', '#5b4d8a'],
});
```

### 2 Adjust the radius

`radius` constructor option sets the chart size in CSS pixels. It defaults to 16.

A number is a uniform radius. Every chart is drawn at that size, and the number must be greater than 0.

```js
radius: 16,
```

A step scale varies the radius by the sum of a feature's slice values. `steps` is a list of `[total, size]` pairs, and the totals must increase. The first step whose total is greater than or equal to the sum supplies the size. A sum larger than every total uses `fallback`. Every size and `fallback` must be greater than 0. A step scale can have at most 15 non-fallback steps (i.e., the array length of radius.steps cannot exceed 15).

Suppose one feature has a first slice of 3000, a second slice of 8000, and a third slice of 7500. The sum of those slice values is 18500. Given the following expression, 20000 is the first step whose total is greater than or equal to 18500, so the chart is drawn at 9 pixels.

```js
radius: {
    steps: [
        [8000, 6],    // sum of slice values <= 8000: 6 px ($step 0)
        [20000, 9],   // 8000 < sum <= 20000: 9 px ($step 1)
        [50000, 13],  // 20000 < sum <= 50000: 13 px ($step 2)
        [150000, 17], // 50000 < sum <= 150000: 17 px ($step 3)
    ],
    fallback: 22,     // sum > 150000: 22 px ($step 4)
},
```

### 3 Add the layer to the map

Add the layer after the map style is ready.

```js
map.on('load', () => {
    map.addLayer(pies);
});
```

`loaded` is optional. The promise is created when the layer is added, so read it after `addLayer`. It resolves once the features are read and the charts are uploaded, and it rejects if that read fails. The [education demo](https://github.com/zwang-geog/maplibre-gl-pie-charts/blob/master/demos/us-education/index.html) uses it to report how many counties were drawn:

```js
map.on('load', () => {
    map.addLayer(pies);
    pies.loaded.then(() => {
        status.textContent = `${pies.count.toLocaleString()} counties`;
    }).catch((error) => {
        status.textContent = error.message;
    });
});
```

If the page toggles the basemap style, add the layer from `style.load` instead. A new style removes custom layers, and `style.load` runs for the first style and again after each change.

```js
map.on('style.load', () => {
    map.addLayer(pies);
});
```

### 4 Toggling the layer

#### 4 (1) Visible when the map loads

The layer is drawn as soon as it is added. Show or hide it with the `visibility` layout property. The first argument is the layer id. The same call works on MapLibre GL JS and Mapbox GL JS.

```js
map.setLayoutProperty('pie-layer', 'visibility', 'visible'); // show
map.setLayoutProperty('pie-layer', 'visibility', 'none');    // hide
```

#### 4 (2) Hidden until the user turns it on

Initialize the constructor with `readyForDisplay` set to `false`. The features are still read, and `render` draws nothing while the flag is false. After the layer is added, set its visibility to `none`, then allow rendering. Visibility still controls what the user sees, so the charts stay hidden until the user sets it back to `visible`.

```js
const pies = new PieChartLayer({
    id: 'pie-layer',
    url: './tl_2025_us_county_points.parquet',
    slices: ['below_hs', 'high_school', 'some_college', 'bachelors', 'graduate'],
    colors: ['#c4533a', '#e09a3e', '#3d8ea6', '#5c8f3a', '#5b4d8a'],
    radius: {
        steps: [
            [8000, 6],
            [20000, 9],
            [50000, 13],
            [150000, 17],
        ],
        fallback: 22,
    },
    readyForDisplay: false,
});

map.on('load', () => {
    map.addLayer(pies);
    map.setLayoutProperty('pie-layer', 'visibility', 'none');
    pies.readyForDisplay = true; // allow rendering; Mapbox visibility still controls what the user sees
});

map.setLayoutProperty('pie-layer', 'visibility', 'visible'); // show
```

### 5 Filter the charts

The optional `filter` constructor option takes a condition. Only the charts that pass the condition are drawn.

A condition has the form `[operator, operand, number]`. It tests either **one slice's share** or **the step that the sum of slice values falls in**.

| Part | Slice share | Sum step |
| --- | --- | --- |
| `operator` | `==`, `>`, `>=`, `<`, or `<=` | `==`, `>`, `>=`, `<`, or `<=` |
| `operand` | An attribute name in `slices` | `$step` |
| `number` | The share from 0 to 1. `0.3` means 30%, not a raw value of 0.3. | The radius step index from Quick start 2. The first step is `0`, and `fallback` is the index after the last step. A uniform radius is step `0`. |
| Example condition | `['>', 'bachelors', 0.3]` | `['>=', '$step', 2]` |
| Use case | Show features where one category makes up more, or less, than a given part of the whole | Show features by chart size, because each step draws one radius chosen from the sum of slice values |

A share rarely equals a number exactly, so `==` is mostly useful with `$step`.

A filter can only test the attributes listed in `slices`. An attribute that is not drawn as a slice cannot be filtered, and naming one throws an error.

After the layer is added, the `setFilter` method updates the filter applied to it, for example from a slider or a checkbox. The filter runs in the browser, so the file is not fetched again, and the map updates right away as the user adjusts it. Call `setFilter` on the `PieChartLayer` object, not on the map. `PieChartLayer` is a custom layer, which `map.setFilter` does not support.

```js
// Show only counties where more than 30% of adults hold a bachelor's degree
pies.setFilter(['>', 'bachelors', 0.3]);
```

Multiple conditions can be combined with `all` or `any`. `all` works like SQL `AND`: every condition must pass. `any` works like SQL `OR`: one passing condition is enough. Up to 18 conditions can be combined, and `all` and `any` cannot be nested.

```js
pies.setFilter([
    'all',
    ['>', 'bachelors', 0.3],
    ['>=', '$step', 2], // a sum above 20000, given the steps in Quick start 2
]);
```

To remove a filter that was set earlier and draw every chart again, pass `null`:

```js
pies.setFilter(null);
```

## Class options

`PieChartLayer` takes these constructor options. Set `url` or `data`. `id`, `slices`, and `colors` are required.

| Option | Default | Description |
| --- | --- | --- |
| `id` | | Layer id. `map.addLayer` and `setLayoutProperty` use this string. |
| `url` | | URL of one whole GeoParquet, FlatGeobuf, or GeoJSON file. The extension selects the reader. See Quick start 1 (1). |
| `data` | | A GeoJSON `FeatureCollection` or `Feature` already in memory. See Quick start 1 (2). |
| `geometryColumn` | `geometry` | GeoParquet column that holds the geometry. An empty string is rejected. The option applies to a GeoParquet `url`. |
| `slices` | | Names of the numeric attributes, in slice order. Two to eight unique, non-empty strings. `colors` must be the same length. |
| `colors` | | One color for each slice, in the same order. A color is a `#hex` string, an `rgb()` or `rgba()` string, or a `[red, green, blue]` or `[red, green, blue, alpha]` array. Array channels above 1 are read as 0–255. Other array channels are 0–1. |
| `radius` | `16` | Chart size in CSS pixels. A number greater than 0 is a uniform radius. An object `{steps, fallback}` is a step scale. See Quick start 2. |
| `hole` | `0` | Inner radius as a fraction of the chart radius, from 0 to 1. `0` is a solid pie. `0.5` makes the hole half as wide as the chart. |
| `opacity` | `1` | Chart opacity, from 0 to 1. |
| `filter` | `null` | Draws only the charts that pass the filtering condition (default is to draw all). A condition compares a slice share or `$step`; `all` or `any` combine up to 18. `setFilter` replaces it later. See Quick start 5. |
| `requestInit` | | [`RequestInit`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit) for a `url` request, such as headers or credentials. It is passed through for GeoParquet, FlatGeobuf, and GeoJSON files. |
| `slot` | | Mapbox GL JS slot name. The property is set on the layer only when this option is provided. |
| `readyForDisplay` | `true` | When `false`, `render` draws nothing. The features are still read. See Quick start 4 (2). |

## TypeScript support

The package ships its own type declarations, so no `@types` package is needed. Besides `PieChartLayer`, these types can be imported:

| Type | Describes |
| --- | --- |
| `PieChartLayerOptions` | The constructor options. Exactly one of `url` or `data` is allowed. |
| `PieChartColor` | One slice color: a CSS color string, or a `[red, green, blue]` or `[red, green, blue, alpha]` array. |
| `PieChartRadiusScale` | The `{steps, fallback}` step scale for `radius`. |
| `PieChartData` | The in-memory GeoJSON accepted by `data`. |
| `PieChartFilter` | One condition, or `all` or `any` with a list of conditions, for `filter` and `setFilter`. |
| `PieChartFilterCondition` | One `[operator, operand, number]` condition. |
| `PieChartFilterOperator` | One of `==`, `>`, `>=`, `<`, `<=`. |

For example, a filter can be built from typed conditions:

```ts
import {PieChartLayer, type PieChartFilter, type PieChartFilterCondition} from 'maplibre-gl-pie-charts';

const conditions: PieChartFilterCondition[] = [
    ['>', 'bachelors', 0.3],
    ['>=', '$step', 2]
];
const filter: PieChartFilter = ['all', ...conditions];
pies.setFilter(filter);
```

## Limitations

### 1 Mercator projection only

The layer draws in the Mercator projection, and currently it is not compatible with globe projection on Mapbox GL JS and MapLibre GL JS. Each chart is placed with the Mercator matrix, so a globe view does not keep the charts on their features.

Initialize a Mapbox map with `projection` set to `mercator`:

```js
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    zoom: 7,
    center: [-119.699944, 34.432546],
    projection: 'mercator', // Required. This layer does not draw on the globe.
});
```

Leave a MapLibre map on its Mercator projection. Do not set `projection` to `'globe'`.

### 2 Full-file fetch

A `url` is downloaded in full with one request, whatever its format. GeoParquet is not read with range requests, so columns other than `geometryColumn` and `slices` are downloaded too, even though only those columns are decoded. A host such as GitHub Pages gzips the response, and a range of that response is a slice of the compressed bytes rather than of the file. To keep a large file quick to load, write only the geometry and slice columns, and use Point geometry.


