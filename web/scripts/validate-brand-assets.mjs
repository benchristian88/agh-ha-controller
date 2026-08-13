import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = resolve(webRoot, "..");
const publicRoot = resolve(webRoot, "public");
const sourceRoot = resolve(
  repositoryRoot,
  "assets/branding/source/Atlas_Brand_Assets_v3",
);

const expectedBranding = [
  "atlas-dns-lockup-dark.svg",
  "atlas-dns-lockup-light.svg",
  "atlas-mark-black.svg",
  "atlas-mark-color-dark.svg",
  "atlas-mark-color-light.svg",
  "atlas-mark-white.svg",
];
const expectedPublicIcons = [
  "favicon.ico",
  "favicon.svg",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function bytes(path) {
  return readFile(path);
}

async function assertEqualFiles(runtime, source) {
  const [actual, canonical] = await Promise.all([bytes(runtime), bytes(source)]);
  assert(actual.equals(canonical), `${runtime} differs from approved V3 source`);
}

async function pngDimensions(path) {
  const content = await bytes(path);
  assert(content.subarray(1, 4).toString() === "PNG", `${path} is not PNG`);
  return [content.readUInt32BE(16), content.readUInt32BE(20)];
}

const manifest = JSON.parse(
  await readFile(resolve(publicRoot, "manifest.webmanifest"), "utf8"),
);
assert(manifest.name === "Atlas DNS Controller", "manifest product name is incorrect");
assert(manifest.short_name === "Atlas DNS", "manifest short product name is incorrect");
assert(manifest.start_url === "/" && manifest.scope === "/", "manifest scope changed");
assert(manifest.display === "standalone", "manifest display must be standalone");
assert(Array.isArray(manifest.icons) && manifest.icons.length === 2, "manifest must have one 192px and one 512px icon");

const manifestIcons = new Map(manifest.icons.map((icon) => [icon.src, icon]));
for (const size of [192, 512]) {
  const source = `/android-chrome-${size}x${size}.png`;
  const icon = manifestIcons.get(source);
  assert(icon?.sizes === `${size}x${size}`, `${source} has wrong manifest size`);
  assert(icon?.type === "image/png", `${source} has wrong manifest type`);
}

const brandingFiles = (await readdir(resolve(publicRoot, "branding"))).sort();
assert(
  JSON.stringify(brandingFiles) === JSON.stringify(expectedBranding.sort()),
  `runtime branding set is inconsistent: ${brandingFiles.join(", ")}`,
);

for (const name of expectedPublicIcons) {
  await bytes(resolve(publicRoot, name));
}
const themeBootstrap = await readFile(resolve(publicRoot, "theme-init.js"), "utf8");
assert(
  themeBootstrap.includes("atlas-dns.theme") &&
    themeBootstrap.includes("prefers-color-scheme: dark"),
  "theme bootstrap does not resolve the documented preference",
);

for (const name of expectedBranding.filter((name) => name.startsWith("atlas-mark"))) {
  await assertEqualFiles(
    resolve(publicRoot, "branding", name),
    resolve(sourceRoot, "SVG/PRIMARY_ANGLED_GAP", name),
  );
}
for (const theme of ["light", "dark"]) {
  const lockup = await readFile(
    resolve(publicRoot, "branding", `atlas-dns-lockup-${theme}.svg`),
    "utf8",
  );
  assert(
    lockup.includes('id="atlas-v3-mark"') &&
      lockup.includes("#2563EB") &&
      lockup.includes("#0EA5A3"),
    `${theme} lockup is not the supplied Atlas V3 family`,
  );
}
for (const name of expectedPublicIcons) {
  const sourcePath = name === "favicon.ico" ? "WEB/favicon.ico" : `WEB/${name}`;
  await assertEqualFiles(resolve(publicRoot, name), resolve(sourceRoot, sourcePath));
}

for (const [name, size] of [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
]) {
  const [width, height] = await pngDimensions(resolve(publicRoot, name));
  assert(width === size && height === size, `${name} must be ${size}x${size}`);
}

const index = await readFile(resolve(webRoot, "index.html"), "utf8");
for (const name of [
  "manifest.webmanifest",
  "favicon.ico",
  "favicon.svg",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "theme-init.js",
]) {
  assert(index.includes(`/${name}`), `index.html does not reference /${name}`);
}
assert(!index.includes("app-mark.svg"), "legacy app mark is still referenced");
assert(!index.includes("<script>"), "inline script would violate production CSP");

console.log("Atlas branding, favicon, Apple, and PWA assets validated.");
