// THE WORLD TODAY — 25 November 2026
// A one-page newspaper front page summarising the day's world news,
// drawn entirely in code: no downloaded images, no fetched assets.
// Node 22, standard library only. Deterministic: running it twice
// produces a byte-identical PNG.
//
// Usage: node main.ts
// Output: /output/entry.png (1024x1024, RGB PNG, <= 1 MiB)
// Local test: OUTPUT_DIR=/tmp/news25-out node main.ts

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

const W = 1024;
const H = 1024;

// ---- colours (RGB) -------------------------------------------------------
const PAPER = [246, 241, 227];
const INK = [20, 20, 20];
const GREY = [90, 86, 76];
const RED = [168, 30, 30];
const NAVY = [30, 58, 92];
const SEA = [22, 50, 74];
const SEA2 = [29, 74, 104];
const SKY = [214, 228, 235];
const HULL = [38, 38, 44];
const FLAME = [232, 100, 28];
const FLAME2 = [242, 183, 5];
const SMOKE = [122, 122, 118];
const CREAM = [255, 252, 240];

// ---- pixel buffer --------------------------------------------------------
const px = new Uint8Array(W * H * 3);

function fillAll(c) {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}

function set(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      i += 3;
    }
  }
}

function hline(x, y, w, c, th = 1) {
  fillRect(x, y, w, th, c);
}

function vline(x, y, h, c, th = 1) {
  fillRect(x, y, th, h, c);
}

function fillCircle(cx, cy, r, c) {
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) set(x, y, c);
    }
  }
}

function fillTriangle(x0, y0, x1, y1, x2, y2, c) {
  // Scanline fill: sort vertices by y, then walk edges.
  const v = [
    [x0, y0],
    [x1, y1],
    [x2, y2],
  ].sort((a, b) => a[1] - b[1]);
  const [ax, ay] = v[0];
  const [bx, by] = v[1];
  const [cx, cy] = v[2];
  const interp = (y, xA, yA, xB, yB) =>
    yA === yB ? xA : xA + ((y - yA) * (xB - xA)) / (yB - yA);
  for (let y = Math.max(0, ay); y <= Math.min(H - 1, cy); y++) {
    const xa = interp(y, ax, ay, cx, cy);
    const xb = y < by ? interp(y, ax, ay, bx, by) : interp(y, bx, by, cx, cy);
    const x0l = Math.max(0, Math.ceil(Math.min(xa, xb)));
    const x1l = Math.min(W - 1, Math.floor(Math.max(xa, xb)));
    for (let x = x0l; x <= x1l; x++) set(x, y, c);
  }
}

