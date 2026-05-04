#!/usr/bin/env bash
# Move generated assets from data_generation/_generated/ into data/public/ and
# emit .webp companions for PNGs (the convention in this repo). Idempotent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GEN="${REPO_ROOT}/data_generation/_generated"
PUB="${REPO_ROOT}/data/public"

png_to_webp () {
    local png="$1"
    local webp="${png%.png}.webp"
    if [ ! -f "${webp}" ] || [ "${png}" -nt "${webp}" ]; then
        python3 -c "from PIL import Image; im = Image.open('${png}').convert('RGB'); im.save('${webp}', 'WEBP', quality=90, method=6)"
    fi
}

install_dir () {
    local src="$1"
    local dst="$2"
    [ -d "${src}" ] || { echo "skip ${src} (no source dir)"; return; }
    mkdir -p "${dst}"
    local n=0
    for f in "${src}"/*.png; do
        [ -e "${f}" ] || continue
        cp -f "${f}" "${dst}/"
        png_to_webp "${dst}/$(basename "${f}")"
        n=$((n+1))
    done
    echo "installed ${n} files: ${src} -> ${dst}"
}

# Microfy moods (mood-001.png ... mood-006.png)
install_dir "${GEN}/microfy/moods" "${PUB}/images/microfy/moods"

# MicroMail attachments
install_dir "${GEN}/micromail/attachments" "${PUB}/images/micromail/attachments"

# MicroDin missing company logos -- copy with -logo.png suffix
src="${GEN}/microdin/logos"
dst="${PUB}/images/microdin/company-logos"
mkdir -p "${dst}"
n=0
for f in "${src}"/org-*.png; do
    [ -e "${f}" ] || continue
    base="$(basename "${f}" .png)"
    target="${dst}/${base}-logo.png"
    cp -f "${f}" "${target}"
    png_to_webp "${target}"
    n=$((n+1))
done
echo "installed ${n} files: ${src} -> ${dst} (renamed with -logo suffix)"

# MicroDin missing company banners -- with -banner.png suffix
src="${GEN}/microdin/banners"
dst="${PUB}/images/microdin/company-banners"
mkdir -p "${dst}"
n=0
for f in "${src}"/org-*.png; do
    [ -e "${f}" ] || continue
    base="$(basename "${f}" .png)"
    target="${dst}/${base}-banner.png"
    cp -f "${f}" "${target}"
    png_to_webp "${target}"
    n=$((n+1))
done
echo "installed ${n} files: ${src} -> ${dst} (renamed with -banner suffix)"

# MicroTube videos
src="${GEN}/microtube/videos"
dst="${PUB}/videos/microtube"
mkdir -p "${dst}"
n=0
for f in "${src}"/*.mp4; do
    [ -e "${f}" ] || continue
    cp -f "${f}" "${dst}/"
    n=$((n+1))
done
echo "installed ${n} videos: ${src} -> ${dst}"
