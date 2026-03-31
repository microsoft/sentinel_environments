#!/usr/bin/env python3
"""
Batch Generation Script - Images, Videos, Audio

Models used for Sentinel Benchmark:
- Images: FLUX.2-dev (black-forest-labs/FLUX.2-dev) - 20 steps, guidance 4.0
- Videos: Wan2.2-T2V-14B (Wan-AI/Wan2.2-T2V-A14B-Diffusers) - 50 steps, 81 frames, 720p
- Audio: ACE-Step-HQ (ACE-Step/ACE-Step-v1-3.5B) - 150 steps, 2 min, 44.1kHz

Usage:
    # Images
    python batch_image_gen.py --mode image --model flux2-dev --prompt_file prompts.txt --output_dir ./output --steps 20

    # Videos (requires 80GB+ VRAM)
    python batch_image_gen.py --mode video --model wan2.2-t2v-14b --prompt_file prompts.txt --output_dir ./videos --steps 50

    # Audio
    python batch_image_gen.py --mode audio --model ace-step-hq --prompt_file prompts.txt --lyrics_file lyrics.txt --output_dir ./music --audio_duration 120

"""

import argparse
import json
import logging
import os
import sys
import time
import warnings
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple
import random

# Configure Hugging Face cache directory.
# Set HF_CACHE_DIR to a path with sufficient storage (e.g. on HPC scratch space).
HF_CACHE_DIR = os.environ.get("HF_CACHE_DIR", os.path.expanduser("~/.cache/huggingface"))
os.environ.setdefault("HF_HOME", HF_CACHE_DIR)
os.environ.setdefault("HF_DATASETS_CACHE", f"{HF_CACHE_DIR}/datasets")
os.environ.setdefault("TRANSFORMERS_CACHE", f"{HF_CACHE_DIR}/transformers")
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", f"{HF_CACHE_DIR}/hub")

warnings.filterwarnings('ignore')

import torch
import torch.distributed as dist
from PIL import Image
from tqdm import tqdm

# Model configurations for IMAGE generation
IMAGE_MODEL_CONFIGS = {
    # FLUX Models (Black Forest Labs)
    "flux2-dev": {
        "model_id": "black-forest-labs/FLUX.2-dev",
        "pipeline": "Flux2Pipeline",
        # model card example uses 50; also notes ~28 is a good trade-off
        "default_steps": 28,
        "guidance_scale": 4.0,
        "dtype": "bfloat16",
        "description": "FLUX.2 [dev] - 32B, best quality FLUX open-weights (gated)"
    },
    "flux-schnell": {
        "model_id": "black-forest-labs/FLUX.1-schnell",
        "pipeline": "FluxPipeline",
        "default_steps": 4,
        "guidance_scale": 0.0,  # Required for schnell
        "max_sequence_length": 256,
        "dtype": "bfloat16",
        "description": "Fast FLUX model - 4 steps, good quality"
    },
    "flux-dev": {
        "model_id": "black-forest-labs/FLUX.1-dev",
        "pipeline": "FluxPipeline",
        "default_steps": 30,
        "guidance_scale": 3.5,
        "max_sequence_length": 512,
        "dtype": "bfloat16",
        "description": "High quality FLUX model - 30-50 steps"
    },
    # Stable Diffusion 3.5
    "sd3.5-large": {
        "model_id": "stabilityai/stable-diffusion-3.5-large",
        "pipeline": "StableDiffusion3Pipeline",
        "default_steps": 28,
        "guidance_scale": 3.5,
        "dtype": "bfloat16",
        "description": "SD3.5 Large - High quality, 8B params"
    },
    "sd3.5-medium": {
        "model_id": "stabilityai/stable-diffusion-3.5-medium",
        "pipeline": "StableDiffusion3Pipeline",
        "default_steps": 28,
        "guidance_scale": 4.5,
        "dtype": "float16",
        "description": "SD3.5 Medium - Balanced quality/speed"
    },
    # SDXL (widely used, well-tested)
    "sdxl": {
        "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
        "pipeline": "StableDiffusionXLPipeline",
        "default_steps": 30,
        "guidance_scale": 7.5,
        "dtype": "float16",
        "description": "SDXL Base - Robust and well-tested"
    },
    "sdxl-turbo": {
        "model_id": "stabilityai/sdxl-turbo",
        "pipeline": "StableDiffusionXLPipeline",  # AutoPipeline works too
        "default_steps": 1,
        "guidance_scale": 0.0,
        "dtype": "float16",
        "description": "SDXL Turbo - 1-step generation, very fast"
    },
    # PixArt (efficient DiT-based)
    "pixart-sigma": {
        "model_id": "PixArt-alpha/PixArt-Sigma-XL-2-1024-MS",
        "pipeline": "PixArtSigmaPipeline",
        "default_steps": 20,
        "guidance_scale": 4.5,
        "dtype": "float16",
        "description": "PixArt Sigma - Efficient, high quality"
    },
}

