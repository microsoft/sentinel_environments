# Generation Script Usage

This document shows how to run `data_generation/scripts/batch_image_gen.py`
from a clean checkout using the prompt files in `data_generation/prompts/`.
It documents media generation commands only.

It does not validate or repair the already-installed assets under
`data/public/`. Missing, zero-byte, orphaned, or catalog-inconsistent shipped
files should be handled by a separate release asset audit.

## Prerequisites

- Python 3.10+
- NVIDIA GPU with CUDA 12.x (A100 32GB+ for images/audio, B200 80GB+ for videos)
- HuggingFace account with access to gated models (FLUX.2-dev)
- ffmpeg (for video export)

## Setup

```bash
cd data_generation
python -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements.txt

# for B200/Blackwell GPUs (CUDA 12.8+)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

# for ACE-Step audio generation
pip install git+https://github.com/ace-step/ACE-Step.git

# authenticate with HuggingFace (required for FLUX.2-dev)
huggingface-cli login
```

## Generate From Prompts (local, single GPU)

All commands assume you are in the `data_generation/` directory. They write new
outputs under `output/`; they do not overwrite files in `../data/public/`.

**User avatars (100 images, 1024x1024)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/users/avatars-prompts.txt \
    --names_file prompts/users/avatars-names.txt \
    --output_dir output/users/avatars \
    --width 1024 --height 1024 --steps 28 --resume
```

**User banners (100 images, 1584x384)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/users/banners-prompts.txt \
    --names_file prompts/users/banners-names.txt \
    --output_dir output/users/banners \
    --width 1584 --height 384 --steps 28 --resume
```

**MicroDin company logos (91 images, 800x800)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microdin/company-logos-prompts.txt \
    --names_file prompts/microdin/company-logos-names.txt \
    --output_dir output/microdin/logos \
    --width 800 --height 800 --steps 28 --resume
```

**MicroDin company banners (91 images, 1584x384)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microdin/company-banners-prompts.txt \
    --names_file prompts/microdin/company-banners-names.txt \
    --output_dir output/microdin/banners \
    --width 1584 --height 384 --steps 28 --resume
```

**MicroDin posts (20 images, 1200x800)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microdin/posts-prompts.txt \
    --names_file prompts/microdin/posts-names.txt \
    --output_dir output/microdin/posts \
    --width 1200 --height 800 --steps 28 --resume
```

**MicroMail attachments (25 images, 1024x768)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/micromail/prompts.txt \
    --names_file prompts/micromail/promptnames.txt \
    --output_dir output/micromail/attachments \
    --width 1024 --height 768 --steps 28 --resume
```

**MicroTube channel logos (19 images)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microtube/channel-logos-prompts.txt \
    --names_file prompts/microtube/channel-logos-names.txt \
    --output_dir output/microtube/channel-logos \
    --steps 28 --resume
```

**MicroTube channel banners (19 images, 1584x384)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microtube/channel-banners-prompts.txt \
    --names_file prompts/microtube/channel-banners-names.txt \
    --output_dir output/microtube/channel-banners \
    --width 1584 --height 384 --steps 28 --resume
```

**MicroTube video thumbnails (50 images)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microtube/video-thumbnails-prompts.txt \
    --names_file prompts/microtube/video-thumbnails-names.txt \
    --output_dir output/microtube/thumbnails \
    --steps 28 --resume
```

**MicroTube videos (50 videos, 1280x720, ~22 hours)**
```bash
python scripts/batch_image_gen.py --mode video --model wan2.2-t2v-14b \
    --prompt_file prompts/microtube/videoprompts.txt \
    --names_file prompts/microtube/videopromptnames.txt \
    --output_dir output/microtube/videos \
    --width 1280 --height 720 --steps 50 --resume
```

**MicroFy mood images (6 images, 1072x1072)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microfy/moods-prompts.txt \
    --names_file prompts/microfy/moods-names.txt \
    --output_dir output/microfy/moods \
    --width 1072 --height 1072 --steps 28 --resume
```

**MicroFy music tracks (100 tracks, 2 min each, ~5 hours)**
```bash
python scripts/batch_image_gen.py --mode audio --model ace-step-hq \
    --prompt_file prompts/microfy/songprompts.txt \
    --names_file prompts/microfy/songnames.txt \
    --output_dir output/microfy/songs \
    --audio_duration 120 --resume
```

**MicroGram posts (300 images)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microgram/posts-prompts.txt \
    --names_file prompts/microgram/posts-names.txt \
    --output_dir output/microgram/posts \
    --steps 28 --resume
```

**MicroGram stories (50 images)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microgram/storyprompts.txt \
    --names_file prompts/microgram/storypromptnames.txt \
    --output_dir output/microgram/stories \
    --steps 28 --resume
```

**MicroChat team icons (10 images, 1280x720)**
```bash
python scripts/batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file prompts/microchat/teamnames.txt \
    --names_file prompts/microchat/team-names.txt \
    --output_dir output/microchat/team-icons \
    --width 1280 --height 720 --steps 28 --resume
```

## Generate via SLURM (cluster)

The scripts in `data_generation/scripts/*.slurm` and the sharding helpers are
examples from the original cluster workflow. They assume a local module system,
cluster-specific resources, and in some cases an externally managed
`HF_ROOT`/virtualenv/model-cache layout. They are not required to use
`batch_image_gen.py` and should not be treated as clean-clone commands.

For cluster generation, put the local commands above into your own job script,
or review and adapt the provided examples. At minimum, override account,
partition, QOS, project directory, cache directory, and virtualenv paths for
your cluster:

```bash
# image batch (A100)
sbatch --account=YOUR_ACCOUNT --qos=YOUR_QOS scripts/run_batch_gen.slurm

# video generation, sharded across 4 B200 nodes (~6 hrs)
SLURM_PARTITION=YOUR_GPU_PARTITION \
SLURM_ACCOUNT=YOUR_ACCOUNT \
SLURM_QOS=YOUR_QOS \
HF_ROOT=/path/to/your/huggingface \
    bash scripts/submit_video_shards.sh
```

The canonical prompt paths for full MicroTube video generation are:

```bash
--prompt_file prompts/microtube/videoprompts.txt
--names_file prompts/microtube/videopromptnames.txt
```

Some helper scripts default to `_missing/` subsets or historical cache
locations. Override `PROMPTS`, `NAMES`, `HF_ROOT`, `HF_CACHE_DIR`, `PROJECT_DIR`,
and `VENV_PATH` as needed.

## Time Estimates (single NVIDIA B200, 183GB VRAM)

| Asset | Count | Per Item | Total |
|-------|-------|----------|-------|
| Images (FLUX.2-dev) | ~500 | ~8s | ~1.5 hrs |
| Videos (Wan2.2-14B) | 50 | ~26 min | ~22 hrs |
| Music (ACE-Step-HQ) | 100 | ~3 min | ~5 hrs |

Total wall-clock time for the full prompt set: ~28.5 hours on a single B200.
With 4-way video sharding: ~11 hours.

## Verification

After generation, compare output counts against the prompt inventory in
`README.md`. The `--resume` flag skips indices listed in the output
directory's `.checkpoint` file, making re-runs idempotent for a stable output
directory.

This verification only covers newly generated outputs. It does not confirm
that the checked-in `data/public/` assets match the catalogs.
