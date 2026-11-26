// THE WORLD TODAY — Wednesday, 25 November 2026
// A program that draws a newspaper front page summing up the day's world
// news, using only the Node standard library. No network, no downloaded
// images: every pixel is computed here — masthead, text from a hand-built
// 5x7 bitmap font, a dusk illustration of the Riyadh skyline with its
// tallest tower struck, and the PNG bytes themselves (hand-rolled encoder).
//
// Usage: node main.ts            (writes /output/entry.png)
//        OUTPUT_DIR=/tmp/out node main.ts   (local testing)
// Deterministic: two runs produce byte-identical output.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

// --- Canvas: plain RGB pixel buffer, 1024 x 1024. -------------------------
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

type RGB = [number, number, number];

const PAPER: RGB = [247, 242, 230];
const INK: RGB = [24, 24, 24];
const RED: RGB = [168, 24, 34];
const DUSK: RGB = [232, 178, 120];
const DUSK2: RGB = [214, 138, 96];
const SKYLINE: RGB = [58, 52, 66];
const SKYLINE2: RGB = [84, 76, 92];
const FLAME: RGB = [235, 92, 10];
const EMBER: RGB = [248, 183, 0];
const SMOKE: RGB = [96, 96, 100];
const WHITE: RGB = [250, 250, 247];
const GREY: RGB = [92, 92, 88];
const GOLD: RGB = [176, 132, 40];

function fill(color: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = color[0];
    px[i * 3 + 1] = color[1];
    px[i * 3 + 2] = color[2];
  }
}

function dot(x: number, y: number, color: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = color[0];
  px[i + 1] = color[1];
  px[i + 2] = color[2];
}

function rect(x: number, y: number, w: number, h: number, color: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
    }
  }
}

function rule(x: number, y: number, w: number, color: RGB, thick = 1): void {
  rect(x, y, w, thick, color);
}

function disc(cx: number, cy: number, r: number, color: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) dot(x, y, color);
    }
  }
}

// Filled triangle via scanline edge intersections.
function tri(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, color: RGB,
): void {
  const lo = Math.max(0, Math.min(ay, by, cy));
  const hi = Math.min(H - 1, Math.max(ay, by, cy));
  const edges: Array<[number, number, number, number]> = [
    [ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay],
  ];
  for (let y = lo; y <= hi; y++) {
    const xs: number[] = [];
    for (const [x1, y1, x2, y2] of edges) {
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
        xs.push(Math.round(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1)));
      }
    }
    if (xs.length >= 2) {
      for (let x = Math.min(...xs); x <= Math.max(...xs); x++) dot(x, y, color);
    }
  }
}

// --- 5x7 bitmap font, drawn by hand. Text is uppercased before drawing. ---
const FONT: Record<string, string[]> = {
  "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "•": ["00000", "00000", "01110", "01110", "01110", "00000", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
};

const STEP = 6; // glyph width + tracking

function textWidth(text: string, scale: number): number {
  const t = text.toUpperCase();
  return t.length === 0 ? 0 : (t.length * STEP - 1) * scale;
}

function drawText(
  x: number, y: number, text: string, scale: number, color: RGB,
  align: "left" | "center" = "left",
): void {
  const upper = text.toUpperCase();
  let cx = align === "center" ? x - Math.floor(textWidth(upper, scale) / 2) : x;
  for (const ch of upper) {
    const rows = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (rows[r][c] === "1") rect(cx + c * scale, y + r * scale, scale, scale, color);
      }
    }
    cx += STEP * scale;
  }
}

function wrap(text: string, maxWidth: number, scale: number): string[] {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line === "" ? word : line + " " + word;
    if (textWidth(next, scale) <= maxWidth || line === "") line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

function paragraph(
  x: number, y: number, maxWidth: number, text: string,
  scale: number, color: RGB, gap = 4,
): number {
  const lines = wrap(text, maxWidth, scale);
  const step = 7 * scale + gap;
  lines.forEach((ln, i) => drawText(x, y + i * step, ln, scale, color));
  return y + lines.length * step;
}

// --- PNG encoder: IHDR + IDAT (zlib, filter 0) + IEND, CRC32 in code. -----
const CRC: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = W * 3 + 1;
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Lead illustration: Riyadh at dusk, tallest tower struck. --------------
function drawRiyadh(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, Math.floor(h * 0.55), DUSK);
  rect(x, y + Math.floor(h * 0.55), w, h - Math.floor(h * 0.55), DUSK2);
  disc(x + 52, y + 44, 24, EMBER); // low sun
  // Distant towers.
  rect(x + 8, y + 128, 34, 124, SKYLINE2);
  rect(x + 52, y + 150, 26, 102, SKYLINE2);
  rect(x + 300, y + 140, 30, 112, SKYLINE2);
  rect(x + 340, y + 118, 40, 134, SKYLINE2);
  // The tallest tower: twisted profile, lit windows, struck halfway up.
  const tx = x + 168;
  const ty = y + 18;
  rect(tx, ty, 56, 234, SKYLINE);
  rect(tx + 8, ty + 12, 40, 6, GOLD);
  rect(tx + 8, ty + 30, 40, 6, GOLD);
  for (let r = 0; r < 9; r++) {
    rect(tx + 10, ty + 58 + r * 18, 36, 5, GOLD);
  }
  // Impact scar and flames halfway up the tower.
  rect(tx + 6, ty + 96, 44, 16, INK);
  tri(tx + 8, ty + 100, tx + 20, ty + 62, tx + 32, ty + 100, FLAME);
  tri(tx + 30, ty + 100, tx + 42, ty + 70, tx + 52, ty + 100, EMBER);
  tri(tx + 44, ty + 100, tx + 52, ty + 76, tx + 60, ty + 100, FLAME);
  // Smoke drifting up and away from the tower.
  disc(tx + 26, ty + 40, 12, SMOKE);
  disc(tx + 44, ty + 20, 16, SMOKE);
  disc(tx + 62, ty + 2, 12, SMOKE);
  // A small drone, upper right.
  rect(x + 318, y + 52, 22, 4, INK);
  rect(x + 326, y + 44, 6, 20, INK);
  disc(x + 316, y + 52, 3, INK);
  disc(x + 342, y + 52, 3, INK);
  // Ground line and street lights.
  rect(x, y + h - 8, w, 8, INK);
  for (let i = 0; i < 6; i++) disc(x + 24 + i * 66, y + h - 16, 3, EMBER);
}