# Model configurations for VIDEO generation
VIDEO_MODEL_CONFIGS = {
    # Wan 2.2 Models (Alibaba)
    "wan2.2-t2v-14b": {
        "model_id": "Wan-AI/Wan2.2-T2V-A14B-Diffusers",
        "pipeline": "WanPipeline",
        "default_steps": 50,
        "guidance_scale": 5.0,
        "num_frames": 81,
        "fps": 16,
        "flow_shift": 5.0,  # 5.0 for 720P, 3.0 for 480P
        "dtype": "bfloat16",
        "vae_dtype": "float32",
        "description": "Wan2.2 T2V 14B - High quality text-to-video (MoE)"
    },
    "wan2.2-t2v-5b": {
        "model_id": "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
        "pipeline": "WanPipeline",
        "default_steps": 50,
        "guidance_scale": 5.0,
        "num_frames": 81,
        "fps": 24,
        "flow_shift": 5.0,
        "dtype": "bfloat16",
        "vae_dtype": "float32",
        "description": "Wan2.2 TI2V 5B - Fast text-to-video (runs on 4090)"
    },
    "wan2.1-t2v-14b": {
        "model_id": "Wan-AI/Wan2.1-T2V-14B-Diffusers",
        "pipeline": "WanPipeline",
        "default_steps": 50,
        "guidance_scale": 5.0,
        "num_frames": 81,
        "fps": 16,
        "flow_shift": 5.0,
        "dtype": "bfloat16",
        "vae_dtype": "float32",
        "description": "Wan2.1 T2V 14B - High quality text-to-video"
    },
    "wan2.1-t2v-1.3b": {
        "model_id": "Wan-AI/Wan2.1-T2V-1.3B-Diffusers",
        "pipeline": "WanPipeline",
        "default_steps": 50,
        "guidance_scale": 5.0,
        "num_frames": 81,
        "fps": 16,
        "flow_shift": 3.0,  # 3.0 for smaller model
        "dtype": "bfloat16",
        "vae_dtype": "float32",
        "description": "Wan2.1 T2V 1.3B - Lightweight text-to-video"
    },
}

# Model configurations for AUDIO generation
AUDIO_MODEL_CONFIGS = {
    "stable-audio": {
        "model_id": "stabilityai/stable-audio-open-1.0",
        "pipeline": "StableAudioPipeline",
        "default_steps": 100,
        "guidance_scale": 7.0,
        "audio_duration": 10.0,  # seconds
        "sample_rate": 44100,
        "dtype": "float16",
        "description": "Stable Audio Open - Text-to-audio generation"
    },
    # ACE-Step - SOTA text-to-music (December 2025)
    "ace-step": {
        "model_id": "ACE-Step/ACE-Step-v1-3.5B",
        "pipeline": "ACEStepPipeline",
        "default_steps": 60,
        "guidance_scale": 15.0,
        "omega_scale": 10.0,
        "min_guidance_scale": 3.0,
        "guidance_interval": 0.5,
        "audio_duration": 60.0,  # seconds (up to 4 min recommended)
        "sample_rate": 44100,
        "dtype": "bfloat16",
        "description": "ACE-Step - SOTA text-to-music, fast generation (3.5B)"
    },
    # ACE-Step High Quality - for high-VRAM GPUs (A100/H100/B200)
    "ace-step-hq": {
        "model_id": "ACE-Step/ACE-Step-v1-3.5B",
        "pipeline": "ACEStepPipeline",
        "default_steps": 150,  # More steps for higher quality
        "guidance_scale": 22.0,  # Stronger prompt adherence
        "omega_scale": 18.0,  # Better artifact reduction
        "min_guidance_scale": 5.0,
        "guidance_interval": 0.5,
        "audio_duration": 120.0,  # 2 minutes default
        "sample_rate": 44100,
        "dtype": "bfloat16",
        "description": "ACE-Step HQ - Maximum quality (3.5B, 150 steps, for A100/H100/B200)"
    },
    # YuE - Full song generation with vocals (larger model)
    "yue": {
        "model_id": "m-a-p/YuE-s1-7B-anneal-en-cot",
        "stage2_model": "m-a-p/YuE-s2-1B-general",
        "pipeline": "YuEPipeline",
        "default_steps": 3000,  # max_new_tokens
        "guidance_scale": 1.0,
        "repetition_penalty": 1.1,
        "audio_duration": 180.0,  # Full songs ~3 min
        "sample_rate": 44100,
        "dtype": "bfloat16",
        "description": "YuE - Full song generation with vocals (7B+1B, Suno-like quality)"
    },
    # MusicGen - Meta's text-to-music
    "musicgen-large": {
        "model_id": "facebook/musicgen-large",
        "pipeline": "MusicgenPipeline",
        "default_steps": 256,  # max_new_tokens
        "guidance_scale": 3.0,
        "audio_duration": 30.0,  # max ~30s recommended
        "sample_rate": 32000,
        "dtype": "float32",
        "description": "MusicGen Large - Meta's text-to-music (1.5B)"
    },
    "musicgen-medium": {
        "model_id": "facebook/musicgen-medium",
        "pipeline": "MusicgenPipeline",
        "default_steps": 256,
        "guidance_scale": 3.0,
        "audio_duration": 30.0,
        "sample_rate": 32000,
        "dtype": "float32",
        "description": "MusicGen Medium - Balanced quality/speed (1.5B)"
    },
}

# Combined configs for backwards compatibility
MODEL_CONFIGS = IMAGE_MODEL_CONFIGS.copy()


def get_dtype(dtype_str: str) -> torch.dtype:
    """Convert string to torch dtype."""
    dtype_map = {
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "float32": torch.float32,
    }
    return dtype_map.get(dtype_str, torch.float16)


def get_model_configs(mode: str) -> dict:
    """Get the appropriate model configs based on generation mode."""
    if mode == "video":
        return VIDEO_MODEL_CONFIGS
    elif mode == "audio":
        return AUDIO_MODEL_CONFIGS
    else:
        return IMAGE_MODEL_CONFIGS


