# Sentinel Benchmark - Synthetic Data Generation

**Generated benchmark catalogs and media are AI-generated. They contain no real
users, PII, or scraped content.**

## Hardware Requirements

- Images (FLUX.2-dev): NVIDIA A100 (32GB+) or equivalent
- Videos (Wan2.2-T2V-14B): NVIDIA B200 (80GB+) or equivalent
- Audio (ACE-Step-HQ): NVIDIA A100 (32GB+) or equivalent

We used an NVIDIA B200 (183GB VRAM) with CUDA 12.8 for all generation.

## Models

| Type | Model | Settings | License |
|------|-------|----------|---------|
| Images | FLUX.2-dev | 28 steps, guidance 4.0, bfloat16 | Non-commercial (research OK, HuggingFace gated) |
| Videos | Wan2.2-T2V-14B | 50 steps, 81 frames, 720p | Apache 2.0 |
| Audio | ACE-Step-HQ | 150 steps, 2 min, 44.1kHz | Apache 2.0 |

## Scope

This directory documents the media generation entry point,
`scripts/batch_image_gen.py`, and the prompt/name files it consumes. The
commands below generate files into an output directory; they do not validate or
repair already-installed benchmark media under `data/public/`.

Catalog-to-asset integrity checks for shipped files, such as missing or
zero-byte files in `data/public/`, are a separate release audit concern.

## Prompt Inventory

All prompts are checked into `prompts/` with one prompt per line. Assets that
need deterministic filenames include paired name files.

| Environment | Asset Type | Prompts | Names | Dimensions |
|-------------|-----------|---------|-------|------------|
| Users | avatars | 100 | 100 | 1024x1024 |
| Users | banners | 100 | 100 | 1584x384 |
| MicroDin | company logos | 91 | 91 | 800x800 |
| MicroDin | company banners | 91 | 91 | 1584x384 |
| MicroDin | posts | 20 | 20 | 1200x800 |
| MicroMail | attachments | 25 | 25 | 1024x768 |
| MicroTube | channel logos | 19 | 19 | 800x800 |
| MicroTube | channel banners | 19 | 19 | 1584x384 |
| MicroTube | videos | 50 | 50 | 1280x720 |
| MicroTube | video thumbnails | 50 | 50 | 1280x720 |
| MicroFy | mood images | 6 | 6 | 1072x1072 |
| MicroFy | track covers | 100 | 100 | 1072x1072 |
| MicroFy | playlist logos | 20 | 20 | 1072x1072 |
| MicroFy | band logos | 50 | 50 | 1072x1072 |
| MicroFy | band banners | 50 | 50 | 1488x496 |
| MicroFy | music tracks | 100 | 100 | 2 min, 44.1kHz |
| MicroGram | posts | 300 | 300 | 1072x1072 |
| MicroGram | stories | 50 | 50 | 1072x1920 |
| MicroChat | team icons | 10 | 10 | 1280x720 |

## Setup

```bash
cd data_generation

# install dependencies
pip install -r scripts/requirements.txt

# for B200/Blackwell GPUs
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

# for ACE-Step audio generation
pip install git+https://github.com/ace-step/ACE-Step.git

# login to HuggingFace (required for gated models like FLUX.2-dev)
huggingface-cli login
```

## Usage

The canonical generation command is `python scripts/batch_image_gen.py` from
the `data_generation/` directory. The script supports three modes: image,
video, and audio.

```bash
# images (FLUX.2-dev)
python scripts/batch_image_gen.py \
    --mode image --model flux2-dev \
    --prompt_file prompts/users/avatars-prompts.txt \
    --names_file prompts/users/avatars-names.txt \
    --output_dir output/users/avatars \
    --width 1024 --height 1024 --steps 28

# videos (Wan2.2-T2V-14B, requires 80GB+ VRAM)
python scripts/batch_image_gen.py \
    --mode video --model wan2.2-t2v-14b \
    --prompt_file prompts/microtube/videoprompts.txt \
    --names_file prompts/microtube/videopromptnames.txt \
    --output_dir output/microtube/videos \
    --width 1280 --height 720 --steps 50

# audio (ACE-Step-HQ)
python scripts/batch_image_gen.py \
    --mode audio --model ace-step-hq \
    --prompt_file prompts/microfy/songprompts.txt \
    --names_file prompts/microfy/songnames.txt \
    --output_dir output/microfy/songs \
    --audio_duration 120
```

