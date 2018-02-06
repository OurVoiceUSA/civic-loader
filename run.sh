#!/bin/bash

preset=node_modules/babel-cli/bin/babel-node.js

# ocdid.js takes a while to load so only do it if we obviously don't have the data
place=$(echo "hget division:ocd-division/country:us/state:ut/place:salt_lake_city name" | redis-cli)

if [ "$place" != "Salt Lake City city" ]; then
  echo "Running ocdid.js"
  node $preset ocdid.js
fi

for js in $(ls *.js | grep -v ocdid.js); do
  node $preset $js
done

