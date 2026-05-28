#!/usr/bin/env bash
# Shard the 50 microtube videos across 4 SLURM B200 jobs.
# 50 / 4 = 12-13 videos per job @ ~26 min/video = 5-6 hours per job.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HF_ROOT="${HF_ROOT:-${HOME}/huggingface}"
# Default to _missing/ subset (23 videos that are not already cached). Override with
# PROMPTS/NAMES env vars to run on the full canonical 50-video set.
PROMPTS="${PROMPTS:-${REPO_ROOT}/data_generation/prompts/microtube/_missing/prompts.txt}"
NAMES="${NAMES:-${REPO_ROOT}/data_generation/prompts/microtube/_missing/names.txt}"
OUT="${REPO_ROOT}/data_generation/_generated/microtube/videos"
LOGS="${REPO_ROOT}/data_generation/scripts/logs"

mkdir -p "${OUT}" "${LOGS}"

TOTAL=$(wc -l < "${PROMPTS}")
NSHARDS="${NSHARDS:-4}"
PER_SHARD=$(( (TOTAL + NSHARDS - 1) / NSHARDS ))
echo "total prompts=${TOTAL}, sharding into ${NSHARDS} jobs of ~${PER_SHARD} each"

for shard in $(seq 0 $((NSHARDS-1))); do
    START=$(( shard * PER_SHARD + 1 ))
    END=$(( START + PER_SHARD - 1 ))
    [ ${END} -gt ${TOTAL} ] && END=${TOTAL}
    [ ${START} -gt ${TOTAL} ] && break

    SHARD_PROMPTS="${OUT}/_shard${shard}_prompts.txt"
    SHARD_NAMES="${OUT}/_shard${shard}_names.txt"
    sed -n "${START},${END}p" "${PROMPTS}" > "${SHARD_PROMPTS}"
    sed -n "${START},${END}p" "${NAMES}" > "${SHARD_NAMES}"

    echo "  shard ${shard}: lines ${START}-${END} ($(wc -l < "${SHARD_PROMPTS}") items)"

    sbatch \
        --job-name="vid-shard${shard}" \
        --output="${LOGS}/video_shard${shard}_%j.out" \
        --error="${LOGS}/video_shard${shard}_%j.err" \
        --time=12:00:00 \
        --partition="${SLURM_PARTITION:-gpu}" \
        --account="${SLURM_ACCOUNT:-$(id -gn)}" --qos="${SLURM_QOS:-${SLURM_ACCOUNT:-$(id -gn)}}" \
        --gres=gpu:1 --cpus-per-task=10 --mem=180G \
        --export="ALL,SHARD_PROMPTS=${SHARD_PROMPTS},SHARD_NAMES=${SHARD_NAMES},OUT=${OUT},HF_ROOT=${HF_ROOT}" \
        "$(dirname "${BASH_SOURCE[0]}")/run_video_shard.slurm"
done

echo
echo "submitted. check with: squeue -u \$USER --name=vid-shard0,vid-shard1,vid-shard2,vid-shard3"
