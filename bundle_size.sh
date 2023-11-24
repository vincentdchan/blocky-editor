#!/bin/bash

./node_modules/.bin/esbuild --bundle --minify packages/blocky-core/dist/index.js > core_bundle.js
gzip core_bundle.js
du -sh core_bundle.js.gz
rm -f core_bundle.js.gz

./node_modules/.bin/esbuild --bundle --minify packages/blocky-react/dist/index.js > react_bundle.js
gzip react_bundle.js
du -sh react_bundle.js.gz
rm -f react_bundle.js.gz