Key flags:
- `--names_file` pairs each prompt with a custom output filename
- `--resume` skips already-generated files (uses `.checkpoint` file)
- `--memory_optimization auto|minimal|balanced|aggressive` controls VRAM usage
- `--custom_model_path` overrides the HuggingFace model ID with a local path

## SLURM (cluster usage)

The SLURM files under `scripts/` are examples from the original cluster
workflow. They may require local edits for module names, virtualenv activation,
cache locations, script paths, account, partition, and QOS. They are not
required to use `scripts/batch_image_gen.py`, and should not be treated as a
clean-clone reproduction interface.

For cluster use, prefer adapting the local commands above inside your own job
script. If you use the provided wrappers, review and override their environment
variables first:

```bash
# image generation (A100)
sbatch --account=YOUR_ACCOUNT --qos=YOUR_QOS scripts/run_batch_gen.slurm

# video generation (B200, single job)
sbatch --account=YOUR_ACCOUNT --qos=YOUR_QOS --partition=YOUR_GPU_PARTITION scripts/run_video_gen.slurm

# video generation (B200, sharded across 4 jobs)
SLURM_PARTITION=YOUR_GPU_PARTITION SLURM_ACCOUNT=YOUR_ACCOUNT SLURM_QOS=YOUR_QOS \
    bash scripts/submit_video_shards.sh
```

Environment variables for SLURM scripts:
- `HF_ROOT` - root directory used by some historical wrappers for a HuggingFace cache, virtualenv, and script checkout
- `HF_CACHE_DIR` - HuggingFace cache directory (default: `$HOME/.cache/huggingface`)
- `PROJECT_DIR` - working directory for the generation script (default: `.`)
- `SLURM_PARTITION` - GPU partition name (default: `gpu`)
- `SLURM_ACCOUNT` / `SLURM_QOS` - your cluster account and QOS

## Post-generation

The optional install helper copies selected files from `data_generation/_generated/`
into `data/public/` and creates `.webp` companions for PNG images:

```bash
bash scripts/install_generated_assets.sh
```

Review the script before using it on a release checkout. It is an installation
helper, not a catalog/media validator.

## Time Estimates (B200, 183GB VRAM)

| Asset | Count | Per Item | Total |
|-------|-------|----------|-------|
| Images | 100 | ~8s | ~15 min |
| Videos | 50 | ~26 min | ~22 hrs |
| Music | 100 | ~3 min | ~5 hrs |

## Structure

```
data_generation/
  prompts/           # prompt + name files organized by environment
    users/           # avatars-prompts.txt, avatars-names.txt, banners-prompts.txt, banners-names.txt
    microdin/        # company-logos-prompts.txt, company-logos-names.txt, company-banners-prompts.txt, company-banners-names.txt, posts-prompts.txt, posts-names.txt
    micromail/       # prompts.txt, promptnames.txt
    microtube/       # videoprompts.txt, videopromptnames.txt, channel-*, video-thumbnails-*
    microfy/         # songprompts.txt, songnames.txt, moods-*, track-covers-*, playlist-logos-*, band-logos-*, band-banners-*
    microgram/       # posts-prompts.txt, posts-names.txt, storyprompts.txt, storypromptnames.txt
    microchat/       # teamnames.txt, team-names.txt
  scripts/
    batch_image_gen.py          # main generation script (image/video/audio)
    gen_missing_assets.sh       # historical cluster helper for selected second-pass assets
    submit_video_shards.sh      # historical helper for sharded SLURM video generation
    install_generated_assets.sh # optional helper to copy generated files into data/public/
    run_batch_gen.slurm         # example SLURM job for image generation
    run_video_gen.slurm         # example SLURM job for video generation
    run_video_shard.slurm       # example SLURM job for one video shard
    requirements.txt            # Python dependencies
  docs/
    COMPLIANCE.md               # licensing and data provenance
    REPRODUCTION.md             # generation command guide
```

## Attribution

- FLUX.2-dev - Black Forest Labs
- Wan2.2-T2V-14B - Alibaba/Wan-AI
- ACE-Step - github.com/ace-step/ACE-Step
