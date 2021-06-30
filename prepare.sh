#!/bin/bash

cp config/config-template.toml config/config.toml
cp config/history-template.json config/history.json
cp config/manual-template.toml config/manual.toml
npm i

echo "Remember to edit the config files as needed."