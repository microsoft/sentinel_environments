# Reproduction

## Setup
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
huggingface-cli login  # need access to gated models
```

For B200/Blackwell: `pip install torch --index-url https://download.pytorch.org/whl/cu128`

## Generate Everything

**Users:**
```bash
python batch_image_gen.py --mode image --model flux2-dev --prompt_file prompts/users/avatars-prompts.txt --output_dir output/users/avatars --width 800 --height 800 --steps 20
python batch_image_gen.py --mode image --model flux2-dev --prompt_file prompts/users/banners-prompts.txt --output_dir output/users/banners --width 1584 --height 396 --steps 20
```

**MicroTube Videos:**
```bash
python batch_image_gen.py --mode video --model wan2.2-t2v-14b --prompt_file prompts/microtube/videoprompts.txt --output_dir output/microtube/videos --width 1280 --height 720 --steps 50
```

**MicroFy Music:**
```bash
python batch_image_gen.py --mode audio --model ace-step-hq --prompt_file prompts/microfy/songprompts.txt --output_dir output/microfy/songs --audio_duration 120
```

## Time Estimates (B200)
| Asset | Count | Per Item | Total |
|-------|-------|----------|-------|
| Images | 100 | ~8s | ~15 min |
| Videos | 50 | ~26 min | ~22 hrs |
| Music | 100 | ~3 min | ~5 hrs |
