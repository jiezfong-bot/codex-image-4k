#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const DEFAULT_BASE_URL = "https://chatgpt.com/backend-api/codex";
const DEFAULT_RESPONSES_MODEL = "gpt-5.5";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_SIZE = "3840x2160";
const DEFAULT_OUTPUT_DIR = path.join(
  process.env.HOME || process.cwd(),
  ".codex",
  "generated_images",
  "codex-image-4k",
);
const VERSION = "0.1.0";
const SUPPORTED_SIZES = new Set([
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
]);
const SIZE_ALIASES = new Map([
  ["4k", "3840x2160"],
  ["4k-landscape", "3840x2160"],
  ["4k-portrait", "2160x3840"],
  ["2k-square", "2048x2048"],
  ["2k-landscape", "2048x1152"],
  ["square", "1024x1024"],
  ["landscape", "1536x1024"],
  ["portrait", "1024x1536"],
]);
const SUPPORTED_QUALITIES = new Set(["low", "medium", "high", "auto"]);
const SUPPORTED_FORMATS = new Set(["png", "jpeg", "webp"]);
const SUPPORTED_BACKGROUNDS = new Set(["opaque", "transparent", "auto"]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

function printHelp() {
  console.log(`codex-image-4k ${VERSION}

Usage:
  node codex-image-4k/scripts/generate.mjs --prompt "..." [options]

Options:
  --prompt TEXT           Image prompt.
  --prompt-file PATH      Read prompt from a UTF-8 text file.
  --size VALUE            Pixel size or alias. Default: 3840x2160.
  --quality VALUE         low, medium, high, or auto. Default: high.
  --format VALUE          png, jpeg, or webp. Default: png.
  --background VALUE      opaque, transparent, or auto.
  --out-dir PATH          Output directory. Default: ~/.codex/generated_images/codex-image-4k.
  --auth-file PATH        Codex auth JSON. Default: ~/.codex/auth.json.
  --fix-size VALUE        resize or fail. Default: resize.
  --timeout MS            Request timeout. Default: 240000.
  --list-sizes            Print supported sizes and aliases.
`);
}

function printSizes() {
  console.log(JSON.stringify({
    ok: true,
    defaultSize: DEFAULT_SIZE,
    sizes: [...SUPPORTED_SIZES],
    aliases: Object.fromEntries(SIZE_ALIASES),
  }, null, 2));
}

function requireChoice(name, value, choices) {
  if (!choices.has(value)) {
    throw new Error(`${name} must be one of: ${[...choices].join(", ")}`);
  }
  return value;
}

function parseSize(value) {
  const original = value;
  value = SIZE_ALIASES.get(value.toLowerCase()) ?? value;
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(value);
  if (!match) {
    throw new Error("--size must look like 3840x2160 or be a supported alias. Run --list-sizes.");
  }
  if (!SUPPORTED_SIZES.has(value)) {
    throw new Error(`Unsupported --size ${value}. Supported: ${[...SUPPORTED_SIZES].join(", ")}`);
  }
  return { width: Number(match[1]), height: Number(match[2]), value, input: original };
}

function decodeJwtPayload(token) {
  const [, payload] = String(token).split(".");
  if (!payload) return null;
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function readCodexAccessToken(authPath) {
  if (!authPath || !fs.existsSync(authPath)) {
    throw new Error(`Codex auth file not found: ${authPath}. Open Codex, sign in with ChatGPT/Codex OAuth, then retry.`);
  }
  const raw = fs.readFileSync(authPath, "utf8");
  const auth = JSON.parse(raw);
  const token = auth.tokens?.access_token;
  if (!token || typeof token !== "string") {
    throw new Error(`No Codex OAuth access_token found in ${authPath}. Make sure Codex is signed in with ChatGPT mode, not only an API key.`);
  }
  const payload = decodeJwtPayload(token);
  if (payload?.exp && Date.now() > payload.exp * 1000) {
    throw new Error("Codex OAuth access_token is expired. Open Codex, sign in or refresh the session, then retry.");
  }
  return token;
}

function readImageSize(filePath, format) {
  const buffer = fs.readFileSync(filePath);
  if (format === "png") {
    if (buffer.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      throw new Error("Output is not a PNG file.");
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  const sips = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], {
    encoding: "utf8",
  });
  if (sips.status !== 0) {
    throw new Error(`Unable to inspect ${format} dimensions without sips.`);
  }
  const width = /pixelWidth:\s*(\d+)/.exec(sips.stdout)?.[1];
  const height = /pixelHeight:\s*(\d+)/.exec(sips.stdout)?.[1];
  if (!width || !height) {
    throw new Error("Unable to parse image dimensions from sips output.");
  }
  return { width: Number(width), height: Number(height) };
}

function resizeWithSips(filePath, target) {
  const sips = spawnSync("sips", ["-z", String(target.height), String(target.width), filePath], {
    encoding: "utf8",
  });
  if (sips.status !== 0) {
    throw new Error(`sips resize failed: ${sips.stderr || sips.stdout}`);
  }
}

function extensionForFormat(format) {
  return format === "jpeg" ? "jpg" : format;
}

function readPrompt(args) {
  const promptFile = args["prompt-file"];
  if (promptFile !== undefined) {
    const filePath = path.resolve(String(promptFile));
    const text = fs.readFileSync(filePath, "utf8").trim();
    if (!text) throw new Error(`Prompt file is empty: ${filePath}`);
    return text;
  }
  return String(args.prompt ?? "").trim();
}

function extractImageResultFromSse(text) {
  let imageBase64 = null;
  let revisedPrompt = null;
  const eventTypes = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (!data || data === "[DONE]") continue;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event.type) eventTypes.push(event.type);
    if (event.error) {
      throw new Error(event.error.message || JSON.stringify(event.error));
    }
    if (event.item?.type === "image_generation_call" && event.item.result) {
      imageBase64 = event.item.result;
      revisedPrompt = event.item.revised_prompt ?? revisedPrompt;
    }
    for (const output of event.response?.output ?? []) {
      if (output?.type === "image_generation_call" && output.result) {
        imageBase64 = output.result;
        revisedPrompt = output.revised_prompt ?? revisedPrompt;
      }
    }
  }
  return { imageBase64, revisedPrompt, eventTypes: [...new Set(eventTypes)] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args["list-sizes"]) {
    printSizes();
    return;
  }

  const prompt = readPrompt(args);
  if (!prompt) throw new Error("--prompt or --prompt-file is required");

  const size = parseSize(String(args.size ?? DEFAULT_SIZE).trim());
  const quality = requireChoice("--quality", String(args.quality ?? "high").trim().toLowerCase(), SUPPORTED_QUALITIES);
  const format = requireChoice("--format", String(args.format ?? "png").trim().toLowerCase(), SUPPORTED_FORMATS);
  const background = args.background
    ? requireChoice("--background", String(args.background).trim().toLowerCase(), SUPPORTED_BACKGROUNDS)
    : undefined;
  const fixSize = String(args["fix-size"] ?? "resize").trim().toLowerCase();
  if (!["resize", "fail"].includes(fixSize)) {
    throw new Error("--fix-size must be resize or fail");
  }

  const authPath = path.resolve(
    String(args["auth-file"] ?? process.env.CODEX_AUTH_FILE ?? path.join(process.env.HOME || "", ".codex/auth.json")),
  );
  const token = readCodexAccessToken(authPath);

  const outDir = path.resolve(String(args["out-dir"] ?? DEFAULT_OUTPUT_DIR));
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const ext = extensionForFormat(format);
  const outPath = path.join(outDir, `image-${size.value}-${stamp}.${ext}`);

  const body = {
    model: String(args["responses-model"] ?? DEFAULT_RESPONSES_MODEL),
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    instructions: "You are an image generation assistant.",
    tools: [
      {
        type: "image_generation",
        model: String(args.model ?? DEFAULT_IMAGE_MODEL),
        size: size.value,
        quality,
        output_format: format,
        ...(background ? { background } : {}),
      },
    ],
    tool_choice: { type: "image_generation" },
    stream: true,
    store: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("request timeout")), Number(args.timeout ?? 240000));
  let response;
  try {
    response = await fetch(`${DEFAULT_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Codex image request failed: HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  const result = extractImageResultFromSse(text);
  if (!result.imageBase64) {
    throw new Error("Codex image request completed but no image_generation_call result was found.");
  }

  const imageBuffer = Buffer.from(result.imageBase64, "base64");
  fs.writeFileSync(outPath, imageBuffer);

  let actual = readImageSize(outPath, format);
  let resized = false;
  if (actual.width !== size.width || actual.height !== size.height) {
    if (fixSize === "fail") {
      throw new Error(`Generated image is ${actual.width}x${actual.height}, expected ${size.value}.`);
    }
    resizeWithSips(outPath, size);
    actual = readImageSize(outPath, format);
    resized = true;
  }
  if (actual.width !== size.width || actual.height !== size.height) {
    throw new Error(`Final image is ${actual.width}x${actual.height}, expected ${size.value}.`);
  }

  const finalBuffer = fs.readFileSync(outPath);
  console.log(JSON.stringify({
    ok: true,
    path: outPath,
    size: `${actual.width}x${actual.height}`,
    requestedSize: size.value,
    requestedSizeInput: size.input,
    format,
    quality,
    resized,
    bytes: finalBuffer.length,
    sha256: crypto.createHash("sha256").update(finalBuffer).digest("hex"),
    revisedPrompt: result.revisedPrompt,
  }, null, 2));
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
