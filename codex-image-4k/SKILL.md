---
name: codex-image-4k
description: Generate exact-size images through the local Codex OAuth session, using the ChatGPT Codex Responses image_generation path with gpt-image-2. Use when the user wants 4K, 2K, or explicit pixel dimensions such as 3840x2160, 2160x3840, 2048x2048, 1536x1024, or 1024x1536 without an OpenAI API key.
metadata:
  short-description: Generate exact-size images with local Codex OAuth
  version: 0.1.0
---

# Codex Image 4K

Use this skill when the user wants image generation with explicit pixel dimensions and has a local Codex OAuth login but no OpenAI API key.

This skill uses an unofficial Codex OAuth image-generation route that matches the Codex/OpenClaw-style `image_generation` request shape. Treat endpoint behavior as best-effort and verify output dimensions after every run.

The bundled script reads the current user's local Codex auth file at runtime:

```text
~/.codex/auth.json
```

Never copy, commit, print, or package this file. The script only reads the access token in memory and redacts authentication details from output.

## Quick Checks

When this skill is invoked, resolve script paths relative to this `SKILL.md` file's directory. Do not assume the current working directory contains `codex-image-4k/`.

List supported sizes and aliases:

```bash
node /path/to/codex-image-4k/scripts/generate.mjs --list-sizes
```

## Generate

Run:

```bash
node /path/to/codex-image-4k/scripts/generate.mjs \
  --prompt "A clean editorial poster, crisp geometric composition, no text" \
  --size 3840x2160 \
  --quality high \
  --format png
```

The script saves the image under `~/.codex/generated_images/codex-image-4k/` by default and verifies the actual pixel dimensions. If the generated file does not match the requested dimensions, it tries to resize to the exact target dimensions with `sips` on macOS when `--fix-size resize` is enabled, which is the default.

## Parameters

- `--prompt`: required image prompt.
- `--prompt-file`: optional UTF-8 text file to read the prompt from instead of `--prompt`.
- `--size`: exact pixel size or alias. Supported presets: `1024x1024`, `1536x1024`, `1024x1536`, `2048x2048`, `2048x1152`, `3840x2160`, `2160x3840`.
- Size aliases: `4k`, `4k-landscape`, `4k-portrait`, `2k-square`, `2k-landscape`, `square`, `landscape`, `portrait`.
- `--quality`: optional, one of `low`, `medium`, `high`, `auto`. Default: `high`.
- `--format`: optional, one of `png`, `jpeg`, `webp`. Default: `png`.
- `--background`: optional, one of `opaque`, `transparent`, `auto`.
- `--model`: optional image model. Default: `gpt-image-2`.
- `--responses-model`: optional mainline Responses model. Default: `gpt-5.5`.
- `--out-dir`: optional output directory. Default: `~/.codex/generated_images/codex-image-4k`.
- `--fix-size`: optional, `resize` or `fail`. Default: `resize`.
- `--auth-file`: optional path to a Codex auth JSON file. Default: `~/.codex/auth.json`, or `CODEX_AUTH_FILE` if set.
- `--timeout`: optional request timeout in milliseconds. Default: `240000`.

## Safety

- Do not include `~/.codex/auth.json` in the skill folder.
- Do not write tokens to logs, JSON metadata, or final answers.
- If authentication fails, ask the user to open Codex and sign in again, then rerun.
- If sharing this skill, share only the skill folder and source files, not generated images unless intentionally included.
