/**
 * Downloads Latin-subset woff2 files for the storefront fonts into app/fonts.
 * Run: node scripts/download-site-fonts.mjs
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = "app/fonts";
const ua = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

async function css(familyQuery) {
  const url = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
  const res = await fetch(url, { headers: ua });
  if (!res.ok) throw new Error(`CSS ${res.status} for ${url}`);
  return res.text();
}

function latinSrc(cssText) {
  const faces = cssText
    .split("@font-face")
    .slice(1)
    .map((block) => {
      const src = block.match(/src:\s*url\(([^)]+)\)/)?.[1]?.replace(/['"]/g, "");
      const unicodeRange = block.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim() ?? "";
      return { src, unicodeRange };
    })
    .filter((f) => f.src);
  const latin = faces.find(
    (f) =>
      !f.unicodeRange ||
      f.unicodeRange.includes("U+0000-00FF") ||
      f.unicodeRange.includes("U+0000-007F")
  );
  if (!latin?.src) throw new Error("No latin face found in CSS response");
  return latin.src;
}

async function downloadFile(url, file) {
  const res = await fetch(url, { headers: ua });
  if (!res.ok) throw new Error(`font ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(OUT_DIR, file), buf);
  console.log(" wrote", file, buf.length, path.basename(url));
  return `./fonts/${file}`;
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const manropeCss = await css("family=Manrope:wght@200..800");
await downloadFile(latinSrc(manropeCss), "manrope-normal-200800.woff2");

for (const weight of ["400", "500", "600", "700"]) {
  for (const [ital, style] of [
    [0, "normal"],
    [1, "italic"],
  ]) {
    const text = await css(`family=Cormorant+Garamond:ital,wght@${ital},${weight}`);
    const file = `cormorant-garamond-${style}-${weight}.woff2`;
    await downloadFile(latinSrc(text), file);
  }
}

await writeFile(
  path.join(OUT_DIR, "README.md"),
  [
    "# Storefront fonts",
    "",
    "Self-hosted Latin subsets used by `app/layout.tsx` via `next/font/local`.",
    "Regenerate with: `node scripts/download-site-fonts.mjs`",
    "",
  ].join("\n")
);

console.log("done");
