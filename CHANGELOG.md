# Changelog

## 0.2.0 - 2026-05-15

### Features

- Add image-to-image support with `--image` and `--images` reference inputs.
- Accept up to 5 local PNG, JPEG, or WebP reference images.
- Report generation mode and reference-image metadata in script output.

### Documentation

- Document image-to-image usage in the skill instructions and README.

## 0.1.0 - 2026-05-14

### Features

- Add `codex-image-4k` skill for exact-size image generation through local Codex OAuth.
- Support `gpt-image-2` image generation with explicit size, quality, output format, and background options.
- Add size aliases for common square, landscape, portrait, 2K, and 4K outputs.
- Verify final output dimensions and optionally resize to the requested dimensions.
- Add release validation script and Codex UI metadata.

### Security

- Read Codex OAuth credentials only from the user's local machine at runtime.
- Exclude generated images, probe files, and auth/token files from git.
