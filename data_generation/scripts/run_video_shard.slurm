#!/bin/bash
# Run a single shard of microtube video generation on a B200.
# Submitted by submit_video_shards.sh with SHARD_PROMPTS, SHARD_NAMES, OUT, HF_ROOT exported.
set -euo pipefail
export PYTHONUNBUFFERED=1

module load cuda/12.8.1 ffmpeg

export HF_HOME="${HF_ROOT}/.cache/huggingface"
export HUGGINGFACE_HUB_CACHE="${HF_HOME}/hub"
export HF_DATASETS_CACHE="${HF_HOME}/datasets"
export TRANSFORMERS_CACHE="${HF_HOME}/transformers"
export OMP_NUM_THREADS="${SLURM_CPUS_PER_TASK:-10}"
export SLURM_CPU_BIND=none
export KMP_AFFINITY=disabled

source "${HF_ROOT}/ImageGenerator/.venv/bin/activate"

echo "=== shard $(basename "${SHARD_PROMPTS}") on $(hostname) ==="
echo "prompts: $(wc -l < "${SHARD_PROMPTS}") items"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

cd "${HF_ROOT}"
python -u batch_image_gen.py \
    --mode video \
    --model wan2.2-t2v-14b \
    --prompt_file "${SHARD_PROMPTS}" \
    --names_file "${SHARD_NAMES}" \
    --output_dir "${OUT}" \
    --width 1280 --height 720 \
    --num_frames 81 \
    --steps 50 \
    --memory_optimization balanced \
    --resume

echo "=== shard done at $(date -Iseconds) ==="