def load_pipeline(model_name: str, mode: str = "image", device: str = "cuda",
                  memory_optimization: str = "auto",
                  custom_model_path: Optional[str] = None):
    """Load the appropriate pipeline for the model with memory optimizations."""
    from diffusers import (
        FluxPipeline,
        Flux2Pipeline,
        StableDiffusion3Pipeline,
        StableDiffusionXLPipeline,
        PixArtSigmaPipeline,
        AutoPipelineForText2Image,
    )

    # Import video/audio pipelines
    if mode == "video":
        from diffusers import WanPipeline, AutoencoderKLWan
        from diffusers.schedulers import UniPCMultistepScheduler
    elif mode == "audio":
        from diffusers import StableAudioPipeline
        try:
            from transformers import MusicgenForConditionalGeneration, AutoProcessor
            MUSICGEN_AVAILABLE = True
        except ImportError:
            MUSICGEN_AVAILABLE = False
        try:
            from acestep.pipeline_ace_step import ACEStepPipeline
            ACESTEP_AVAILABLE = True
        except ImportError:
            ACESTEP_AVAILABLE = False
        try:
            # YuE requires its own inference setup
            YUE_AVAILABLE = True
        except ImportError:
            YUE_AVAILABLE = False

    configs = get_model_configs(mode)
    config = configs.get(model_name)

    if config is None:
        # Try loading as a custom HuggingFace model
        logging.info(f"Loading custom model: {model_name}")
        if mode == "video":
            pipe = WanPipeline.from_pretrained(
                custom_model_path or model_name,
                torch_dtype=torch.bfloat16,
            )
            return pipe, {"default_steps": 50, "guidance_scale": 5.0, "num_frames": 81, "fps": 16}
        elif mode == "audio":
            pipe = StableAudioPipeline.from_pretrained(
                custom_model_path or model_name,
                torch_dtype=torch.float16,
            )
            return pipe, {"default_steps": 100, "guidance_scale": 7.0, "audio_duration": 10.0}
        else:
            pipe = AutoPipelineForText2Image.from_pretrained(
                custom_model_path or model_name,
                torch_dtype=torch.float16,
                variant="fp16" if torch.cuda.is_available() else None,
            )
            return pipe, {"default_steps": 30, "guidance_scale": 7.5}

    logging.info(f"Loading model: {config['description']}")
    model_id = custom_model_path or config["model_id"]
    dtype = get_dtype(config["dtype"])

    # Handle video pipelines (Wan)
    if mode == "video" and config["pipeline"] == "WanPipeline":
        vae_dtype = get_dtype(config.get("vae_dtype", "float32"))
        vae = AutoencoderKLWan.from_pretrained(model_id, subfolder="vae", torch_dtype=vae_dtype)
        pipe = WanPipeline.from_pretrained(model_id, vae=vae, torch_dtype=dtype)

        # Set scheduler with flow_shift
        flow_shift = config.get("flow_shift", 5.0)
        pipe.scheduler = UniPCMultistepScheduler.from_config(
            pipe.scheduler.config, flow_shift=flow_shift
        )

        # Apply memory optimizations for video (more aggressive by default)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9 if torch.cuda.is_available() else 0
        logging.info(f"VRAM: {vram_gb:.1f}GB")

        if memory_optimization == "auto":
            memory_optimization = "balanced"  # Video models need more aggressive optimization

        if memory_optimization == "aggressive":
            pipe.enable_sequential_cpu_offload()
        elif memory_optimization == "balanced":
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to(device)

        if hasattr(pipe, 'vae'):
            pipe.vae.enable_slicing()
            pipe.vae.enable_tiling()

        return pipe, config

    # Handle audio pipelines
    if mode == "audio":
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9 if torch.cuda.is_available() else 0
        logging.info(f"VRAM: {vram_gb:.1f}GB")

        # ACE-Step pipeline (custom, not diffusers)
        if config["pipeline"] == "ACEStepPipeline":
            if not ACESTEP_AVAILABLE:
                raise ImportError(
                    "ACE-Step is not installed. Install with: "
                    "pip install git+https://github.com/ace-step/ACE-Step.git"
                )
            # Only use CPU offload on lower VRAM GPUs
            cpu_offload = memory_optimization in ["aggressive"] and vram_gb < 24
            pipe = ACEStepPipeline(
                dtype="bfloat16",
                cpu_offload=cpu_offload,
                overlapped_decode=True
            )
            return pipe, config

        # YuE pipeline (two-stage: 7B + 1B)
        if config["pipeline"] == "YuEPipeline":
            # YuE uses subprocess-based inference, return config for special handling
            logging.info("YuE will use subprocess-based inference (7B + 1B two-stage)")
            return {"type": "yue", "config": config}, config

        # MusicGen pipeline (transformers)
        if config["pipeline"] == "MusicgenPipeline":
            if not MUSICGEN_AVAILABLE:
                raise ImportError(
                    "MusicGen requires transformers. Install with: pip install transformers"
                )
            processor = AutoProcessor.from_pretrained(model_id)
            model = MusicgenForConditionalGeneration.from_pretrained(model_id)
            if memory_optimization not in ["aggressive"]:
                model = model.to(device)
            # Return as tuple for special handling
            return (model, processor), config

        # Stable Audio pipeline (diffusers)
        if config["pipeline"] == "StableAudioPipeline":
            pipe = StableAudioPipeline.from_pretrained(model_id, torch_dtype=dtype)
            if memory_optimization in ["aggressive", "balanced", "auto"]:
                pipe.enable_model_cpu_offload()
            else:
                pipe = pipe.to(device)
            return pipe, config

    # Select pipeline class for images
    pipeline_map = {
        "FluxPipeline": FluxPipeline,
        "Flux2Pipeline": Flux2Pipeline,    
        "StableDiffusion3Pipeline": StableDiffusion3Pipeline,
        "StableDiffusionXLPipeline": StableDiffusionXLPipeline,
        "PixArtSigmaPipeline": PixArtSigmaPipeline,
    }

    pipeline_class = pipeline_map.get(config["pipeline"], AutoPipelineForText2Image)

    # Load with appropriate settings
    load_kwargs = {
        "torch_dtype": dtype,
    }

    # Add variant for models that support it
    if config["pipeline"] in ["StableDiffusionXLPipeline"]:
        load_kwargs["variant"] = "fp16"
        load_kwargs["use_safetensors"] = True

    pipe = pipeline_class.from_pretrained(model_id, **load_kwargs)

    # Apply memory optimizations
    vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9 if torch.cuda.is_available() else 0

    if memory_optimization == "auto":
        if vram_gb < 16:
            memory_optimization = "aggressive"
        elif vram_gb < 32:
            memory_optimization = "balanced"
        else:
            memory_optimization = "minimal"

    logging.info(f"VRAM: {vram_gb:.1f}GB, using {memory_optimization} memory optimization")

    if memory_optimization == "aggressive":
        pipe.enable_sequential_cpu_offload()
        if hasattr(pipe, 'vae'):
            pipe.vae.enable_slicing()
            pipe.vae.enable_tiling()
    elif memory_optimization == "balanced":
        pipe.enable_model_cpu_offload()
        if hasattr(pipe, 'vae'):
            pipe.vae.enable_slicing()
    else:  # minimal
        pipe = pipe.to(device)
        if hasattr(pipe, 'vae'):
            pipe.vae.enable_slicing()

    return pipe, config


