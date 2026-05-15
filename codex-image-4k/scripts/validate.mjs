#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

check("required files", () => {
  for (const rel of ["SKILL.md", "agents/openai.yaml", "scripts/generate.mjs"]) {
    if (!fs.existsSync(path.join(root, rel))) throw new Error(`missing ${rel}`);
  }
});

check("skill metadata", () => {
  const skill = read("SKILL.md");
  if (!/^name:\s*codex-image-4k$/m.test(skill)) throw new Error("SKILL.md name mismatch");
  if (!/^\s*version:\s*0\.1\.0$/m.test(skill)) throw new Error("metadata.version missing");
});

check("openai yaml", () => {
  const yaml = read("agents/openai.yaml");
  if (!yaml.includes("$codex-image-4k")) throw new Error("default_prompt must mention $codex-image-4k");
  if (!/allow_implicit_invocation:\s*true/.test(yaml)) throw new Error("implicit invocation policy missing");
});

check("no bundled generated images", () => {
  const generated = path.join(root, "generated");
  if (!fs.existsSync(generated)) return;
  const entries = fs.readdirSync(generated).filter((entry) => !entry.startsWith("."));
  if (entries.length > 0) throw new Error("generated directory is not empty");
});

check("no obvious secrets", () => {
  const secretLike = /(eyJ[A-Za-z0-9_-]{20,}|rt_[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,})/;
  for (const rel of ["SKILL.md", "agents/openai.yaml", "scripts/generate.mjs"]) {
    if (secretLike.test(read(rel))) throw new Error(`secret-like value found in ${rel}`);
  }
});

check("generate script syntax and sizes", () => {
  const syntax = spawnSync(process.execPath, ["-c", path.join(root, "scripts/generate.mjs")], {
    encoding: "utf8",
  });
  if (syntax.status !== 0) throw new Error(syntax.stderr || syntax.stdout);
  const sizes = spawnSync(process.execPath, [path.join(root, "scripts/generate.mjs"), "--list-sizes"], {
    encoding: "utf8",
  });
  if (sizes.status !== 0) throw new Error(sizes.stderr || sizes.stdout);
  const parsed = JSON.parse(sizes.stdout);
  if (parsed.aliases?.["4k"] !== "3840x2160") throw new Error("4k alias mismatch");
});

check("generate script supports image references", () => {
  const help = spawnSync(process.execPath, [path.join(root, "scripts/generate.mjs"), "--help"], {
    encoding: "utf8",
  });
  if (help.status !== 0) throw new Error(help.stderr || help.stdout);
  if (!help.stdout.includes("--image PATH")) throw new Error("--image help missing");
  if (!help.stdout.includes("--images LIST")) throw new Error("--images help missing");
});

const ok = checks.every((entry) => entry.ok);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);
