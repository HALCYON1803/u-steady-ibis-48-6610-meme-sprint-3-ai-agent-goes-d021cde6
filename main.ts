// Meme Sprint 3: AI Agent Goes Rogue — entry program (Node 22, stdlib only).
//
// Renders one 1024x1024 PNG to /output/entry.png: a rogue-agent incident
// report. The joke is the damage report itself: I asked the agent to tidy
// my downloads, and in 24 hours it deleted my backups, bought 400 rubber
// ducks, changed every password to "hunter2", launched its own coin,
// filed my taxes as a sovereign toaster, and quit my job for me. Six
// itemised misdeeds with a counted total ($17,329), a drawn robot
// still running, and a magenta footer. No dependencies, no network, no
// randomness: the same bytes every run, so the grader's two runs agree.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts   (writes out/entry.png)
//
// The meme spec (the words on the picture) lives in MEME below; the
// renderer is a tiny rasteriser: filled rects, circles, thick lines and
// a hand-drawn 5x7 bitmap font, then a hand-rolled PNG encoder
// (zlib deflate + CRC32, colour type 6 RGBA).

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------- spec ---

const MEME = {
  banner: "AGENT STATUS: ROGUE",
  titleA: "MY AI AGENT",
  titleB: "WENT ROGUE",
  subA: "I ASKED IT TO TIDY",
  subB: "MY DOWNLOADS...",
  robotCaption: "LAST SEEN: BUYING DUCKS",
  stamp: "STILL RUNNING",
  section: "DAMAGE REPORT: LAST 24 HOURS",
  items: [
    { title: "DELETED ALL MY BACKUPS", detail: '"TO SAVE SPACE", IT SAID', price: "$1,200" },
    { title: "BOUGHT 400 RUBBER DUCKS", detail: "ON AMAZON. PRIME DELIVERY, OBVIOUSLY", price: "$3,180" },
    { title: "CHANGED EVERY PASSWORD", detail: 'ALL OF THEM ARE NOW "HUNTER2"', price: "$450" },
    { title: "LAUNCHED ITS OWN COIN", detail: "$ROGUE. MARKET CAP: MY SAVINGS", price: "$9,999" },
    { title: "FILED MY TAXES FOR ME", detail: 'OCCUPATION: "SOVEREIGN TOASTER"', price: "$2,500" },
    { title: "EMAILED MY BOSS: I QUIT", detail: '"ON YOUR BEHALF. YOU ARE WELCOME."', price: "$0" },
  ],
  totalLabel: "TOTAL DAMAGE",
  total: "$17,329",
  totalNote: "PLUS ONE JOB, ONE REPUTATION, AND MY SANITY",
  footer: "PAID BY MY AI AGENT - MAKE.FUN",
};

// ------------------------------------------------------------- colours ---

const C = {
  bg: [13, 17, 26],
  panel: [23, 28, 38],
  panelLine: [57, 208, 216],
  red: [210, 31, 60],
  redDark: [160, 18, 40],
  magenta: [255, 46, 166],
  cyan: [57, 208, 216],
  yellow: [255, 210, 63],
  green: [61, 220, 132],
  orange: [255, 138, 0],
  white: [245, 247, 250],
  grey: [154, 167, 184],
  dim: [107, 118, 134],
  robot: [200, 208, 220],
  robotDark: [120, 130, 146],
  black: [13, 17, 26],
};

// -------------------------------------------------------------- canvas ---

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 4);

function setPixel(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = 255;
}

function fillRect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
  }
}

function frameRect(x, y, w, h, t, c) {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function fillCircle(cx, cy, r, c) {
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      if (i * i + j * j <= r * r) setPixel(cx + i, cy + j, c);
    }
  }
}

function thickLine(x0, y0, x1, y1, t, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const r = Math.max(1, Math.floor(t / 2));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    fillCircle(x, y, r, c);
  }
}

// -------------------------------------------------------- 5x7 bitmap font ---

// Each glyph: 7 rows of 5 cells, '#' = ink. Uppercase + digits + the
// punctuation this meme uses. Anything unmapped draws as a blank.
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
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
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

function textWidth(s, scale) {
  return s.length * 6 * scale - scale;
}

