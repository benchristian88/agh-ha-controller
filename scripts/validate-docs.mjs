import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const roots = ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "AGENTS.md", "docs"];

function markdownFiles(entry) {
  const absolute = path.join(root, entry);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return entry.endsWith(".md") ? [absolute] : [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((item) => {
    const child = path.join(absolute, item.name);
    return item.isDirectory()
      ? markdownFiles(path.relative(root, child))
      : item.name.endsWith(".md")
        ? [child]
        : [];
  });
}

function slug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function anchors(file) {
  const counts = new Map();
  const result = new Set();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (!match) continue;
    const base = slug(match[1]);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    result.add(count === 0 ? base : `${base}-${count}`);
  }
  return result;
}

const files = roots.flatMap(markdownFiles);
const errors = [];
const anchorCache = new Map();
const linkPattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line.matchAll(linkPattern)) {
      let target = match[1].trim();
      if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
      target = target.split(/\s+["']/)[0];
      if (/^(?:https?:|mailto:|data:)/i.test(target)) continue;
      const [rawPath, rawAnchor] = target.split("#", 2);
      let decoded;
      try {
        decoded = decodeURIComponent(rawPath);
      } catch {
        errors.push(`${path.relative(root, file)}:${index + 1}: invalid URL encoding: ${target}`);
        continue;
      }
      const destination = decoded
        ? path.resolve(path.dirname(file), decoded)
        : file;
      if (!fs.existsSync(destination)) {
        errors.push(`${path.relative(root, file)}:${index + 1}: missing target: ${target}`);
        continue;
      }
      if (rawAnchor && destination.endsWith(".md")) {
        let known = anchorCache.get(destination);
        if (!known) {
          known = anchors(destination);
          anchorCache.set(destination, known);
        }
        const requested = decodeURIComponent(rawAnchor).toLowerCase();
        if (!known.has(requested)) {
          errors.push(`${path.relative(root, file)}:${index + 1}: missing anchor: ${target}`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated local links and Markdown anchors in ${files.length} files.`);
