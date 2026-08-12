# MapLibre worker assets

These files are vendored from `maplibre-gl@6.1.0`:

- `maplibre-gl-worker.mjs` from the package's `dist` directory
- `maplibre-gl-shared.mjs` from the package's `dist` directory
- [`LICENSE.txt`](./LICENSE.txt), copied byte-for-byte from the package root

MapLibre's worker imports the shared module by its sibling filename. Serving both files from a stable same-origin path keeps GeoJSON rendering functional under Next.js/Turbopack and preserves the application's no-external-request runtime. Keep both files in sync when upgrading `maplibre-gl`.

The vendored JavaScript is distributed under the notices in `LICENSE.txt`. When upgrading MapLibre GL JS, replace both modules and the license from the same installed package version, update the version above, and verify the local license is byte-identical to `node_modules/maplibre-gl/LICENSE.txt`.