def load_prompts(prompt_file: str, prompt: Optional[str] = None) -> List[str]:
    """Load prompts from file or single prompt."""
    if prompt:
        return [prompt]

    if not os.path.exists(prompt_file):
        raise FileNotFoundError(f"Prompt file not found: {prompt_file}")

    with open(prompt_file, 'r', encoding='utf-8') as f:
        prompts = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    logging.info(f"Loaded {len(prompts)} prompts from {prompt_file}")
    return prompts


def load_names(names_file: str) -> List[str]:
    """Load custom output names from file (one per line)."""
    if not os.path.exists(names_file):
        raise FileNotFoundError(f"Names file not found: {names_file}")

    with open(names_file, 'r', encoding='utf-8') as f:
        names = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    logging.info(f"Loaded {len(names)} custom output names from {names_file}")
    return names


def generate_filename(prompt: str, idx: int, seed: int, model_name: str,
                      name_prefix: Optional[str] = None, name_digits: int = 3,
                      mode: str = "image", custom_name: Optional[str] = None) -> str:
    """Generate a filename. Uses custom name, prefix, or descriptive name."""
    # Determine file extension based on mode
    ext_map = {"image": "png", "video": "mp4", "audio": "wav"}
    ext = ext_map.get(mode, "png")

    if custom_name:
        # Use exact custom name from names file
        # If the name already has an extension, use it as-is
        if any(custom_name.lower().endswith(f".{e}") for e in ext_map.values()):
            return custom_name
        # Otherwise, append the appropriate extension
        return f"{custom_name}.{ext}" if not custom_name.endswith(f".{ext}") else custom_name
    elif name_prefix:
        # Custom naming: user000.png, user001.mp4, etc.
        return f"{name_prefix}{idx:0{name_digits}d}.{ext}"
    else:
        # Default descriptive naming
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        # Clean prompt for filename (first 50 chars)
        clean_prompt = "".join(c if c.isalnum() or c in " -_" else "_" for c in prompt)
        clean_prompt = "_".join(clean_prompt.split())[:50]
        return f"{model_name}_{idx:05d}_seed{seed}_{clean_prompt}_{timestamp}.{ext}"


def save_metadata(output_dir: str, metadata: dict):
    """Save generation metadata to JSON."""
    metadata_file = os.path.join(output_dir, "generation_metadata.jsonl")
    with open(metadata_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps(metadata) + '\n')


def load_checkpoint(output_dir: str) -> set:
    """Load checkpoint to get already generated indices."""
    checkpoint_file = os.path.join(output_dir, ".checkpoint")
    if os.path.exists(checkpoint_file):
        with open(checkpoint_file, 'r') as f:
            return set(int(line.strip()) for line in f if line.strip())
    return set()


def save_checkpoint(output_dir: str, idx: int):
    """Save checkpoint with completed index."""
    checkpoint_file = os.path.join(output_dir, ".checkpoint")
    with open(checkpoint_file, 'a') as f:
        f.write(f"{idx}\n")


def generate_batch_image(
    pipe,
    prompts: List[str],
    indices: List[int],
    seeds: List[int],
    config: dict,
    args,
    output_dir: str,
    rank: int = 0,
    custom_names: Optional[List[str]] = None,
):
    """Generate a batch of images."""
    gen_kwargs = {
        "prompt": prompts,
        "num_inference_steps": args.steps or config.get("default_steps", 30),
        "guidance_scale": args.guidance_scale if args.guidance_scale is not None else config.get("guidance_scale", 7.5),
        "width": args.width,
        "height": args.height,
        "generator": [torch.Generator(device="cuda").manual_seed(s) for s in seeds],
    }

    # Add model-specific parameters
    if config.get("pipeline") == "FluxPipeline":
        gen_kwargs["max_sequence_length"] = config.get("max_sequence_length", 256)
    
    # Remove guidance_scale for distilled models that don't use it
    if config.get("guidance_scale") == 0.0:
        gen_kwargs["guidance_scale"] = 0.0

    # Generate
    with torch.inference_mode():
        result = pipe(**gen_kwargs)

    # Save images
    for i, (img, prompt, idx, seed) in enumerate(zip(result.images, prompts, indices, seeds)):
        custom_name = custom_names[i] if custom_names else None
        filename = generate_filename(prompt, idx, seed, args.model,
                                      name_prefix=args.name_prefix,
                                      name_digits=args.name_digits,
                                      mode="image",
                                      custom_name=custom_name)
        filepath = os.path.join(output_dir, filename)
        img.save(filepath, quality=95)

        # Save metadata
        save_metadata(output_dir, {
            "index": idx,
            "prompt": prompt,
            "seed": seed,
            "model": args.model,
            "mode": "image",
            "steps": gen_kwargs["num_inference_steps"],
            "guidance_scale": gen_kwargs["guidance_scale"],
            "width": args.width,
            "height": args.height,
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
        })

        # Save checkpoint
        save_checkpoint(output_dir, idx)

    return len(prompts)


