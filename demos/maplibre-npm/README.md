# MapLibre React app linked to this package

From the repository root, build the package. The React app reads `dist`, and installing the folder does not run the publish build.

```bash
npm run build
```

From this directory, create the React app, install MapLibre, and install this package from the repository root.

```bash
npm create vite@latest . -- --template react
npm install
npm install maplibre-gl
npm install ../..
npm run dev
```

Vite asks before using this folder because this README is already here. Confirm that prompt.

For a FlatGeobuf or GeoParquet file, install the reader the layer imports at runtime:

```bash
npm install flatgeobuf hyparquet hyparquet-compressors
```

`npm install ../..` symlinks the repository into `node_modules`. That path is outside this app. If the dev server refuses to load it, allow the repository root in `vite.config.js`:

```js
export default {
    server: {
        fs: {
            allow: ['../..'],
        },
    },
}
```
