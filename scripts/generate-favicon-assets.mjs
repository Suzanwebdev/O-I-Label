/**
 * Generate the O & I Label favicon / app-icon asset system from the approved
 * ONI monogram master. Does not modify the master file.
 *
 * Usage: node scripts/generate-favicon-assets.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const MASTER = path.join(ROOT, "brand", "oni-monogram-master.jpg");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/**
 * Target mark width as a fraction of the square canvas.
 * Tuned for small-size recognisability while keeping clear space.
 */
const WIDTH_FILL = {
  16: 0.9,
  32: 0.74,
  48: 0.78,
  180: 0.72,
  512: 0.72,
};

function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];
  for (const png of pngBuffers) {
    entries.push({ size: png.length, offset });
    offset += png.length;
  }
  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);
  let entryAt = 6;
  for (let i = 0; i < count; i += 1) {
    const dim = [16, 32, 48][i] ?? 0;
    buf.writeUInt8(dim >= 256 ? 0 : dim, entryAt);
    buf.writeUInt8(dim >= 256 ? 0 : dim, entryAt + 1);
    buf.writeUInt8(0, entryAt + 2);
    buf.writeUInt8(0, entryAt + 3);
    buf.writeUInt16LE(1, entryAt + 4);
    buf.writeUInt16LE(32, entryAt + 6);
    buf.writeUInt32LE(entries[i].size, entryAt + 8);
    buf.writeUInt32LE(entries[i].offset, entryAt + 12);
    entryAt += 16;
  }
  for (let i = 0; i < count; i += 1) {
    pngBuffers[i].copy(buf, entries[i].offset);
  }
  return buf;
}

async function contentBBox(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  let ink = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      if (data[i] <= 245 || data[i + 1] <= 245 || data[i + 2] <= 245) {
        ink += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!ink) throw new Error("No ink detected in master artwork");
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1, ink };
}

/** Tight crop of the monogram with a tiny fringe so antialiasing is preserved. */
async function extractMark(masterPath) {
  const meta = await sharp(masterPath).metadata();
  const bbox = await contentBBox(masterPath);
  const fringe = Math.max(2, Math.round(Math.max(bbox.width, bbox.height) * 0.02));
  const left = Math.max(0, bbox.minX - fringe);
  const top = Math.max(0, bbox.minY - fringe);
  const right = Math.min(meta.width - 1, bbox.maxX + fringe);
  const bottom = Math.min(meta.height - 1, bbox.maxY + fringe);
  const width = right - left + 1;
  const height = bottom - top + 1;
  const mark = await sharp(masterPath)
    .extract({ left, top, width, height })
    .flatten({ background: WHITE })
    .png()
    .toBuffer();
  return { mark, bbox, fringe, extract: { left, top, width, height } };
}

async function renderAtSize(mark, canvasSize, widthFill, { rgba = false } = {}) {
  const markMeta = await sharp(mark).metadata();
  const aspect = markMeta.height / markMeta.width;

  let targetW = Math.round(canvasSize * widthFill);
  let targetH = Math.round(targetW * aspect);

  // Keep at least 1px clear space on every side (2px total).
  const maxW = Math.max(1, canvasSize - 2);
  const maxH = Math.max(1, canvasSize - 2);
  if (targetW > maxW) {
    targetW = maxW;
    targetH = Math.max(1, Math.round(targetW * aspect));
  }
  if (targetH > maxH) {
    targetH = maxH;
    targetW = Math.max(1, Math.round(targetH / aspect));
  }

  const resized = await sharp(mark)
    .resize(targetW, targetH, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      background: WHITE,
    })
    .png()
    .toBuffer();

  let pipeline = sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 3,
      background: WHITE,
    },
  }).composite([
    {
      input: resized,
      left: Math.round((canvasSize - targetW) / 2),
      top: Math.round((canvasSize - targetH) / 2),
    },
  ]);

  if (rgba) pipeline = pipeline.ensureAlpha();

  const buf = await pipeline
    .flatten({ background: WHITE })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return { buf, targetW, targetH, widthFillActual: targetW / canvasSize };
}

async function measureInkWidthRatio(pngBuf, canvasSize) {
  const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let maxX = 0;
  let ink = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      if (data[i] <= 245 || data[i + 1] <= 245 || data[i + 2] <= 245) {
        ink += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (!ink) return 0;
  return (maxX - minX + 1) / canvasSize;
}

const masterMeta = await sharp(MASTER).metadata();
console.log("master (untouched read)", {
  path: path.relative(ROOT, MASTER),
  format: masterMeta.format,
  width: masterMeta.width,
  height: masterMeta.height,
});

const { mark, bbox, fringe, extract } = await extractMark(MASTER);
console.log("mark extract", { bbox, fringe, extract });

const sizes = [16, 32, 48, 180, 512];
const rendered = {};
for (const size of sizes) {
  const rgba = size === 16 || size === 32 || size === 48;
  const result = await renderAtSize(mark, size, WIDTH_FILL[size], { rgba });
  const measured = await measureInkWidthRatio(result.buf, size);
  rendered[size] = result;
  console.log(
    `compose ${size}x${size}: targetFill=${WIDTH_FILL[size]} placed=${result.targetW}x${result.targetH} measuredInkWidth=${measured.toFixed(3)}`
  );
}

const ico = buildIco([rendered[16].buf, rendered[32].buf, rendered[48].buf]);
writeFileSync(path.join(ROOT, "app", "favicon.ico"), ico);
console.log(`wrote app/favicon.ico (${ico.length} bytes, entries=3)`);

for (const [size, file] of [
  [512, "icon.png"],
  [180, "apple-icon.png"],
]) {
  const filePath = path.join(ROOT, "app", file);
  writeFileSync(filePath, rendered[size].buf);
  const m = await sharp(rendered[size].buf).metadata();
  console.log(`wrote app/${file} ${m.width}x${m.height} (${rendered[size].buf.length} bytes)`);
}

writeFileSync(
  path.join(ROOT, "brand", "README.md"),
  [
    "# O & I Label brand assets",
    "",
    "`oni-monogram-master.jpg` is an unmodified copy of the approved ONI monogram.",
    "",
    "Production favicon outputs (regenerate with `node scripts/generate-favicon-assets.mjs`):",
    "- `app/favicon.ico` — 16 / 32 / 48 (optically scaled for small-size clarity)",
    "- `app/icon.png` — 512 × 512",
    "- `app/apple-icon.png` — 180 × 180",
    "",
    "Do not edit the master; regenerate icons from it instead.",
    "",
  ].join("\n")
);

console.log("done");
