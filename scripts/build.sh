#!/bin/sh
set -e

# 1. Stash existing MP3s before astro build wipes docs/
if [ -d docs ]; then
  find docs -name "index.mp3" | while read src; do
    slug=$(echo "$src" | cut -d/ -f2)
    mkdir -p "audio-cache/$slug"
    cp "$src" "audio-cache/$slug/index.mp3"
    echo "Stashed $slug/index.mp3"
  done
fi

# 2. Rebuild the site (wipes docs/, regenerates HTML/TTS/TXT)
npx astro build

# 3. Restore stashed MP3s into rebuilt docs/ so Python skip-check works
if [ -d audio-cache ]; then
  find audio-cache -name "index.mp3" | while read src; do
    slug=$(echo "$src" | cut -d/ -f2)
    dest="docs/$slug/index.mp3"
    if [ -d "docs/$slug" ]; then
      cp "$src" "$dest"
      echo "Restored $slug/index.mp3"
    fi
  done
fi

# 4. Generate TTS only for new/changed posts (skips unchanged via audio-hashes.json)
uv run python main.py
