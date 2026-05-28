#!/bin/bash
#SBATCH --job-name=batch_img_gen
#SBATCH --output=logs/batch_gen_%j.out
#SBATCH --error=logs/batch_gen_%j.err
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem=128gb
#SBATCH --time=24:00:00
#SBATCH --partition=gpu
#SBATCH --gres=gpu:a100:1
# override account/qos via: sbatch --account=YOUR_ACCOUNT --qos=YOUR_QOS run_batch_gen.slurm

# ============================================================================
# Batch Image Generation SLURM Script
# ============================================================================
# Usage:
#   # Basic submission
#   sbatch run_batch_gen.slurm
#
#   # With custom parameters
#   sbatch --export=MODEL=flux-schnell,PROMPT_FILE=my_prompts.txt run_batch_gen.slurm
#
#   # Multi-GPU (4 GPUs)
#   sbatch --gres=gpu:a100:4 --export=NUM_GPUS=4,MODEL=flux-dev run_batch_gen.slurm
#
# ============================================================================

# Configuration (can be overridden via sbatch --export)
MODEL=${MODEL:-"flux-schnell"}
PROMPT_FILE=${PROMPT_FILE:-"prompts.txt"}
OUTPUT_DIR=${OUTPUT_DIR:-"generated_images"}
BATCH_SIZE=${BATCH_SIZE:-1}
STEPS=${STEPS:-""}
WIDTH=${WIDTH:-1024}
HEIGHT=${HEIGHT:-1024}
SEED=${SEED:-42}
NUM_GPUS=${NUM_GPUS:-1}
RESUME=${RESUME:-"false"}

# Print job info
echo "=============================================="
echo "SLURM Job ID: $SLURM_JOB_ID"
echo "Node: $SLURMD_NODENAME"
echo "Start Time: $(date)"
echo "=============================================="
echo "Model: $MODEL"
echo "Prompt File: $PROMPT_FILE"
echo "Output Dir: $OUTPUT_DIR"
echo "Batch Size: $BATCH_SIZE"
echo "Image Size: ${WIDTH}x${HEIGHT}"
echo "GPUs: $NUM_GPUS"
echo "=============================================="

# Create logs directory
mkdir -p logs

# Load modules
module load cuda/12.9.1

# Set up cache directories (use local scratch for speed if available)
SCRATCH_ROOT="${SCRATCH_ROOT:-/tmp}"
BASE="${SCRATCH_ROOT}/${SLURM_JOB_ID:-$$}"
mkdir -p "$BASE/.cache" "$BASE/tmp"

export TMPDIR="$BASE/tmp"
export XDG_CACHE_HOME="$BASE/.cache"
export UV_CACHE_DIR="$XDG_CACHE_HOME/uv"
export TORCH_HOME="$XDG_CACHE_HOME/torch"
export HF_HOME="${HF_CACHE_DIR:-$XDG_CACHE_HOME/huggingface}"
export TRANSFORMERS_CACHE="$HF_HOME/hub"

# set HF_TOKEN in your environment for gated models (e.g. FLUX.2-dev)

# Change to working directory
cd "${PROJECT_DIR:-.}"

# Verify environment
echo "Python: $(python --version)"
echo "CUDA available: $(python -c 'import torch; print(torch.cuda.is_available())')"
echo "GPU count: $(python -c 'import torch; print(torch.cuda.device_count())')"

# Build command
CMD="python batch_image_gen.py"
CMD="$CMD --model $MODEL"
CMD="$CMD --prompt_file $PROMPT_FILE"
CMD="$CMD --output_dir $OUTPUT_DIR"
CMD="$CMD --batch_size $BATCH_SIZE"
CMD="$CMD --width $WIDTH"
CMD="$CMD --height $HEIGHT"
CMD="$CMD --seed $SEED"

# Add optional steps if specified
if [ -n "$STEPS" ]; then
    CMD="$CMD --steps $STEPS"
fi

# Add resume flag if set
if [ "$RESUME" = "true" ]; then
    CMD="$CMD --resume"
fi

# Run with appropriate launcher
if [ "$NUM_GPUS" -gt 1 ]; then
    echo "Running with $NUM_GPUS GPUs using torchrun..."
    torchrun --nproc_per_node=$NUM_GPUS $CMD
else
    echo "Running on single GPU..."
    $CMD
fi

# Job completion
echo "=============================================="
echo "Job completed at: $(date)"
echo "Output saved to: $OUTPUT_DIR"
echo "=============================================="
