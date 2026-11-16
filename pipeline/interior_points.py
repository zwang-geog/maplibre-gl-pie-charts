# %%
from pathlib import Path

import geopandas as gpd
import pandas as pd

source = Path("/Users/zifanwang/Library/Mobile Documents/com~apple~CloudDocs/pie-charts/tl_2025_us_county/tl_2025_us_county.shp")

edu_source = Path("/Users/zifanwang/Library/Mobile Documents/com~apple~CloudDocs/pie-charts/ACSDT5Y2024.B15003_2026-11-15T200607/ACSDT5Y2024.B15003-Data.csv")


# %%
frame = gpd.read_file(source)
# The description row sits under the variable codes. GEO_ID ends in the county GEOID.
estimates = pd.read_csv(edu_source, encoding="utf-8-sig", skiprows=[1])
estimates["GEOID"] = estimates["GEO_ID"].str[-5:]
codes = [f"B15003_{number:03d}E" for number in range(2, 26)]
values = estimates[codes].apply(pd.to_numeric, errors="coerce")
education = pd.DataFrame({
    "GEOID": estimates["GEOID"],
    "below_hs": values.iloc[:, 0:15].sum(axis=1, min_count=1),
    "high_school": values.iloc[:, 15:17].sum(axis=1, min_count=1),
    "some_college": values.iloc[:, 17:20].sum(axis=1, min_count=1),
    "bachelors": values.iloc[:, 20:21].sum(axis=1, min_count=1),
    "graduate": values.iloc[:, 21:24].sum(axis=1, min_count=1),
})
frame["GEOID"] = frame["GEOID"].astype(str).str.zfill(5)
frame = frame.merge(education, on="GEOID", how="left")

points = gpd.GeoDataFrame(
    frame[[
        "GEOID",
        "below_hs",
        "high_school",
        "some_college",
        "bachelors",
        "graduate",
    ]],
    geometry=gpd.points_from_xy(
        pd.to_numeric(frame["INTPTLON"]),
        pd.to_numeric(frame["INTPTLAT"]),
    ),
    crs="EPSG:4269",
).to_crs("EPSG:4326")

# %%
output = source.with_name(source.stem + "_points")
points.to_file(output.with_suffix(".fgb"), driver="FlatGeobuf")
points.to_parquet(output.with_suffix(".parquet"), index=False)
points.to_file(output.with_suffix(".geojson"), driver="GeoJSON")

# %%
