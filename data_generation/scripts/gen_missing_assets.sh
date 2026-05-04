#!/usr/bin/env bash
# Orchestrate generation of all media assets that were missing as of 2026-05-03.
#
# What it generates:
#   - 6  microfy mood images   (FLUX.2-dev, 1072x1072)
#   - 25 micromail attachments (FLUX.2-dev, 1024x768)
#   - 41 microdin logos        (FLUX.2-dev, 800x800)
#   - 41 microdin banners      (FLUX.2-dev, 1584x384)
#   - 50 microtube videos      (Wan2.2-T2V-14B, 1280x720, 81 frames) -- via SLURM
#
# FLUX runs are foreground on the current B200/A100 (~20-40 min total).
# Wan2.2 runs are submitted as 4 sharded SLURM jobs to the hpg-b200 partition.
#
# Usage:
#   bash data_generation/scripts/gen_missing_assets.sh images   # FLUX only
#   bash data_generation/scripts/gen_missing_assets.sh videos   # Wan2.2 SLURM only
#   bash data_generation/scripts/gen_missing_assets.sh all      # both
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GEN_ROOT="${REPO_ROOT}/data_generation/scripts"
HF_ROOT="/blue/uf-dsi/${USER}/huggingface"
VENV="${HF_ROOT}/ImageGenerator/.venv"
GEN_SCRIPT="${HF_ROOT}/batch_image_gen.py"

# Snapshot path bypasses HF gating since FLUX.2-dev is gated but cached.
FLUX_SNAPSHOT="${HF_ROOT}/.cache/huggingface/hub/models--black-forest-labs--FLUX.2-dev/snapshots/6aab690f8379b70adc89edfa6bb99b3537ba52a3"

export HF_HOME="${HF_ROOT}/.cache/huggingface"
export HUGGINGFACE_HUB_CACHE="${HF_HOME}/hub"
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export DIFFUSERS_OFFLINE=1
export PYTHONUNBUFFERED=1

OUT_ROOT="${REPO_ROOT}/data_generation/_generated"
mkdir -p "${OUT_ROOT}"/{microfy/moods,micromail/attachments,microdin/logos,microdin/banners,microtube/videos}

run_flux () {
    local name="$1"
    local prompt_file="$2"
    local names_file="$3"
    local out_dir="$4"
    local width="$5"
    local height="$6"

    echo
    echo "=== FLUX.2-dev: ${name} ==="
    echo "    prompt_file=${prompt_file}"
    echo "    names_file =${names_file}"
    echo "    out_dir    =${out_dir}"
    echo "    size       =${width}x${height}"
    "${VENV}/bin/python" -u "${GEN_SCRIPT}" \
        --mode image \
        --custom_model_path "${FLUX_SNAPSHOT}" \
        --model flux2-dev \
        --prompt_file "${prompt_file}" \
        --names_file "${names_file}" \
        --output_dir "${out_dir}" \
        --width "${width}" --height "${height}" \
        --steps 28 \
        --guidance_scale 4.0 \
        --resume
}

if [[ "${1:-all}" == "images" || "${1:-all}" == "all" ]]; then
    # Microfy moods
    run_flux moods \
        "${REPO_ROOT}/data_generation/prompts/microfy/moods-prompts.txt" \
        "${REPO_ROOT}/data_generation/prompts/microfy/moods-names.txt" \
        "${OUT_ROOT}/microfy/moods" 1072 1072

    # MicroMail attachments
    run_flux micromail-attachments \
        "${REPO_ROOT}/data_generation/prompts/micromail/prompts.txt" \
        "${REPO_ROOT}/data_generation/prompts/micromail/promptnames.txt" \
        "${OUT_ROOT}/micromail/attachments" 1024 768

    # MicroDin missing logos (40 forgotten + 1 themicrocorporate)
    run_flux microdin-logos \
        "${REPO_ROOT}/data_generation/prompts/microdin/_missing/logos-prompts.txt" \
        "${REPO_ROOT}/data_generation/prompts/microdin/_missing/names.txt" \
        "${OUT_ROOT}/microdin/logos" 800 800

    # MicroDin missing banners
    run_flux microdin-banners \
        "${REPO_ROOT}/data_generation/prompts/microdin/_missing/banners-prompts.txt" \
        "${REPO_ROOT}/data_generation/prompts/microdin/_missing/names.txt" \
        "${OUT_ROOT}/microdin/banners" 1584 384
fi

if [[ "${1:-all}" == "videos" || "${1:-all}" == "all" ]]; then
    bash "${GEN_ROOT}/submit_video_shards.sh"
fi

echo
echo "=== generation pass done at $(date -Iseconds) ==="
echo "outputs under: ${OUT_ROOT}"
echo "post-process: bash ${GEN_ROOT}/install_generated_assets.sh"
