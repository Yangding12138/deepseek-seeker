#!/usr/bin/env bash
# 构建 dist/：只带线上要用的资源（原图 png 27M 不上线）
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
cp index.html README.md dist/
cp -r src dist/
mkdir -p dist/art/web dist/art/sprites
cp art/web/*.jpg dist/art/web/
cp art/sprites/*.png dist/art/sprites/
cat > dist/_headers <<'EOF'
/art/*
  Cache-Control: public, max-age=31536000, immutable
/src/*
  Cache-Control: public, max-age=300
EOF
du -sh dist
