# Sentinel Benchmark - Synthetic Data Generation

**All data is 100% AI-generated. No real users, PII, or copyrighted content.**

## Hardware
NVIDIA B200 (183GB VRAM) on HiPerGator HPC, CUDA 12.8

## Models
| Type | Model | License |
|------|-------|---------|
| Images | FLUX.2-dev | Non-commercial (research OK) |
| Videos | Wan2.2-T2V-14B | Apache 2.0 |
| Audio | ACE-Step-HQ | MIT |

## Data Generated
| Environment | Description | Assets |
|-------------|-------------|--------|
| Users | Synthetic profiles | 100 avatars + 100 banners |
| MicroDin | Professional network | 50 company logos/banners, 20 posts |
| MicroMail | Email app | 25 document attachments |
| MicroTube | Video platform | 19 channels, 50 videos, 50 thumbnails |
| MicroFy | Music streaming | 100 music tracks + covers |
| MicroGram | Photo sharing | 100+ posts, 50 stories |
| MicroChat | Team messaging | 10 team photos |

## Usage
```bash
pip install -r scripts/requirements.txt
huggingface-cli login

# Images
python scripts/batch_image_gen.py --mode image --model flux2-dev --prompt_file prompts.txt --output_dir ./output

# Videos
python scripts/batch_image_gen.py --mode video --model wan2.2-t2v-14b --prompt_file prompts.txt --output_dir ./videos

# Audio
python scripts/batch_image_gen.py --mode audio --model ace-step-hq --prompt_file prompts.txt --output_dir ./music
```

## Structure
```
├── scripts/        # Generation scripts, SLURM jobs, requirements
├── prompts/        # Prompt files by environment
├── docs/           # Compliance and reproduction guides
```

## Attribution
- FLUX.2-dev - Black Forest Labs
- Wan2.2-T2V-14B - Alibaba/Wan-AI
- ACE-Step - github.com/ace-step/ACE-Step