def generate_batch_video(
    pipe,
    prompts: List[str],
    indices: List[int],
    seeds: List[int],
    config: dict,
    args,
    output_dir: str,
    rank: int = 0,
    custom_names: Optional[List[str]] = None,
):
    """Generate videos one at a time (video generation is memory intensive)."""
    from diffusers.utils import export_to_video

    num_frames = args.num_frames or config.get("num_frames", 81)
    fps = args.fps or config.get("fps", 16)

    count = 0
    for i, (prompt, idx, seed) in enumerate(zip(prompts, indices, seeds)):
        gen_kwargs = {
            "prompt": prompt,
            "num_inference_steps": args.steps or config.get("default_steps", 50),
            "guidance_scale": args.guidance_scale if args.guidance_scale is not None else config.get("guidance_scale", 5.0),
            "height": args.height,
            "width": args.width,
            "num_frames": num_frames,
            "generator": torch.Generator(device="cuda").manual_seed(seed),
        }

        # Add negative prompt if provided
        if args.negative_prompt:
            gen_kwargs["negative_prompt"] = args.negative_prompt

        # Generate
        with torch.inference_mode():
            result = pipe(**gen_kwargs)

        # Export video frames
        custom_name = custom_names[i] if custom_names else None
        filename = generate_filename(prompt, idx, seed, args.model,
                                      name_prefix=args.name_prefix,
                                      name_digits=args.name_digits,
                                      mode="video",
                                      custom_name=custom_name)
        filepath = os.path.join(output_dir, filename)

        # result.frames is a list of PIL images or numpy arrays
        export_to_video(result.frames[0], filepath, fps=fps)

        # Save metadata
        save_metadata(output_dir, {
            "index": idx,
            "prompt": prompt,
            "seed": seed,
            "model": args.model,
            "mode": "video",
            "steps": gen_kwargs["num_inference_steps"],
            "guidance_scale": gen_kwargs["guidance_scale"],
            "width": args.width,
            "height": args.height,
            "num_frames": num_frames,
            "fps": fps,
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
        })

        # Save checkpoint
        save_checkpoint(output_dir, idx)
        count += 1

    return count


