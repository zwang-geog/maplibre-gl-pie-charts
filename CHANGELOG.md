# Changelog

## 0.2.0

### Added

- `filter` constructor option and `setFilter` method. A condition compares a slice's share from 0 to 1, or `$step`, the radius step index, with `==`, `>`, `>=`, `<`, or `<=`. `all` or `any` combine up to 18 conditions, without nesting. A new filter applies on the next frame without reading the file again.

### Changed

- Each chart stores its radius step index instead of its radius, and the shader looks the size up. The buffer is the same size.
- A radius step scale has at most 15 steps.

## 0.1.1

### Fixed

- GeoParquet files now load from hosts that gzip the response, such as GitHub Pages. The file is fetched once in full instead of with range requests, because a range of a gzip-encoded response is a slice of the compressed bytes and failed with `parquet file invalid (footer != PAR1)`. Only the geometry column and the slice columns are still decoded.

## 0.1.0

- Initial release.