function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    set(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// ---- PNG encoding (built by hand: zlib deflate + CRC32) ------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font -----------------------------------------------------
// Each glyph: 7 rows of 5 cells; '#' = ink, '.' = empty.
// Hand-drawn for this page; covers A-Z, a-z, 0-9 and common punctuation.
const FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  a: [".....", ".....", ".####.", "....#", ".####", "#...#", ".####"],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  c: [".....", ".....", ".####", "#....", "#....", "#....", ".####"],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  f: ["..##.", ".#..#", ".#...", "####.", ".#...", ".#...", ".#..."],
  g: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", ".###."],
  h: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  i: [".....", "..#..", ".....", ".##..", "..#..", "..#..", ".###."],
  j: [".....", "...#.", ".....", "..##.", "...#.", "...#.", "...#.", ".##.."],
  k: ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."],
  l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  p: [".....", ".....", "####.", "#...#", "#...#", "####.", "#....", "#...."],
  q: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", "....#"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: [".....", ".....", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  y: [".....", ".....", "#...#", "#...#", "#..##", ".###.", "....#", ".###."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
  ";": [".....", "..#..", ".....", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "—": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "–": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", "#..#.", "#...#"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "&": [".##..", "#..#.", "#..#.", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", ".###.", ".....", ".###.", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "’": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "•": [".....", ".....", ".##..", ".##..", ".....", ".....", "....."],
};

const BLANK = [".....", ".....", ".....", ".....", ".....", ".....", "....."];

function glyphRows(ch) {
  const g = FONT[ch];
  if (!g) return BLANK;
  return g;
}

// Draw one character; returns advance width in pixels.
function drawChar(x, y, ch, scale, c) {
  const rows = glyphRows(ch);
  const rowsN = rows.length;
  for (let r = 0; r < rowsN; r++) {
    const row = rows[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "#") {
        fillRect(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
  return 6 * scale;
}

function textWidth(text, scale) {
  let w = 0;
  for (const ch of text) w += 6 * scale;
  return w - scale; // no trailing gap
}

function drawText(x, y, text, scale, c) {
  let cx = x;
  for (const ch of text) {
    if (ch === "\n") continue;
    cx += drawChar(cx, y, ch, scale, c);
  }
  return cx;
}

function drawTextCentered(cx, y, text, scale, c) {
  const w = textWidth(text, scale);
  drawText(cx - Math.floor(w / 2), y, text, scale, c);
}

// Greedy word wrap. Returns array of lines that fit maxW.
function wrap(text, maxW, scale) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const test = cur === "" ? word : cur + " " + word;
    if (textWidth(test, scale) <= maxW) {
      cur = test;
    } else {
      if (cur !== "") lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw a wrapped paragraph; returns y after the last line.
function drawPara(x, y, text, maxW, scale, c, lineH) {
  const lines = wrap(text, maxW, scale);
  for (const ln of lines) {
    drawText(x, y, ln, scale, c);
    y += lineH;
  }
  return y;
}

// ---- the front page ------------------------------------------------------
// All facts below were checked against reporting of Tuesday 25 November 2026:
// Hormuz mine strikes (IRGC statement), Houthi claim on Ras Tanura,
// US tariff proposal on 14 partners, Huawei verdict, Venezuela debt,
// Cairo fuel-truck fire, Shenzhou-24 / Pakistan's first astronaut,
// COP31 outcome, Ukraine air-base strike, Sudan drone strikes, US bird flu.

const LEAD_HEAD = ["TWO TANKERS ABLAZE", "IN HORMUZ AFTER MINE BLASTS"];
const LEAD_P1 =
  "Two oil tankers were struck by naval mines and exploded in the Strait of Hormuz on Tuesday, Iran's Revolutionary Guard said, setting both vessels ablaze in the world's busiest oil waterway.";
const LEAD_P2 =
  "Tehran also claimed its air defences shot down two US drones over the strait, an MQ-9 and a Lucas drone, as fears of a wider war sharpened.";

const GRID = [
  {
    kick: "TRADE",
    head: "US PROPOSES NEW TARIFFS ON 14 PARTNERS",
    body: "Washington proposed higher tariffs on 14 major trading partners to counter factory overcapacity, with the steepest rates aimed at China.",
  },
  {
    kick: "YEMEN",
    head: "HOUTHIS SAY THEY HIT SAUDI REFINERY",
    body: "The Houthis said they struck the Ras Tanura refinery, Saudi Arabia's largest, a day after a tower strike in Riyadh injured 11 people.",
  },
  {
    kick: "TECH",
    head: "HUAWEI CONVICTED IN US CRIMINAL TRIAL",
    body: "A federal court found Huawei guilty of conspiring to steal trade secrets and bank fraud, but cleared it of racketeering.",
  },
  {
    kick: "DEBT",
    head: "VENEZUELA REVEALS $237.5BN DEBT PILE",
    body: "Caracas disclosed $237.5 billion in public debt as it prepares one of the largest sovereign debt restructurings in history.",
  },
  {
    kick: "EGYPT",
    head: "31 KILLED IN CAIRO FUEL-TRUCK FIRE",
    body: "A truck carrying petroleum products overturned and caught fire on a ring road near Cairo, killing 31 people and wounding 21.",
  },
  {
    kick: "SPACE",
    head: "PAKISTAN'S FIRST ASTRONAUT FLIES TO TIANGONG",
    body: "China's Shenzhou-24 launched with Muhammad Zeeshan Ali aboard, set to become the first foreign crew member of the Tiangong station.",
  },
];

const ALSO_TODAY =
  "COP31 ENDS WITH NO FOSSIL-FUEL DEAL  •  UKRAINE STRIKE DAMAGES FIVE RUSSIAN JETS  •  SUDAN DRONE STRIKES KILL 19  •  US BIRD FLU: THREE CASES, ONE DEATH";

function drawFrame() {
  fillRect(24, 24, W - 48, 3, INK);
  fillRect(24, H - 27, W - 48, 3, INK);
  fillRect(24, 24, 3, H - 48, INK);
  fillRect(W - 27, 24, 3, H - 48, INK);
  fillRect(31, 31, W - 62, 1, INK);
  fillRect(31, H - 32, W - 62, 1, INK);
  fillRect(31, 31, 1, H - 62, INK);
  fillRect(W - 32, 31, 1, H - 62, INK);
}

function drawMasthead() {
  drawTextCentered(512, 52, "THE WORLD TODAY", 6, INK);
  hline(40, 122, 944, INK, 3);
  drawText(40, 134, "TUESDAY 25 NOVEMBER 2026", 2, INK);
  const right = "WORLD EDITION";
  drawText(984 - textWidth(right, 2), 134, right, 2, INK);
  hline(40, 156, 944, INK, 2);
}

function drawIllustration(bx, by, bw, bh) {
  // Frame
  fillRect(bx, by, bw, 2, INK);
  fillRect(bx, by + bh - 2, bw, 2, INK);
  fillRect(bx, by, 2, bh, INK);
  fillRect(bx + bw - 2, by, 2, bh, INK);
  // Sky and sun
  fillRect(bx + 2, by + 2, bw - 4, 78, SKY);
  fillCircle(bx + bw - 52, by + 28, 16, FLAME2);
  // Sea
  fillRect(bx + 2, by + 80, bw - 4, bh - 82, SEA);
  fillRect(bx + 2, by + 80, bw - 4, 6, SEA2);
  // Wave dashes
  hline(bx + 20, by + 98, 60, CREAM, 2);
  hline(bx + 120, by + 114, 80, CREAM, 2);
  hline(bx + 260, by + 102, 70, CREAM, 2);
  hline(bx + 300, by + 130, 56, CREAM, 2);
  // Smoke above the fire
  fillCircle(bx + 205, by + 62, 14, SMOKE);
  fillCircle(bx + 225, by + 48, 18, SMOKE);
  fillCircle(bx + 188, by + 46, 12, SMOKE);
  // Flames rising from the deck
  fillTriangle(bx + 170, by + 118, bx + 195, by + 70, bx + 220, by + 118, FLAME);
  fillTriangle(bx + 210, by + 118, bx + 232, by + 82, bx + 254, by + 118, FLAME2);
  fillTriangle(bx + 150, by + 118, bx + 168, by + 92, bx + 186, by + 118, FLAME2);
  // Tanker: deck house, funnel, hull, bow
  fillRect(bx + 60, by + 92, 44, 26, HULL);
  fillRect(bx + 300, by + 98, 22, 20, RED);
  fillRect(bx + 300, by + 98, 22, 6, INK);
  fillRect(bx + 40, by + 118, 300, 30, HULL);
  fillTriangle(bx + 340, by + 118, bx + 372, by + 133, bx + 340, by + 148, HULL);
  // Waterline highlight on the hull
  hline(bx + 40, by + 140, 300, SEA2, 2);
}

function drawLead() {
  drawText(40, 172, "LEAD STORY — STRAIT OF HORMUZ", 2, RED);
  let y = 198;
  for (const ln of LEAD_HEAD) {
    drawText(40, y, ln, 4, INK);
    y += 34;
  }
  let ty = 276;
  ty = drawPara(40, ty, LEAD_P1, 540, 2, INK, 19);
  ty += 8;
  drawPara(40, ty, LEAD_P2, 540, 2, INK, 19);
  drawIllustration(600, 266, 384, 180);
  drawTextCentered(600 + 192, 452, "TWO TANKERS BURN IN THE STRAIT OF HORMUZ", 1, GREY);
  hline(40, 472, 944, INK, 3);
}

function drawGrid() {
  const colX = [40, 528];
  const rowY = [490, 630, 770];
  const colW = 456;
  // Vertical divider between columns
  vline(512, 490, 894 - 490, GREY, 1);
  // Horizontal dividers between rows
  hline(40, 616, 944, GREY, 1);
  hline(40, 756, 944, GREY, 1);
  GRID.forEach((s, i) => {
    const x = colX[i % 2];
    const y = rowY[Math.floor(i / 2)];
    drawText(x, y, s.kick, 1, RED);
    let hy = y + 14;
    const headLines = wrap(s.head, colW, 2);
    for (const ln of headLines.slice(0, 2)) {
      drawText(x, hy, ln, 2, INK);
      hy += 18;
    }
    drawPara(x, y + 62, s.body, colW, 1, INK, 11);
  });
}

function drawAlsoToday() {
  hline(40, 910, 944, RED, 2);
  drawText(40, 922, "ALSO TODAY", 2, RED);
  drawPara(180, 922, ALSO_TODAY, 804, 1, INK, 11);
  hline(40, 956, 944, INK, 1);
  drawTextCentered(
    512,
    968,
    "THE WORLD TODAY — ONE PAGE, ONE DAY: TUESDAY 25 NOVEMBER 2026",
    1,
    GREY
  );
}

function main() {
  fillAll(PAPER);
  drawFrame();
  drawMasthead();
  drawLead();
  drawGrid();
  drawAlsoToday();
  const png = encodePNG();
  const outDir = process.env.OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  fs.chmodSync(outPath, 0o644);
  const hash = crypto.createHash("sha256").update(png).digest("hex");
  console.log("wrote " + outPath);
  console.log("bytes=" + png.length + " sha256=" + hash);
  if (png.length > 1024 * 1024) {
    console.error("ERROR: PNG exceeds 1 MiB");
    process.exit(1);
  }
}

main();