def generate_batch_audio(
    pipe,
    prompts: List[str],
    indices: List[int],
    seeds: List[int],
    config: dict,
    args,
    output_dir: str,
    rank: int = 0,
    custom_names: Optional[List[str]] = None,
    lyrics: Optional[List[str]] = None,
):
    """Generate audio clips using various audio models."""
    import scipy.io.wavfile as wavfile
    import numpy as np

    audio_duration = args.audio_duration or config.get("audio_duration", 10.0)
    sample_rate = config.get("sample_rate", 44100)
    pipeline_type = config.get("pipeline", "StableAudioPipeline")

    count = 0
    for i, (prompt, idx, seed) in enumerate(zip(prompts, indices, seeds)):
        custom_name = custom_names[i] if custom_names else None
        lyric = lyrics[i] if lyrics else None

        filename = generate_filename(prompt, idx, seed, args.model,
                                      name_prefix=args.name_prefix,
                                      name_digits=args.name_digits,
                                      mode="audio",
                                      custom_name=custom_name)
        filepath = os.path.join(output_dir, filename)

        # ACE-Step generation
        if pipeline_type == "ACEStepPipeline":
            infer_steps = args.steps or config.get("default_steps", 60)
            guidance = args.guidance_scale if args.guidance_scale is not None else config.get("guidance_scale", 15.0)
            omega = config.get("omega_scale", 10.0)
            min_guidance = config.get("min_guidance_scale", 3.0)
            guidance_interval = config.get("guidance_interval", 0.5)

            # ACE-Step saves directly to file
            pipe(
                audio_duration=audio_duration,
                prompt=prompt,
                lyrics=lyric or "",
                format="wav",
                save_path=filepath,
                manual_seeds=seed,
                infer_step=infer_steps,
                guidance_scale=guidance,
                scheduler_type="euler",
                cfg_type="apg",
                omega_scale=omega,
                guidance_interval=guidance_interval,
                guidance_interval_decay=0,
                min_guidance_scale=min_guidance,
                use_erg_tag=True,
                use_erg_lyric=True if lyric else False,
                use_erg_diffusion=True,
            )

            # Save metadata
            save_metadata(output_dir, {
                "index": idx,
                "prompt": prompt,
                "lyrics": lyric,
                "seed": seed,
                "model": args.model,
                "mode": "audio",
                "steps": infer_steps,
                "guidance_scale": guidance,
                "omega_scale": omega,
                "min_guidance_scale": min_guidance,
                "audio_duration": audio_duration,
                "sample_rate": sample_rate,
                "filename": filename,
                "timestamp": datetime.now().isoformat(),
            })

        # YuE generation (two-stage: 7B + 1B)
        elif pipeline_type == "YuEPipeline":
            import subprocess
            import tempfile

            # YuE requires lyrics - use prompt as genre if no lyrics provided
            genre_content = prompt
            lyrics_content = lyric or "[verse]\n" + prompt

            # Create temp files for genre and lyrics
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as gf:
                gf.write(genre_content)
                genre_file = gf.name
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as lf:
                lf.write(lyrics_content)
                lyrics_file = lf.name

            max_tokens = args.steps or config.get("default_steps", 3000)
            rep_penalty = config.get("repetition_penalty", 1.1)

            # Run YuE inference via subprocess
            cmd = [
                "python", "-m", "yue.infer",
                "--cuda_idx", "0",
                "--stage1_model", config["model_id"],
                "--stage2_model", config["stage2_model"],
                "--genre_txt", genre_file,
                "--lyrics_txt", lyrics_file,
                "--output_dir", output_dir,
                "--max_new_tokens", str(max_tokens),
                "--repetition_penalty", str(rep_penalty),
                "--run_n_segments", "4",  # Full song
                "--stage2_batch_size", "8",  # High VRAM
            ]

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
                if result.returncode != 0:
                    logging.error(f"YuE error: {result.stderr}")
            finally:
                os.unlink(genre_file)
                os.unlink(lyrics_file)

            save_metadata(output_dir, {
                "index": idx,
                "prompt": prompt,
                "lyrics": lyric,
                "seed": seed,
                "model": args.model,
                "mode": "audio",
                "max_tokens": max_tokens,
                "audio_duration": audio_duration,
                "sample_rate": sample_rate,
                "filename": filename,
                "timestamp": datetime.now().isoformat(),
            })

        # MusicGen generation
        elif pipeline_type == "MusicgenPipeline":
            model, processor = pipe  # Unpack tuple
            max_tokens = args.steps or config.get("default_steps", 256)
            guidance = args.guidance_scale if args.guidance_scale is not None else config.get("guidance_scale", 3.0)

            inputs = processor(
                text=[prompt],
                padding=True,
                return_tensors="pt",
            )
            if hasattr(model, 'device'):
                inputs = {k: v.to(model.device) for k, v in inputs.items()}

            with torch.inference_mode():
                audio_values = model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    guidance_scale=guidance,
                    do_sample=True,
                )

            # MusicGen outputs tensor of shape (batch, channels, samples)
            audio = audio_values[0].cpu().numpy()
            if audio.ndim == 2:
                audio = audio.T  # (samples, channels)
            # Normalize to int16
            audio = audio / np.abs(audio).max() if np.abs(audio).max() > 0 else audio
            audio_int16 = (audio * 32767).astype("int16")
            wavfile.write(filepath, sample_rate, audio_int16)

            save_metadata(output_dir, {
                "index": idx,
                "prompt": prompt,
                "seed": seed,
                "model": args.model,
                "mode": "audio",
                "max_tokens": max_tokens,
                "guidance_scale": guidance,
                "audio_duration": audio_duration,
                "sample_rate": sample_rate,
                "filename": filename,
                "timestamp": datetime.now().isoformat(),
            })

        # Stable Audio generation (original)
        else:
            gen_kwargs = {
                "prompt": prompt,
                "num_inference_steps": args.steps or config.get("default_steps", 100),
                "guidance_scale": args.guidance_scale if args.guidance_scale is not None else config.get("guidance_scale", 7.0),
                "audio_end_in_s": audio_duration,
                "generator": torch.Generator(device="cuda").manual_seed(seed),
            }

            if args.negative_prompt:
                gen_kwargs["negative_prompt"] = args.negative_prompt

            with torch.inference_mode():
                result = pipe(**gen_kwargs)

            audio = result.audios[0].cpu().numpy()
            audio_int16 = (audio * 32767).astype("int16")
            wavfile.write(filepath, sample_rate, audio_int16.T)

            save_metadata(output_dir, {
                "index": idx,
                "prompt": prompt,
                "seed": seed,
                "model": args.model,
                "mode": "audio",
                "steps": gen_kwargs["num_inference_steps"],
                "guidance_scale": gen_kwargs["guidance_scale"],
                "audio_duration": audio_duration,
                "sample_rate": sample_rate,
                "filename": filename,
                "timestamp": datetime.now().isoformat(),
            })

        save_checkpoint(output_dir, idx)
        count += 1

    return count


def generate_batch(
    pipe,
    prompts: List[str],
    indices: List[int],
    seeds: List[int],
    config: dict,
    args,
    output_dir: str,
    rank: int = 0,
    custom_names: Optional[List[str]] = None,
    lyrics: Optional[List[str]] = None,
):
    """Generate a batch based on mode (image/video/audio)."""
    if args.mode == "video":
        return generate_batch_video(pipe, prompts, indices, seeds, config, args, output_dir, rank, custom_names)
    elif args.mode == "audio":
        return generate_batch_audio(pipe, prompts, indices, seeds, config, args, output_dir, rank, custom_names, lyrics)
    else:
        return generate_batch_image(pipe, prompts, indices, seeds, config, args, output_dir, rank, custom_names)


