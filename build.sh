#!/usr/bin/env bash
# Đóng gói game thành file zip để upload lên itch.io (index.html phải nằm ở gốc zip)
set -e
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/orbit-climb.zip
zip -q dist/orbit-climb.zip index.html style.css i18n.js art.js game.js
echo "Built dist/orbit-climb.zip"