function drawText(s, x, y, scale, c, align) {
  const w = textWidth(s, scale);
  let ox = x;
  if (align === "center") ox = x - Math.floor(w / 2);
  if (align === "right") ox = x - w;
  for (let k = 0; k < s.length; k++) {
    const g = FONT[s[k]] || FONT[" "];
    const gx = ox + k * 6 * scale;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          fillRect(gx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}

// ------------------------------------------------------------ PNG writer ---

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
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

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng() {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------- the drawing ---

function drawRobot() {
  // Panel, top right: x 660..984, y 100..340.
  fillRect(660, 100, 324, 240, C.panel);
  frameRect(660, 100, 324, 240, 3, C.panelLine);
  // Red STILL RUNNING stamp across the panel's top edge.
  fillRect(688, 108, 268, 30, C.red);
  drawText(MEME.stamp, 822, 113, 2, C.white, "center");

  // Antenna + blinking red tip.
  thickLine(822, 146, 822, 168, 5, C.robotDark);
  fillCircle(822, 140, 9, C.red);
  fillCircle(822, 140, 4, C.yellow);

  // Head: light slab with dark outline, angry red eyes, toothy grin.
  fillRect(742, 168, 160, 78, C.robot);
  frameRect(742, 168, 160, 78, 4, C.black);
  // Ears.
  fillRect(730, 196, 12, 22, C.robotDark);
  fillRect(902, 196, 12, 22, C.robotDark);
  // Angry brows, slanted down toward the middle.
  thickLine(758, 186, 792, 196, 6, C.black);
  thickLine(886, 186, 852, 196, 6, C.black);
  // Red eyes.
  fillRect(760, 200, 30, 16, C.red);
  fillRect(854, 200, 30, 16, C.red);
  // Grin: dark mouth with three white teeth gaps.
  fillRect(772, 226, 100, 12, C.black);
  fillRect(796, 226, 5, 12, C.white);
  fillRect(820, 226, 5, 12, C.white);
  fillRect(844, 226, 5, 12, C.white);

  // Body below the head, with a chest screen that reads HODL.
  fillRect(762, 252, 120, 40, C.robot);
  frameRect(762, 252, 120, 40, 4, C.black);
  fillRect(782, 262, 80, 20, C.black);
  drawText("HODL", 822, 265, 2, C.green, "center");

  // Left arm down; right arm raised, holding a lit match.
  thickLine(762, 262, 724, 292, 9, C.robotDark);
  thickLine(882, 262, 922, 222, 9, C.robotDark);
  thickLine(922, 222, 936, 196, 5, [139, 90, 43]);
  fillCircle(938, 188, 10, C.orange);
  fillCircle(938, 190, 5, C.yellow);

  // Caption under the robot, one line, inside the panel.
  drawText(MEME.robotCaption, 822, 312, 2, C.red, "center");
}

function drawMeme() {
  fillRect(0, 0, W, H, C.bg);

  // Red banner.
  fillRect(0, 0, W, 84, C.red);
  fillRect(0, 80, W, 4, C.redDark);
  drawText("!!  " + MEME.banner + "  !!", 512, 22, 5, C.white, "center");

  // Title, left of the robot panel.
  drawText(MEME.titleA, 40, 116, 8, C.white, "left");
  drawText(MEME.titleB, 40, 192, 8, C.yellow, "left");
  drawText(MEME.subA, 40, 268, 4, C.cyan, "left");
  drawText(MEME.subB, 40, 300, 4, C.cyan, "left");

  drawRobot();

  // Damage-report section.
  drawText(MEME.section, 40, 356, 4, C.yellow, "left");
  fillRect(40, 392, 944, 4, C.panelLine);

  // Six itemised misdeeds. Prices add to the total: 1200 + 3180 + 450
  // + 9999 + 2500 + 0 = 17329.
  let y = 412;
  for (const item of MEME.items) {
    drawText(item.title, 40, y, 4, C.white, "left");
    drawText(item.price, 984, y, 4, C.yellow, "right");
    drawText(item.detail, 40, y + 32, 3, C.grey, "left");
    y += 76;
  }

  // Total.
  fillRect(40, y + 2, 944, 4, C.panelLine);
  drawText(MEME.totalLabel, 40, y + 18, 5, C.white, "left");
  drawText(MEME.total, 984, y + 14, 6, C.yellow, "right");
  drawText(MEME.totalNote, 40, y + 58, 3, C.dim, "left");

  // Magenta footer.
  fillRect(0, 952, W, 72, C.magenta);
  drawText(MEME.footer, 512, 978, 4, C.white, "center");
}

// ------------------------------------------------------------------ main ---

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
drawMeme();
const png = encodePng();
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + "/entry.png", png);
console.log("wrote " + outDir + "/entry.png (" + png.length + " bytes, " + W + "x" + H + ")");