function storyCell(
  x: number, y: number, w: number,
  kicker: string, headline: string, body: string,
): void {
  rect(x, y, 64, 4, RED);
  drawText(x, y + 12, kicker, 2, RED);
  const hy = paragraph(x, y + 34, w, headline, 2, INK, 3);
  paragraph(x, hy + 6, w, body, 2, GREY, 3);
}

function buildPage(): void {
  fill(PAPER);
  const M = 28;
  const CW = W - M * 2;

  rect(M - 6, M - 6, CW + 12, H - (M - 6) * 2, INK);
  rect(M - 3, M - 3, CW + 6, H - (M - 3) * 2, PAPER);

  // Masthead.
  drawText(W / 2, 52, "THE WORLD TODAY", 6, INK, "center");
  rule(M, 108, CW, INK, 3);
  rule(M, 114, CW, INK, 1);
  drawText(W / 2, 126, "WEDNESDAY, 25 NOVEMBER 2026  •  ONE DAY, ONE PAGE", 2, INK, "center");
  rule(M, 152, CW, INK, 1);

  // Lead story: picture left, headline + body right.
  const leadY = 168;
  const illW = 392;
  const illH = 252;
  drawRiyadh(M, leadY, illW, illH);
  drawText(M, leadY + illH + 12, "PICTURE: RIYADH'S TALLEST TOWER, STRUCK AGAIN", 1, GREY);
  const tx = M + illW + 24;
  const tw = W - M - tx;
  drawText(tx, leadY + 4, "LEAD STORY — GULF", 2, RED);
  const headEnd = paragraph(
    tx, leadY + 30, tw,
    "HOUTHIS HIT RIYADH TOWER AND TOP REFINERY", 3, INK, 5,
  );
  paragraph(
    tx, headEnd + 10, tw,
    "Houthi forces struck Riyadh's tallest tower, home of the sovereign wealth fund, wounding 11 — the second hit in a week — and claimed an attack on Ras Tanura, the kingdom's largest refinery. Satellite images showed thick black smoke over the plant.",
    2, INK, 4,
  );

  // Divider, then the 2x2 grid.
  rule(M, 452, CW, INK, 2);
  const gridY = 470;
  const colW = Math.floor((CW - 40) / 2);
  const rowH = 148;
  storyCell(
    M, gridY, colW,
    "TRADE",
    "US PROPOSES TARIFFS ON 14 PARTNERS",
    "Washington proposed new Section 301 duties on 14 economies over excess factory capacity. China faces 20%, up to 40% if the trade truce lapses; Vietnam up to 35%, India up to 25%.",
  );
  storyCell(
    M + colW + 40, gridY, colW,
    "SPACE",
    "CHINA FLIES FIRST FOREIGN ASTRONAUT",
    "Shenzhou-24 docked at the Tiangong station carrying Pakistani astronaut Muhammad Zeeshan Ali, the first foreign crew member aboard China's space station.",
  );
  storyCell(
    M, gridY + rowH, colW,
    "JUSTICE",
    "HUAWEI CONVICTED IN US TRIAL",
    "Huawei was convicted in a landmark US criminal trial over its business with Iran, closing a case that has shadowed the Chinese tech giant for years.",
  );
  storyCell(
    M + colW + 40, gridY + rowH, colW,
    "CAIRO",
    "30 KILLED IN CAIRO FUEL FIRE",
    "At least 30 people were killed when a vehicle carrying petroleum products overturned and caught fire on a ring road near Cairo, in the Imbaba district.",
  );

  // ALSO TODAY strip.
  const alsoY = gridY + rowH * 2 + 14;
  rule(M, alsoY, CW, INK, 2);
  drawText(M, alsoY + 14, "ALSO TODAY", 2, RED);
  const items = [
    "Bangladesh raises garment wage 36% to $139 after protests",
    "Shanghai party chief Chen Jining under corruption probe",
    "Israeli judges urge dropping key Netanyahu bribery case",
    "Poland to set a no-fly zone near the Ukraine border",
    "CIA and US intelligence hit by a cyber breach",
  ];
  let iy = alsoY + 40;
  for (const item of items) {
    drawText(M, iy, "•  " + item, 2, INK);
    iy += 25;
  }

  // Footer.
  rule(M, 954, CW, INK, 1);
  drawText(W / 2, 970, "THE WORLD TODAY — SUMMED UP FROM THE DAY'S REPORTING", 2, GREY, "center");
}

function main(): void {
  const outDir = process.env.OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  buildPage();
  const png = encodePNG();
  const outPath = outDir + "/entry.png";
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, sha256 ${createHash("sha256").update(png).digest("hex")})`);
}

main();
