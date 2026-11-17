# Changelog

## 0.1.1

### Fixed

- GeoParquet files now load from hosts that gzip the response, such as GitHub Pages. The file is fetched once in full instead of with range requests, because a range of a gzip-encoded response is a slice of the compressed bytes and failed with `parquet file invalid (footer != PAR1)`. Only the geometry column and the slice columns are still decoded.

## 0.1.0

- Initial release.
