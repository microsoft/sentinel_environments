#!/bin/bash
#SBATCH --job-name=gpu-batch-job
#SBATCH --output=logs/video_gen_%j.txt
#SBATCH --error=logs/video_gen_error_%j.txt
#SBATCH --time=12:00:00
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=10
#SBATCH --gres=gpu:1
#SBATCH --partition=hpg-b200
#SBATCH --mem=180G
#SBATCH --account=woodard
#SBATCH --qos=woodard

# Disable output buffering for immediate log visibility
export PYTHONUNBUFFERED=1
stdbuf -oL -eL bash << 'SCRIPT_END'

# create the logs directory if it doesn't exist
mkdir -p logs

# load all required modules (cuda 12.8.1 required for B200 GPUs)
module load cuda/12.8.1
module load ffmpeg

# set environment variables for Hugging Face cache (use blue storage)
export HF_HOME=/blue/uf-dsi/$USER/.cache/huggingface
export HF_DATASETS_CACHE=/blue/uf-dsi/$USER/.cache/huggingface/datasets
export TRANSFORMERS_CACHE=/blue/uf-dsi/$USER/.cache/huggingface/transformers
export HUGGINGFACE_HUB_CACHE=/blue/uf-dsi/$USER/.cache/huggingface/hub

# set environment variables for cpu threading
export OMP_NUM_THREADS="$SLURM_CPUS_PER_TASK"
export OMP_PROC_BIND=false
export OMP_WAIT_POLICY=PASSIVE
export OMP_DYNAMIC=false

# avoid SLURM auto-binding conflicts
export SLURM_CPU_BIND=none

# keep BLAS libs from spawning extra thread pools
export MKL_NUM_THREADS="$SLURM_CPUS_PER_TASK"
export OPENBLAS_NUM_THREADS="$SLURM_CPUS_PER_TASK"
export NUMEXPR_NUM_THREADS="$SLURM_CPUS_PER_TASK"

# Intel OpenMP often pins aggressively; disable its affinity if present
export KMP_AFFINITY=disabled

# navigate to project directory
cd "${PROJECT_DIR:-.}"

# activate virtual environment (inside ImageGenerator/)
source ImageGenerator/.venv/bin/activate

# print job information
echo "=================================="
echo "Wan 2.2 14B Video Generation"
echo "=================================="
echo "SLURM Job ID: $SLURM_JOB_ID"
echo "Node: $SLURMD_NODENAME"
echo "CPUs: $SLURM_CPUS_PER_TASK"
echo "Memory: $SLURM_MEM_PER_NODE MB"
echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader)"
echo "Start time: $(date)"
echo "=================================="

# show GPU info
nvidia-smi

# run the video generation
python -u batch_image_gen.py \
    --mode video \
    --model wan2.2-t2v-14b \
    --prompt_file videoprompts.txt \
    --names_file videopromptnames.txt \
    --output_dir ./generated_videos \
    --width 1280 --height 720 \
    --num_frames 81 \
    --steps 50 \
    --memory_optimization balanced \
    --resume

# Print completion info
echo "=================================="
echo "End time: $(date)"
echo "Job completed!"
echo "=================================="

SCRIPT_END