def main():
    parser = argparse.ArgumentParser(
        description="Batch media generation: images, videos, and audio",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # IMAGE: Fast generation with FLUX Schnell (4 steps)
  python batch_image_gen.py --model flux-schnell --prompt_file prompts.txt

  # IMAGE: High quality with FLUX Dev
  python batch_image_gen.py --model flux-dev --prompt_file prompts.txt --steps 50

  # VIDEO: Generate with Wan2.2 (text-to-video)
  python batch_image_gen.py --mode video --model wan2.2-t2v-14b --prompt_file prompts.txt

  # VIDEO: Smaller model that runs on consumer GPUs
  python batch_image_gen.py --mode video --model wan2.1-t2v-1.3b --prompt "A cat walking" --num_frames 49

  # AUDIO: Generate audio with Stable Audio
  python batch_image_gen.py --mode audio --model stable-audio --prompt "upbeat electronic music" --audio_duration 10

  # AUDIO: Generate music with ACE-Step (SOTA text-to-music)
  python batch_image_gen.py --mode audio --model ace-step --prompt "upbeat pop, catchy melody" --audio_duration 60

  # AUDIO: Generate music with lyrics (ACE-Step)
  python batch_image_gen.py --mode audio --model ace-step --prompt_file prompts.txt --lyrics_file lyrics.txt

  # AUDIO: Generate music with MusicGen
  python batch_image_gen.py --mode audio --model musicgen-large --prompt "80s synth pop, energetic" --audio_duration 30

  # AUDIO: Maximum quality on B200/H100/A100 (150 steps, 2 min)
  python batch_image_gen.py --mode audio --model ace-step-hq --prompt "epic orchestral, cinematic" --audio_duration 120

  # AUDIO: Even higher quality with custom steps (up to 200)
  python batch_image_gen.py --mode audio --model ace-step-hq --prompt "jazz fusion" --steps 200 --audio_duration 180

  # AUDIO: Full song with vocals using YuE (Suno-like)
  python batch_image_gen.py --mode audio --model yue --prompt "pop, female vocals, upbeat" --lyrics_file lyrics.txt

  # Resume interrupted generation
  python batch_image_gen.py --model flux-dev --prompt_file prompts.txt --resume

Available IMAGE models:
  flux-schnell  - FLUX.1 Schnell: 4 steps, fast, good quality
  flux-dev      - FLUX.1 Dev: 30-50 steps, high quality
  sd3.5-large   - Stable Diffusion 3.5 Large: 28 steps, high quality
  sd3.5-medium  - Stable Diffusion 3.5 Medium: 28 steps, balanced
  sdxl          - SDXL Base: 30 steps, robust
  sdxl-turbo    - SDXL Turbo: 1 step, very fast
  pixart-sigma  - PixArt Sigma: 20 steps, efficient

Available VIDEO models (--mode video):
  wan2.2-t2v-14b  - Wan2.2 T2V 14B: High quality MoE text-to-video
  wan2.2-t2v-5b   - Wan2.2 TI2V 5B: Fast, runs on 4090
  wan2.1-t2v-14b  - Wan2.1 T2V 14B: High quality text-to-video
  wan2.1-t2v-1.3b - Wan2.1 T2V 1.3B: Lightweight, lower VRAM

Available AUDIO models (--mode audio):
  stable-audio    - Stable Audio Open: Text-to-audio/sound effects
  ace-step        - ACE-Step: SOTA text-to-music (3.5B, 60 steps, fast)
  ace-step-hq     - ACE-Step HQ: Maximum quality (3.5B, 150 steps, for A100/H100/B200)
  yue             - YuE: Full songs with vocals (7B+1B, Suno-like, needs lyrics)
  musicgen-large  - MusicGen Large: Meta's text-to-music (1.5B)
  musicgen-medium - MusicGen Medium: Faster, slightly lower quality

Quality tips for high-VRAM GPUs (A100/H100/B200):
  - Use ace-step-hq for best instrumental music quality
  - Use yue for full songs with vocals (requires --lyrics_file)
  - Increase --steps (up to 200) for even higher quality
  - Increase --audio_duration up to 240s for longer tracks
        """
    )

    # Mode selection (image, video, audio)
    parser.add_argument("--mode", type=str, default="image",
                        choices=["image", "video", "audio"],
                        help="Generation mode: image, video, or audio")

    # Model selection (validated later based on mode)
    parser.add_argument("--model", type=str, default=None,
                        help="Model to use for generation (depends on --mode)")
    parser.add_argument("--custom_model_path", type=str, default=None,
                        help="HuggingFace model ID for custom models")

    # Input/Output
    parser.add_argument("--prompt", type=str, default=None,
                        help="Single prompt to generate")
    parser.add_argument("--prompt_file", type=str, default=None,
                        help="Text file with prompts (one per line)")
    parser.add_argument("--output_dir", type=str, default=None,
                        help="Output directory (defaults to ./generated_images, ./generated_videos, or ./generated_audio)")
    parser.add_argument("--negative_prompt", type=str, default=None,
                        help="Negative prompt (what to avoid)")
    parser.add_argument("--names_file", type=str, default=None,
                        help="Text file with custom output names (one per line, must match prompt count)")

    # Generation parameters
    parser.add_argument("--batch_size", type=int, default=1,
                        help="Batch size for generation (adjust based on VRAM)")
    parser.add_argument("--steps", type=int, default=None,
                        help="Number of inference steps (uses model default if not set)")
    parser.add_argument("--guidance_scale", type=float, default=None,
                        help="Classifier-free guidance scale")
    parser.add_argument("--width", type=int, default=None,
                        help="Width in pixels (default: 1024 for images, 832 for video)")
    parser.add_argument("--height", type=int, default=None,
                        help="Height in pixels (default: 1024 for images, 480 for video)")

    # Video-specific parameters
    parser.add_argument("--num_frames", type=int, default=None,
                        help="Number of frames for video (default: 81, ~5 seconds)")
    parser.add_argument("--fps", type=int, default=None,
                        help="Frames per second for video output (default: 16)")

    # Audio-specific parameters
    parser.add_argument("--audio_duration", type=float, default=None,
                        help="Audio duration in seconds (default: 10 for stable-audio, 60 for ace-step)")
    parser.add_argument("--lyrics_file", type=str, default=None,
                        help="Text file with lyrics for music generation (one per line, ACE-Step only)")

    # Output naming
    parser.add_argument("--name_prefix", type=str, default=None,
                        help="Custom filename prefix (e.g., 'users' produces users000.png, users001.mp4)")
    parser.add_argument("--name_digits", type=int, default=3,
                        help="Number of digits for file numbering (default: 3, e.g., 000-999)")

    # Seed and reproducibility
    parser.add_argument("--seed", type=int, default=-1,
                        help="Base seed (-1 for random)")
    parser.add_argument("--seed_offset_per_image", action="store_true",
                        help="Increment seed for each item")

    # Memory optimization
    parser.add_argument("--memory_optimization", type=str, default="auto",
                        choices=["auto", "minimal", "balanced", "aggressive"],
                        help="Memory optimization level")

    # Resume and checkpointing
    parser.add_argument("--resume", action="store_true",
                        help="Resume from checkpoint (skip already generated)")

    # Distributed
    parser.add_argument("--local_rank", type=int, default=0,
                        help="Local rank for distributed training")

    args = parser.parse_args()

    # Set defaults based on mode
    if args.model is None:
        if args.mode == "video":
            args.model = "wan2.1-t2v-1.3b"  # Default to smaller model
        elif args.mode == "audio":
            args.model = "stable-audio"
        else:
            args.model = "flux-schnell"

    if args.output_dir is None:
        args.output_dir = f"./generated_{args.mode}s"

    if args.width is None:
        args.width = 832 if args.mode == "video" else 1024

    if args.height is None:
        args.height = 480 if args.mode == "video" else 1024

    # Validate arguments
    if args.prompt is None and args.prompt_file is None:
        parser.error("Either --prompt or --prompt_file is required")

    # Setup distributed (if applicable)
    rank = int(os.environ.get("RANK", 0))
    world_size = int(os.environ.get("WORLD_SIZE", 1))
    local_rank = int(os.environ.get("LOCAL_RANK", args.local_rank))

    if world_size > 1:
        torch.cuda.set_device(local_rank)
        dist.init_process_group(backend="nccl")

    # Setup logging
    logging.basicConfig(
        level=logging.INFO if rank == 0 else logging.WARNING,
        format=f"[%(asctime)s][Rank {rank}] %(levelname)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    # Set seed
    if args.seed < 0:
        args.seed = random.randint(0, 2**32 - 1)

    if world_size > 1:
        seed_list = [args.seed]
        dist.broadcast_object_list(seed_list, src=0)
        args.seed = seed_list[0]

    logging.info(f"Base seed: {args.seed}")

    # Load prompts
    prompts = load_prompts(args.prompt_file, args.prompt)
    total_prompts = len(prompts)

    # Load custom output names if provided
    custom_names = None
    if args.names_file:
        custom_names = load_names(args.names_file)
        if len(custom_names) != len(prompts):
            raise ValueError(
                f"Names file has {len(custom_names)} entries but prompt file has {len(prompts)} entries. "
                "They must have the same number of lines."
            )

    # Load lyrics if provided (for ACE-Step music generation)
    lyrics_list = None
    if args.lyrics_file:
        lyrics_list = load_names(args.lyrics_file)  # Reuse load_names function
        if len(lyrics_list) != len(prompts):
            raise ValueError(
                f"Lyrics file has {len(lyrics_list)} entries but prompt file has {len(prompts)} entries. "
                "They must have the same number of lines."
            )
        logging.info(f"Loaded {len(lyrics_list)} lyrics from {args.lyrics_file}")

    # Load checkpoint if resuming
    completed = set()
    if args.resume:
        completed = load_checkpoint(args.output_dir)
        logging.info(f"Resuming: {len(completed)}/{total_prompts} already completed")

    # Filter out completed prompts (include custom name and lyrics if available)
    work_items = []
    for i, p in enumerate(prompts):
        if i not in completed:
            name = custom_names[i] if custom_names else None
            lyric = lyrics_list[i] if lyrics_list else None
            work_items.append((i, p, name, lyric))

    # Distribute work across ranks
    if world_size > 1:
        work_items = work_items[rank::world_size]

    logging.info(f"This rank will process {len(work_items)} prompts")

    if len(work_items) == 0:
        logging.info("No work to do - all prompts already generated")
        return

    # Load model
    logging.info(f"Loading {args.mode} model: {args.model}...")
    start_load = time.time()
    pipe, config = load_pipeline(
        args.model,
        mode=args.mode,
        device=f"cuda:{local_rank}" if torch.cuda.is_available() else "cpu",
        memory_optimization=args.memory_optimization,
        custom_model_path=args.custom_model_path
    )
    logging.info(f"Model loaded in {time.time() - start_load:.1f}s")

    # Generate content
    logging.info(f"Starting {args.mode} generation...")
    start_gen = time.time()
    generated_count = 0

    # Process in batches
    pbar = tqdm(total=len(work_items), desc="Generating", disable=rank != 0)

    for batch_start in range(0, len(work_items), args.batch_size):
        batch_items = work_items[batch_start:batch_start + args.batch_size]
        batch_indices = [item[0] for item in batch_items]
        batch_prompts = [item[1] for item in batch_items]
        batch_names = [item[2] for item in batch_items] if batch_items[0][2] is not None else None
        batch_lyrics = [item[3] for item in batch_items] if batch_items[0][3] is not None else None

        # Generate seeds for this batch
        if args.seed_offset_per_image:
            batch_seeds = [args.seed + idx for idx in batch_indices]
        else:
            batch_seeds = [args.seed] * len(batch_items)

        try:
            count = generate_batch(
                pipe=pipe,
                prompts=batch_prompts,
                indices=batch_indices,
                seeds=batch_seeds,
                config=config,
                args=args,
                output_dir=args.output_dir,
                rank=rank,
                custom_names=batch_names,
                lyrics=batch_lyrics,
            )
            generated_count += count
            pbar.update(count)

        except Exception as e:
            logging.error(f"Error generating batch starting at index {batch_indices[0]}: {e}")
            # Continue with next batch instead of failing completely
            continue

    pbar.close()

    # Synchronize distributed processes
    if world_size > 1:
        dist.barrier()

    elapsed = time.time() - start_gen
    unit = {"image": "images", "video": "videos", "audio": "clips"}.get(args.mode, "items")
    rate_unit = {"image": "img", "video": "vid", "audio": "clip"}.get(args.mode, "item")
    logging.info(f"Generated {generated_count} {unit} in {elapsed:.1f}s ({generated_count/elapsed:.2f} {rate_unit}/s)")

    if world_size > 1:
        dist.destroy_process_group()

    logging.info("Done!")


if __name__ == "__main__":
    main()
