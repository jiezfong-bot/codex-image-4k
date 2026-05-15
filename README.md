# codex-image-4k

Codex skill for generating and editing exact-size images through a local Codex OAuth login, without an OpenAI API key.

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

Image-to-image:

```bash
node codex-image-4k/scripts/generate.mjs \
  --image ./reference.png \
  --prompt "Preserve the subject and turn the scene into a cinematic cyberpunk Shanghai rooftop at night" \
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

By default, generated images are saved to:

```text
~/.codex/generated_images/codex-image-4k/
```

Use `--out-dir` to override this per run.

Reference images must be local `png`, `jpg`, `jpeg`, or `webp` files. Use `--image` for one reference or `--images` for a comma-separated list of up to 5 references.

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
