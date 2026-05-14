# codex-image-4k

Codex skill for generating exact-size images through a local Codex OAuth login, without an OpenAI API key.

The skill reads the current user's local Codex auth file at runtime:

```text
~/.codex/auth.json
```

It does not include, copy, print, or package any login credentials. Each user must already be signed in to Codex on their own machine.

## Install

Copy the `codex-image-4k/` folder into your Codex skills directory, or install it from this repository with your preferred Codex skill workflow.

## Usage

```bash
node codex-image-4k/scripts/generate.mjs \
  --prompt "A clean cinematic poster, no text" \
  --size 3840x2160 \
  --quality high \
  --format png
```

List supported sizes:

```bash
node codex-image-4k/scripts/generate.mjs --list-sizes
```

Run release validation:

```bash
node codex-image-4k/scripts/validate.mjs
```

## Size Aliases

- `4k` / `4k-landscape` -> `3840x2160`
- `4k-portrait` -> `2160x3840`
- `2k-square` -> `2048x2048`
- `2k-landscape` -> `2048x1152`
- `square` -> `1024x1024`
- `landscape` -> `1536x1024`
- `portrait` -> `1024x1536`

## Notes

This skill uses the Codex OAuth image-generation route observed in Codex/OpenClaw-style `image_generation` requests. Endpoint behavior can change, so generated files are always checked for final pixel dimensions.
