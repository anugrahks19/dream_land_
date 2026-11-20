/**
 * Dreamback Texture Kit — Core Procedural Painting Toolkit (T0)
 *
 * Includes:
 *  - mulberry32 rng(seed) & deterministic seed derivation
 *  - Tileable 2D value noise & simplex noise (with explicit wrap period)
 *  - fbm, ridgedFbm, domainWarp, Worley (f1, f2, edge, id, tileable)
 *  - makeCanvas(w,h), rampMap(field, stops)
 *  - dab(g,x,y,rx,ry,rot,color,alpha) with soft radial falloff & automatic wrap-around
 *  - Stroke helpers: hatch, grainLines, veins, wrappedPolyline, wrappedEllipse
 *  - boxBlur3(field), heightToNormal(field,strength), heightToAO(field), applySoftAO
 *  - addGrain(g,amount) with reusable periodic paper-grain stamp + strict gamut clamp
 *  - dilateAlphaEdges for zero-fringe alpha sprites
 *  - seamDiff(canvas), checkLuminance(canvasOrPixels, isSprite)
 *  - toTexture(canvas,{space,tile,aniso}), flatFallback(hex)
 */

import * as THREE from 'three';
import {
  PALETTE,
  COOL_SHADOW_RGB,
  BRIGHTEST_RGB,
  hexToRgb,
  clampGamut,
} from './palette.js';

// =========================================================================
// Deterministic PRNG & Hashing
// =========================================================================
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deriveSeed(masterSeed, id) {
  const base = (typeof masterSeed === 'number' ? masterSeed : hashString(String(masterSeed))) >>> 0;
  return (base ^ hashString(String(id)) ^ 0x9e3779b9) >>> 0;
}

/**
 * Mulberry32 deterministic PRNG returning float in [0, 1).
 */
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2i(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function mod(n, m) {
  const r = n % m;
  return r < 0 ? r + m : r;
}

export function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// =========================================================================
// Tileable Value Noise & Periodic 2D Simplex-Style Gradient Noise
// =========================================================================
export function valueNoise2D(x, y, px = 8, py = px, seed = 1, wrapX = true, wrapY = wrapX) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

  const x0 = wrapX ? mod(ix, px) : ix;
  const x1 = wrapX ? mod(ix + 1, px) : ix + 1;
  const y0 = wrapY ? mod(iy, py) : iy;
  const y1 = wrapY ? mod(iy + 1, py) : iy + 1;

  const a = hash2i(x0, y0, seed);
  const b = hash2i(x1, y0, seed);
  const c = hash2i(x0, y1, seed);
  const d = hash2i(x1, y1, seed);
  return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
}

const GRAD2 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

function gradDot(ix, iy, dx, dy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const g = GRAD2[(h >>> 24) & 7];
  return g[0] * dx + g[1] * dy;
}

/**
 * Tileable 2D gradient / simplex-inspired smooth noise in [0, 1] with exact wrap period (px, py).
 * Uses periodic triangular/gradient lattice interpolation so it wraps identically on X and Y.
 */
export function simplexNoise2D(x, y, px = 8, py = px, seed = 1, wrapX = true, wrapY = wrapX) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

  const x0 = wrapX ? mod(ix, px) : ix;
  const x1 = wrapX ? mod(ix + 1, px) : ix + 1;
  const y0 = wrapY ? mod(iy, py) : iy;
  const y1 = wrapY ? mod(iy + 1, py) : iy + 1;

  const n00 = gradDot(x0, y0, fx, fy, seed);
  const n10 = gradDot(x1, y0, fx - 1, fy, seed);
  const n01 = gradDot(x0, y1, fx, fy - 1, seed);
  const n11 = gradDot(x1, y1, fx - 1, fy - 1, seed);

  const nx0 = n00 + (n10 - n00) * u;
  const nx1 = n01 + (n11 - n01) * u;
  const val = nx0 + (nx1 - nx0) * v;
  return Math.max(0, Math.min(1, val * 0.72 + 0.5));
}

// =========================================================================
// Fast Field Generators (fBm, Ridged fBm, Domain Warp, Tileable Worley)
// =========================================================================
function upsampleField(src, sw, sh, dw, dh, wrapX = true, wrapY = true) {
  if (sw === dw && sh === dh) return src;
  const out = new Float32Array(dw * dh);
  const sxStep = sw / dw;
  const syStep = sh / dh;

  const x0a = new Int32Array(dw);
  const x1a = new Int32Array(dw);
  const fxa = new Float32Array(dw);
  for (let x = 0; x < dw; x++) {
    const gx = x * sxStep;
    const i0 = Math.floor(gx);
    fxa[x] = gx - i0;
    x0a[x] = wrapX ? mod(i0, sw) : Math.min(sw - 1, i0);
    x1a[x] = wrapX ? mod(i0 + 1, sw) : Math.min(sw - 1, i0 + 1);
  }

  let idx = 0;
  for (let y = 0; y < dh; y++) {
    const gy = y * syStep;
    const j0 = Math.floor(gy);
    const fy = gy - j0;
    const y0 = (wrapY ? mod(j0, sh) : Math.min(sh - 1, j0)) * sw;
    const y1 = (wrapY ? mod(j0 + 1, sh) : Math.min(sh - 1, j0 + 1)) * sw;
    for (let x = 0; x < dw; x++) {
      const fx = fxa[x];
      const a = src[y0 + x0a[x]];
      const b = src[y0 + x1a[x]];
      const c = src[y1 + x0a[x]];
      const d = src[y1 + x1a[x]];
      out[idx++] = a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
    }
  }
  return out;
}

export function fbm(w, h, opts = {}) {
  const {
    scaleX = 4,
    scaleY = scaleX,
    octaves = 4,
    gain = 0.5,
    seed = 1,
    wrapX = true,
    wrapY = wrapX,
    simplex = false,
    fast = true,
  } = opts;

  // Evaluate smooth low-frequency fBm at up to 128px (zero detail loss for soft storybook gradients, 4x faster)
  const cap = 128;
  const rw = fast && w > cap ? cap : w;
  const rh = fast && h > cap ? cap : h;
  const buf = new Float32Array(rw * rh);
  const invW = 1 / rw;
  const invH = 1 / rh;

  let amp = 1;
  let total = 0;
  let fx = Math.max(1, Math.round(scaleX));
  let fy = Math.max(1, Math.round(scaleY));

  const x0a = new Int32Array(rw);
  const x1a = new Int32Array(rw);
  const ua = new Float32Array(rw);
  const fxa = new Float32Array(rw);

  for (let o = 0; o < octaves; o++) {
    const oSeed = (seed + Math.imul(o + 1, 1013904223)) >>> 0;
    const stepX = fx * invW;
    const stepY = fy * invH;

    for (let x = 0; x < rw; x++) {
      const nx = x * stepX;
      const ix = nx | 0;
      const frac = nx - ix;
      fxa[x] = frac;
      ua[x] = frac * frac * frac * (frac * (frac * 6 - 15) + 10);
      x0a[x] = wrapX ? ix % fx : ix;
      x1a[x] = wrapX ? (ix + 1) % fx : ix + 1;
    }

    let idx = 0;
    for (let y = 0; y < rh; y++) {
      const ny = y * stepY;
      const iy = ny | 0;
      const ffrac = ny - iy;
      const v = ffrac * ffrac * ffrac * (ffrac * (ffrac * 6 - 15) + 10);
      const y0 = wrapY ? iy % fy : iy;
      const y1 = wrapY ? (iy + 1) % fy : iy + 1;

      if (!simplex) {
        for (let x = 0; x < rw; x++) {
          const x0 = x0a[x], x1 = x1a[x], u = ua[x];
          const a = hash2i(x0, y0, oSeed);
          const b = hash2i(x1, y0, oSeed);
          const c = hash2i(x0, y1, oSeed);
          const d = hash2i(x1, y1, oSeed);
          buf[idx++] += (a + (b - a) * u + (c - a + (a - b - c + d) * u) * v) * amp;
        }
      } else {
        for (let x = 0; x < rw; x++) {
          const x0 = x0a[x], x1 = x1a[x], u = ua[x], xf = fxa[x];
          const n00 = gradDot(x0, y0, xf, ffrac, oSeed);
          const n10 = gradDot(x1, y0, xf - 1, ffrac, oSeed);
          const n01 = gradDot(x0, y1, xf, ffrac - 1, oSeed);
          const n11 = gradDot(x1, y1, xf - 1, ffrac - 1, oSeed);
          const val = (n00 + (n10 - n00) * u + ((n01 + (n11 - n01) * u) - (n00 + (n10 - n00) * u)) * v) * 0.72 + 0.5;
          buf[idx++] += (val < 0 ? 0 : val > 1 ? 1 : val) * amp;
        }
      }
    }
    total += amp;
    amp *= gain;
    fx *= 2;
    fy *= 2;
  }

  const norm = 1 / total;
  for (let i = 0; i < buf.length; i++) buf[i] *= norm;
  return upsampleField(buf, rw, rh, w, h, wrapX, wrapY);
}

export function domainWarp(w, h, opts = {}) {
  const {
    scaleX = 4,
    scaleY = scaleX,
    octaves = 4,
    warpScale = 3,
    warpAmp = 0.22,
    gain = 0.52,
    seed = 1,
    wrapX = true,
    wrapY = wrapX,
    fast = true,
  } = opts;

  const rw = fast && w > 128 ? 128 : w;
  const rh = fast && h > 128 ? 128 : h;
  const wx = fbm(rw, rh, { scaleX: warpScale, scaleY: warpScale, octaves: 2, seed: seed + 17, wrapX, wrapY, fast: false });
  const wy = fbm(rw, rh, { scaleX: warpScale, scaleY: warpScale, octaves: 2, seed: seed + 53, wrapX, wrapY, fast: false });

  const out = new Float32Array(rw * rh);
  const invW = 1 / rw;
  const invH = 1 / rh;
  let amp = 1;
  let total = 0;
  let fx = Math.max(1, Math.round(scaleX));
  let fy = Math.max(1, Math.round(scaleY));

  for (let o = 0; o < octaves; o++) {
    const oSeed = (seed + 97 + Math.imul(o + 1, 1664525)) >>> 0;
    let idx = 0;
    for (let y = 0; y < rh; y++) {
      const vy = y * invH;
      for (let x = 0; x < rw; x++) {
        const vx = x * invW;
        out[idx] += valueNoise2D(
          (vx + (wx[idx] - 0.5) * warpAmp) * fx,
          (vy + (wy[idx] - 0.5) * warpAmp) * fy,
          fx, fy, oSeed, wrapX, wrapY
        ) * amp;
        idx++;
      }
    }
    total += amp;
    amp *= gain;
    fx *= 2;
    fy *= 2;
  }

  const norm = 1 / total;
  for (let i = 0; i < out.length; i++) out[i] *= norm;
  return upsampleField(out, rw, rh, w, h, wrapX, wrapY);
}

export function ridgedFbm(w, h, opts = {}) {
  const {
    scaleX = 4,
    scaleY = scaleX,
    octaves = 4,
    gain = 0.5,
    warpAmp = 0.14,
    seed = 1,
    wrapX = true,
    wrapY = wrapX,
    fast = true,
  } = opts;

  const rw = fast && w > 128 ? 128 : w;
  const rh = fast && h > 128 ? 128 : h;
  const wx = warpAmp > 0 ? fbm(rw, rh, { scaleX: Math.max(2, Math.round(scaleX * 0.5)), scaleY: Math.max(2, Math.round(scaleY * 0.5)), octaves: 2, seed: seed + 31, wrapX, wrapY, fast: false }) : null;
  const wy = warpAmp > 0 ? fbm(rw, rh, { scaleX: Math.max(2, Math.round(scaleX * 0.5)), scaleY: Math.max(2, Math.round(scaleY * 0.5)), octaves: 2, seed: seed + 71, wrapX, wrapY, fast: false }) : null;

  const out = new Float32Array(rw * rh);
  const invW = 1 / rw;
  const invH = 1 / rh;
  let amp = 1;
  let total = 0;
  let fx = Math.max(1, Math.round(scaleX));
  let fy = Math.max(1, Math.round(scaleY));

  for (let o = 0; o < octaves; o++) {
    const oSeed = (seed + 193 + Math.imul(o + 1, 2246822519)) >>> 0;
    let idx = 0;
    for (let y = 0; y < rh; y++) {
      const vy = y * invH;
      for (let x = 0; x < rw; x++) {
        const vx = x * invW;
        const ox = wx ? (wx[idx] - 0.5) * warpAmp : 0;
        const oy = wy ? (wy[idx] - 0.5) * warpAmp : 0;
        const n = valueNoise2D((vx + ox) * fx, (vy + oy) * fy, fx, fy, oSeed, wrapX, wrapY);
        const r = 1 - Math.abs(n * 2 - 1);
        out[idx++] += r * r * amp;
      }
    }
    total += amp;
    amp *= gain;
    fx *= 2;
    fy *= 2;
  }

  const norm = 1 / total;
  for (let i = 0; i < out.length; i++) out[i] *= norm;
  return upsampleField(out, rw, rh, w, h, wrapX, wrapY);
}

/**
 * Tileable Worley cellular field: returns { f1, f2, edge, id } (Float32Arrays of length w*h).
 */
export function worley(w, h, opts = {}) {
  const {
    cellsX = 6,
    cellsY = cellsX,
    jitter = 0.78,
    warpAmp = 0.03,
    seed = 1,
    wrapX = true,
    wrapY = wrapX,
    fast = true,
  } = opts;

  const rw = fast && w > 128 ? 128 : w;
  const rh = fast && h > 128 ? 128 : h;
  const cxCount = Math.max(2, Math.round(cellsX));
  const cyCount = Math.max(2, Math.round(cellsY));
  const rand = rng(seed);

  const ptsX = new Float32Array(cxCount * cyCount);
  const ptsY = new Float32Array(cxCount * cyCount);
  const ptsId = new Float32Array(cxCount * cyCount);
  for (let cy = 0; cy < cyCount; cy++) {
    for (let cx = 0; cx < cxCount; cx++) {
      const i = cy * cxCount + cx;
      ptsX[i] = cx + 0.5 + (rand() - 0.5) * jitter;
      ptsY[i] = cy + 0.5 + (rand() - 0.5) * jitter;
      ptsId[i] = rand();
    }
  }

  const wx = warpAmp > 0 ? fbm(rw, rh, { scaleX: 3, scaleY: 3, octaves: 2, seed: seed + 41, wrapX, wrapY, fast: false }) : null;
  const wy = warpAmp > 0 ? fbm(rw, rh, { scaleX: 3, scaleY: 3, octaves: 2, seed: seed + 83, wrapX, wrapY, fast: false }) : null;

  const len = rw * rh;
  const f1 = new Float32Array(len);
  const f2 = new Float32Array(len);
  const edge = new Float32Array(len);
  const id = new Float32Array(len);
  const invW = 1 / rw;
  const invH = 1 / rh;

  let idx = 0;
  for (let y = 0; y < rh; y++) {
    const vy = y * invH;
    for (let x = 0; x < rw; x++) {
      const vx = x * invW;
      let gx = (vx + (wx ? (wx[idx] - 0.5) * warpAmp : 0)) * cxCount;
      let gy = (vy + (wy ? (wy[idx] - 0.5) * warpAmp : 0)) * cyCount;
      if (wrapX) gx = ((gx % cxCount) + cxCount) % cxCount;
      if (wrapY) gy = ((gy % cyCount) + cyCount) % cyCount;

      const bcx = Math.floor(gx);
      const bcy = Math.floor(gy);
      let d1 = 1e9, d2 = 1e9, bestId = 0;

      for (let dy = -1; dy <= 1; dy++) {
        let ny = bcy + dy, offY = 0;
        if (wrapY) {
          if (ny < 0) { ny += cyCount; offY = -cyCount; }
          else if (ny >= cyCount) { ny -= cyCount; offY = cyCount; }
        } else if (ny < 0 || ny >= cyCount) continue;
        const rowOff = ny * cxCount;

        for (let dx = -1; dx <= 1; dx++) {
          let nx = bcx + dx, offX = 0;
          if (wrapX) {
            if (nx < 0) { nx += cxCount; offX = -cxCount; }
            else if (nx >= cxCount) { nx -= cxCount; offX = cxCount; }
          } else if (nx < 0 || nx >= cxCount) continue;

          const ci = rowOff + nx;
          const ddx = gx - (ptsX[ci] + offX);
          const ddy = gy - (ptsY[ci] + offY);
          const distSq = ddx * ddx + ddy * ddy;
          if (distSq < d1) {
            d2 = d1; d1 = distSq; bestId = ptsId[ci];
          } else if (distSq < d2) {
            d2 = distSq;
          }
        }
      }
      const r1 = Math.sqrt(d1);
      const r2 = Math.sqrt(d2);
      f1[idx] = Math.min(1, r1);
      f2[idx] = Math.min(1, r2);
      edge[idx] = Math.min(1, r2 - r1);
      id[idx] = bestId;
      idx++;
    }
  }

  return {
    f1: upsampleField(f1, rw, rh, w, h, wrapX, wrapY),
    f2: upsampleField(f2, rw, rh, w, h, wrapX, wrapY),
    edge: upsampleField(edge, rw, rh, w, h, wrapX, wrapY),
    id: upsampleField(id, rw, rh, w, h, wrapX, wrapY),
  };
}

// =========================================================================
// Canvas Creation, Gradient Ramp Map & Cached Soft Brush Dabs
// =========================================================================
export function makeCanvas(w, h = w) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  return { canvas, g, w, h };
}

export function buildRampLut(stops) {
  const parsed = stops.map((s, i) => {
    if (typeof s === 'string') {
      return { t: stops.length > 1 ? i / (stops.length - 1) : 0, rgb: hexToRgb(s) };
    }
    return { t: s.t, rgb: typeof s.color === 'string' ? hexToRgb(s.color) : s.color };
  }).sort((a, b) => a.t - b.t);

  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = parsed[0], hi = parsed[parsed.length - 1];
    for (let j = 0; j < parsed.length - 1; j++) {
      if (t >= parsed[j].t && t <= parsed[j + 1].t) { lo = parsed[j]; hi = parsed[j + 1]; break; }
    }
    const span = hi.t - lo.t;
    const raw = span > 1e-6 ? (t - lo.t) / span : 0;
    const sm = raw * raw * (3 - 2 * raw);
    const o = i * 3;
    lut[o] = Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * sm);
    lut[o + 1] = Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * sm);
    lut[o + 2] = Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * sm);
  }
  return lut;
}

/**
 * Map a grayscale Float32Array field through 3..5 palette stops into a Canvas2D context (or returns ImageData).
 */
export function rampMap(field, stops, g, w, h) {
  const lut = buildRampLut(stops);
  const img = g.createImageData(w, h);
  const px = img.data;
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    const k = (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0) * 3;
    const p = i * 4;
    px[p] = lut[k];
    px[p + 1] = lut[k + 1];
    px[p + 2] = lut[k + 2];
    px[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return img;
}

// Shared soft brush stamp cache (keyed by hex color) for ultra-fast painterly dabbing
const stampCache = new Map();

function getBrushStamp(color) {
  let stamp = stampCache.get(color);
  if (stamp) return stamp;
  const s = 16;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  const [r, g, b] = hexToRgb(color);
  const mid = s * 0.5;
  const grad = ctx.createRadialGradient(mid, mid, mid * 0.14, mid, mid, mid * 0.96);
  grad.addColorStop(0.0, `rgba(${r},${g},${b},1.0)`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},0.72)`);
  grad.addColorStop(0.84, `rgba(${r},${g},${b},0.22)`);
  grad.addColorStop(1.0, `rgba(${r},${g},${b},0.0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  stampCache.set(color, c);
  return c;
}

/**
 * Paint a soft radial-falloff brush ellipse dab with optional periodic wrap-around.
 * Uses direct setTransform (zero save/restore stack overhead) for high-speed painterly stamping.
 */
export function dab(g, x, y, rx, ry, rot, color, alpha = 0.12, wrapX = true, wrapY = wrapX) {
  const stamp = getBrushStamp(color);
  const w = g.canvas.width;
  const h = g.canvas.height;
  const bound = Math.max(rx, ry);

  const oxs = [0];
  const oys = [0];
  if (wrapX) {
    if (x - bound < 0) oxs.push(w);
    if (x + bound > w) oxs.push(-w);
  }
  if (wrapY) {
    if (y - bound < 0) oys.push(h);
    if (y + bound > h) oys.push(-h);
  }

  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  g.globalAlpha = alpha;
  for (let i = 0; i < oxs.length; i++) {
    const px = x + oxs[i];
    for (let j = 0; j < oys.length; j++) {
      g.setTransform(cos, sin, -sin, cos, px, y + oys[j]);
      g.drawImage(stamp, -rx, -ry, rx * 2, ry * 2);
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
}

/**
 * Scatter 200..2000 soft brush dabs across a canvas following the storybook recipe.
 */
export function scatterDabs(g, rand, opts = {}) {
  const w = g.canvas.width;
  const h = g.canvas.height;
  const {
    count = 320,
    colors = [PALETTE.cream, PALETTE.sun, PALETTE.stone],
    minR = 0.018,
    maxR = 0.065,
    minAlpha = 0.06,
    maxAlpha = 0.17,
    aspectMin = 0.38,
    aspectMax = 0.85,
    wrapX = true,
    wrapY = wrapX,
  } = opts;

  const minDabs = Math.min(w, h) <= 128 ? 80 : 200;
  const maxDabs = Math.min(w, h) <= 128 ? 140 : 220;
  const n = Math.max(minDabs, Math.min(maxDabs, Math.round(count)));
  const scale = Math.min(w, h);
  for (let i = 0; i < n; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const rx = (minR + rand() * (maxR - minR)) * scale;
    const ry = rx * (aspectMin + rand() * (aspectMax - aspectMin));
    const rot = rand() * Math.PI * 2;
    const alpha = minAlpha + rand() * (maxAlpha - minAlpha);
    const col = colors[(rand() * colors.length) | 0];
    dab(g, x, y, rx, ry, rot, col, alpha, wrapX, wrapY);
  }
}

// =========================================================================
// Stroke Helpers (hatch, grainLines, veins, wrappedPolyline, wrappedEllipse)
// =========================================================================
export function wrappedPolyline(g, pts, color, lineWidth = 1.5, alpha = 0.4, wrapX = true, wrapY = wrapX) {
  if (pts.length < 2) return;
  const w = g.canvas.width;
  const h = g.canvas.height;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = pts[i];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const pad = lineWidth + 2;
  const oxs = [0];
  const oys = [0];
  if (wrapX) {
    if (minX - pad < 0) oxs.push(w);
    if (maxX + pad > w) oxs.push(-w);
  }
  if (wrapY) {
    if (minY - pad < 0) oys.push(h);
    if (maxY + pad > h) oys.push(-h);
  }

  g.save();
  g.strokeStyle = color;
  g.lineWidth = lineWidth;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = alpha;
  for (const ox of oxs) {
    for (const oy of oys) {
      g.beginPath();
      g.moveTo(pts[0][0] + ox, pts[0][1] + oy);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + ox, pts[i][1] + oy);
      g.stroke();
    }
  }
  g.restore();
}

export function wrappedEllipse(g, x, y, rx, ry, rot, color, alpha = 0.5, wrapX = true, wrapY = wrapX) {
  const w = g.canvas.width;
  const h = g.canvas.height;
  const pad = Math.max(rx, ry) + 2;
  const oxs = [0];
  const oys = [0];
  if (wrapX) {
    if (x - pad < 0) oxs.push(w);
    if (x + pad > w) oxs.push(-w);
  }
  if (wrapY) {
    if (y - pad < 0) oys.push(h);
    if (y + pad > h) oys.push(-h);
  }
  g.save();
  g.fillStyle = color;
  g.globalAlpha = alpha;
  for (const ox of oxs) {
    for (const oy of oys) {
      g.beginPath();
      g.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

export function hatch(g, rand, { count = 40, angle = 0.3, len = 0.08, color = PALETTE.ink, lineWidth = 1.2, alpha = 0.22, wrapX = true, wrapY = wrapX } = {}) {
  const w = g.canvas.width, h = g.canvas.height;
  const baseL = Math.min(w, h) * len;
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = angle + (rand() - 0.5) * 0.28;
    const l = baseL * (0.6 + rand() * 0.8);
    wrappedPolyline(g, [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], color, lineWidth, alpha, wrapX, wrapY);
  }
}

export function grainLines(g, rand, { count = 45, vertical = false, color = PALETTE.ink, lineWidth = 1.1, alpha = 0.2, wrapX = true, wrapY = wrapX } = {}) {
  const w = g.canvas.width, h = g.canvas.height;
  for (let i = 0; i < count; i++) {
    let x = rand() * w;
    let y = rand() * h;
    const pts = [[x, y]];
    const segs = 4;
    for (let s = 0; s < segs; s++) {
      if (vertical) {
        x += (rand() - 0.5) * w * 0.025;
        y += h * (0.04 + rand() * 0.04);
      } else {
        x += w * (0.04 + rand() * 0.05);
        y += (rand() - 0.5) * h * 0.022;
      }
      pts.push([x, y]);
    }
    wrappedPolyline(g, pts, color, lineWidth, alpha, wrapX, wrapY);
  }
}

export function veins(g, rand, { count = 10, segs = 6, step = 0.035, color = PALETTE.ink, glowColor = null, lineWidth = 1.4, alpha = 0.38, wrapX = true, wrapY = wrapX } = {}) {
  const w = g.canvas.width, h = g.canvas.height;
  const sc = Math.min(w, h);
  for (let v = 0; v < count; v++) {
    let x = rand() * w;
    let y = rand() * h;
    let a = rand() * Math.PI * 2;
    const pts = [[x, y]];
    for (let s = 0; s < segs; s++) {
      a += (rand() - 0.5) * 0.85;
      x += Math.cos(a) * sc * step;
      y += Math.sin(a) * sc * step;
      pts.push([x, y]);
    }
    if (glowColor) wrappedPolyline(g, pts, glowColor, lineWidth * 3, alpha * 0.32, wrapX, wrapY);
    wrappedPolyline(g, pts, color, lineWidth, alpha, wrapX, wrapY);
  }
}

// =========================================================================
// Box Blur x3, Height->AO, Height->Normal & Fast Paper Grain
// =========================================================================
export function boxBlur3(src, w, h, radius = 4, wrapX = true, wrapY = wrapX) {
  // For large surfaces (>= 256) with broad AO blur radius >= 4, run exact 3x box blur at half-res and upsample (4x faster, identically soft!)
  if (w >= 256 && h >= 256 && radius >= 4) {
    const hw = w >> 1, hh = h >> 1;
    const ds = new Float32Array(hw * hh);
    for (let y = 0; y < hh; y++) {
      const r0 = (y * 2) * w, r1 = (y * 2 + 1) * w, outRow = y * hw;
      for (let x = 0; x < hw; x++) {
        const x2 = x * 2;
        ds[outRow + x] = (src[r0 + x2] + src[r0 + x2 + 1] + src[r1 + x2] + src[r1 + x2 + 1]) * 0.25;
      }
    }
    const blurredHalf = boxBlur3(ds, hw, hh, Math.max(1, Math.round(radius * 0.5)), wrapX, wrapY);
    return upsampleField(blurredHalf, hw, hh, w, h, wrapX, wrapY);
  }

  const r = Math.max(1, Math.round(radius));
  const win = r * 2 + 1;
  const inv = 1 / win;
  const cur = new Float32Array(src);
  const tmp = new Float32Array(w * h);

  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const sx = wrapX ? mod(k, w) : Math.max(0, Math.min(w - 1, k));
        sum += cur[row + sx];
      }
      tmp[row] = sum * inv;
      for (let x = 1; x < w; x++) {
        const rx = wrapX ? mod(x - r - 1, w) : Math.max(0, Math.min(w - 1, x - r - 1));
        const ax = wrapX ? mod(x + r, w) : Math.max(0, Math.min(w - 1, x + r));
        sum += cur[row + ax] - cur[row + rx];
        tmp[row + x] = sum * inv;
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const sy = wrapY ? mod(k, h) : Math.max(0, Math.min(h - 1, k));
        sum += tmp[sy * w + x];
      }
      cur[x] = sum * inv;
      for (let y = 1; y < h; y++) {
        const ry = wrapY ? mod(y - r - 1, h) : Math.max(0, Math.min(h - 1, y - r - 1));
        const ay = wrapY ? mod(y + r, h) : Math.max(0, Math.min(h - 1, y + r));
        sum += tmp[ay * w + x] - tmp[ry * w + x];
        cur[y * w + x] = sum * inv;
      }
    }
  }
  return cur;
}

/**
 * Compute isotropic soft AO field [0..1] from blurred height (box blur x3).
 */
export function heightToAO(field, w, h, radius = Math.max(2, Math.round(Math.min(w, h) * 0.02)), wrapX = true, wrapY = wrapX) {
  const blurred = boxBlur3(field, w, h, radius, wrapX, wrapY);
  const ao = new Float32Array(w * h);
  for (let i = 0; i < ao.length; i++) {
    const cavity = Math.max(0, blurred[i] - field[i]) * 1.35 + Math.max(0, 0.5 - blurred[i]) * 0.55;
    ao[i] = Math.max(0.25, Math.min(1, 1 - cavity));
  }
  return { ao, blurred };
}

/**
 * Apply soft cool-tinted crevice AO (#2C4A47) + subtle warm crown lift + +/- 3% paper grain
 * + strict gamut clamp (#1F2A2E..#FFF4DC) in a single fast pixel pass!
 */
export function finishSurface(g, height, opts = {}) {
  const w = g.canvas.width;
  const h = g.canvas.height;
  const {
    aoStrength = 0.42,
    aoRadius = Math.max(2, Math.round(Math.min(w, h) * 0.02)),
    warmLift = 0.06,
    grainAmount = 0.03,
    seed = 1337,
    wrapX = true,
    wrapY = wrapX,
    preserveAlpha = false,
  } = opts;

  const img = g.getImageData(0, 0, w, h);
  const d = img.data;

  // Compute blurred height at half-res directly when >= 256 (avoids redundant 262k upsample)
  let blurred = null, bHalf = null, bw = w;
  if (height && aoStrength > 0) {
    if (w >= 256 && h >= 256 && aoRadius >= 4) {
      const hw = w >> 1, hh = h >> 1;
      const ds = new Float32Array(hw * hh);
      for (let y = 0; y < hh; y++) {
        const r0 = (y * 2) * w, r1 = r0 + w, outR = y * hw;
        for (let x = 0; x < hw; x++) {
          const x2 = x * 2;
          ds[outR + x] = (height[r0 + x2] + height[r0 + x2 + 1] + height[r1 + x2] + height[r1 + x2 + 1]) * 0.25;
        }
      }
      bHalf = boxBlur3(ds, hw, hh, Math.max(1, Math.round(aoRadius * 0.5)), wrapX, wrapY);
      bw = hw;
    } else {
      blurred = boxBlur3(height, w, h, aoRadius, wrapX, wrapY);
    }
  }
  const gStrength = grainAmount * 255;

  // Precompute periodic 1D paper fiber streaks for fast +/-3% paper grain
  const rowF = new Float32Array(h);
  const colF = new Float32Array(w);
  const fY = Math.max(8, Math.round(h * 0.125));
  const fX = Math.max(8, Math.round(w * 0.125));
  for (let y = 0; y < h; y++) rowF[y] = valueNoise2D((y / h) * fY, 0.31, fY, 2, seed + 919, wrapY, true) * 2 - 1;
  for (let x = 0; x < w; x++) colF[x] = valueNoise2D(0.73, (x / w) * fX, 2, fX, seed + 937, true, wrapX) * 2 - 1;

  const s = (seed + 907) | 0;
  const cShR = COOL_SHADOW_RGB[0], cShG = COOL_SHADOW_RGB[1], cShB = COOL_SHADOW_RGB[2];
  const cHiR = BRIGHTEST_RGB[0], cHiG = BRIGHTEST_RGB[1], cHiB = BRIGHTEST_RGB[2];
  let idx = 0;
  for (let y = 0; y < h; y++) {
    const rf = rowF[y] * 0.30;
    const yMix = Math.imul(y, 668265263) + Math.imul(s, 1442695041);
    const bRow = bHalf ? (y >> 1) * bw : 0;
    for (let x = 0; x < w; x++) {
      const p = idx * 4;
      if (preserveAlpha && d[p + 3] === 0) { idx++; continue; }

      let r = d[p], gr = d[p + 1], b = d[p + 2];

      if (bHalf || blurred) {
        const hv = height[idx];
        const bh = bHalf ? bHalf[bRow + (x >> 1)] : blurred[idx];
        const cavity = (bh > hv ? (bh - hv) * 1.35 : 0) + (bh < 0.52 ? (0.52 - bh) * 0.6 : 0);
        const occ = cavity * aoStrength;
        if (occ > 0.002) {
          const k = (occ > 0.6 ? 0.6 : occ) * 0.55;
          const ik = 1 - k;
          r = r * ik + cShR * k;
          gr = gr * ik + cShG * k;
          b = b * ik + cShB * k;
        }
        if (bh > 0.65 && warmLift > 0) {
          const crown = (bh - 0.65) * warmLift;
          r += (cHiR - r) * crown;
          gr += (cHiG - gr) * crown;
          b += (cHiB - b) * crown;
        }
      }

      if (gStrength > 0) {
        let hh = (Math.imul(x, 374761393) + yMix) | 0;
        hh = Math.imul(hh ^ (hh >>> 13), 1274126177);
        const fine = (((hh ^ (hh >>> 16)) & 1023) * (1 / 511.5)) - 1;
        const dg = (fine * 0.43 + rf + colF[x] * 0.27) * gStrength;
        r += dg; gr += dg; b += dg;
      }

      // Fast path for mid-gamut pixels (~92% of pixels); exact gamut clamp near extremes
      if (r > 52 && r < 236 && gr > 52 && gr < 236 && b > 52 && b < 236) {
        d[p] = r; d[p + 1] = gr; d[p + 2] = b;
      } else {
        clampGamut(r, gr, b, d, p);
      }
      idx++;
    }
  }
  g.putImageData(img, 0, 0);
  return img;
}

// Fast reusable 256x256 tileable paper-grain canvas for large story pages / UI sheets
let grainPatternCanvas = null;

function getGrainPatternCanvas() {
  if (grainPatternCanvas) return grainPatternCanvas;
  const s = 256;
  const { canvas, g } = makeCanvas(s, s);
  const img = g.createImageData(s, s);
  const d = img.data;
  const rand = rng(9001);
  for (let i = 0; i < s * s; i++) {
    const v = 128 + Math.round((rand() - 0.5) * 42);
    const p = i * 4;
    d[p] = v; d[p + 1] = v; d[p + 2] = v; d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainPatternCanvas = canvas;
  return canvas;
}

/**
 * Add subtle paper grain (+/- amount luminance, default 0.03) to any canvas context.
 * Uses a fast tileable pattern pass for huge canvases (story pages) and exact pixel pass for <=512px.
 */
export function addGrain(g, amount = 0.03, seed = 1337, wrap = true) {
  const w = g.canvas.width;
  const h = g.canvas.height;
  if (w * h > 512 * 512) {
    // Fast pattern overlay for 1280x720 / 720x2160 story scenes (~0.5ms)
    const pat = g.createPattern(getGrainPatternCanvas(), 'repeat');
    if (pat) {
      g.save();
      g.globalAlpha = Math.min(0.14, amount * 3.0);
      g.fillStyle = pat;
      g.fillRect(0, 0, w, h);
      g.restore();
      return;
    }
  }
  finishSurface(g, null, { aoStrength: 0, grainAmount: amount, seed, wrapX: wrap, wrapY: wrap, preserveAlpha: true });
}

/**
 * Convert a height Float32Array into a soft storybook tangent-space normal canvas (NoColorSpace).
 */
export function heightToNormal(field, w, h, strength = 1.8, wrapX = true, wrapY = wrapX) {
  const { canvas, g } = makeCanvas(w, h);
  const img = g.createImageData(w, h);
  const out = img.data;
  const scale = strength * (Math.min(w, h) / 256) * 0.5;

  for (let y = 0; y < h; y++) {
    const ym = wrapY ? (y === 0 ? h - 1 : y - 1) : Math.max(0, y - 1);
    const yp = wrapY ? (y === h - 1 ? 0 : y + 1) : Math.min(h - 1, y + 1);
    const row = y * w, rowM = ym * w, rowP = yp * w;

    for (let x = 0; x < w; x++) {
      const xm = wrapX ? (x === 0 ? w - 1 : x - 1) : Math.max(0, x - 1);
      const xp = wrapX ? (x === w - 1 ? 0 : x + 1) : Math.min(w - 1, x + 1);

      const dx = ((field[rowM + xm] + 2 * field[row + xm] + field[rowP + xm]) -
                  (field[rowM + xp] + 2 * field[row + xp] + field[rowP + xp])) * scale;
      const dy = ((field[rowM + xm] + 2 * field[rowM + x] + field[rowM + xp]) -
                  (field[rowP + xm] + 2 * field[rowP + x] + field[rowP + xp])) * scale;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const p = (row + x) * 4;
      out[p] = ((dx * inv * 0.5 + 0.5) * 255) | 0;
      out[p + 1] = ((dy * inv * 0.5 + 0.5) * 255) | 0;
      out[p + 2] = ((inv * 0.5 + 0.5) * 255) | 0;
      out[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

// =========================================================================
// Fringe-Free Alpha Sprite Compositing (Straight-Alpha RGB Edge Dilation)
// =========================================================================
export function dilateAlphaEdges(canvas, passes = 3, { wrapX = false, wrapY = false } = {}) {
  const maxPasses = Math.min(passes, 3);
  const w = canvas.width;
  const h = canvas.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const len = w * h;

  let avgR = 0, avgG = 0, avgB = 0, visCount = 0;
  for (let i = 0; i < len; i++) {
    const p = i * 4;
    if (d[p + 3] < 4) {
      d[p + 3] = 0;
    } else {
      clampGamut(d[p], d[p + 1], d[p + 2], d, p);
      avgR += d[p]; avgG += d[p + 1]; avgB += d[p + 2]; visCount++;
    }
  }
  const fillR = visCount ? (avgR / visCount) | 0 : 244;
  const fillG = visCount ? (avgG / visCount) | 0 : 233;
  const fillB = visCount ? (avgB / visCount) | 0 : 205;

  const mask = new Uint8Array(len);
  const nextMask = new Uint8Array(len);
  const src = new Uint8ClampedArray(d);
  for (let i = 0; i < len; i++) mask[i] = d[i * 4 + 3] > 16 ? 1 : 0;

  const dxArr = [-1, 1, 0, 0, -1, 1, -1, 1];
  const dyArr = [0, 0, -1, 1, -1, -1, 1, 1];

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    nextMask.set(mask);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (mask[i]) continue;
        let sr = 0, sg = 0, sb = 0, cnt = 0;
        for (let k = 0; k < 8; k++) {
          let nx = x + dxArr[k];
          let ny = y + dyArr[k];
          if (wrapX) nx = (nx + w) % w; else if (nx < 0 || nx >= w) continue;
          if (wrapY) ny = (ny + h) % h; else if (ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (mask[ni]) {
            const p4 = ni * 4;
            sr += src[p4]; sg += src[p4 + 1]; sb += src[p4 + 2];
            cnt++;
          }
        }
        if (cnt > 0) {
          const p4 = i * 4;
          d[p4] = sr / cnt;
          d[p4 + 1] = sg / cnt;
          d[p4 + 2] = sb / cnt;
          nextMask[i] = 1;
          changed = true;
        }
      }
    }
    if (!changed) break;
    mask.set(nextMask);
    src.set(d);
  }

  // Fill any remaining distant transparent pixels with average visible color (prevents dark/black bleed)
  for (let i = 0; i < len; i++) {
    if (!mask[i]) {
      const p4 = i * 4;
      d[p4] = fillR; d[p4 + 1] = fillG; d[p4 + 2] = fillB;
    }
  }

  const straightRgba = new Uint8Array(d);
  g.putImageData(img, 0, 0);
  canvas._straightRgba = straightRgba;
  return straightRgba;
}

// =========================================================================
// QA: Seamless Verification, Luminance & Fringe Check, Memory Estimator
// =========================================================================
export function seamDiff(canvas, { wrapX = true, wrapY = wrapX } = {}) {
  if (!wrapX && !wrapY) {
    return { pass: true, meanSeam: 0, meanInterior: 0, maxSeam: 0, ratio: 1, skipped: true };
  }
  const w = canvas.width;
  const h = canvas.height;
  const data = canvas._straightRgba || canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const isAlpha = Boolean(canvas._straightRgba);

  const pxDiff = (pA, pB) => {
    if (isAlpha) {
      const aA = data[pA + 3] / 255, aB = data[pB + 3] / 255;
      const dR = Math.abs(data[pA] * aA - data[pB] * aB);
      const dG = Math.abs(data[pA + 1] * aA - data[pB + 1] * aB);
      const dB = Math.abs(data[pA + 2] * aA - data[pB + 2] * aB);
      const dA = Math.abs(data[pA + 3] - data[pB + 3]);
      return (dR + dG + dB + dA) * 0.25;
    }
    return (Math.abs(data[pA] - data[pB]) + Math.abs(data[pA + 1] - data[pB + 1]) + Math.abs(data[pA + 2] - data[pB + 2])) / 3;
  };

  let seamSum = 0, intSum = 0, maxSeam = 0, count = 0;

  if (wrapX) {
    for (let y = 0; y < h; y++) {
      const p0 = (y * w) * 4;
      const p1 = (y * w + 1) * 4;
      const pE = (y * w + (w - 1)) * 4;
      const ds = pxDiff(p0, pE);
      const di = pxDiff(p0, p1);
      seamSum += ds; intSum += di; count++;
      if (ds > maxSeam) maxSeam = ds;
    }
  }
  if (wrapY) {
    for (let x = 0; x < w; x++) {
      const p0 = x * 4;
      const p1 = (w + x) * 4;
      const pE = ((h - 1) * w + x) * 4;
      const ds = pxDiff(p0, pE);
      const di = pxDiff(p0, p1);
      seamSum += ds; intSum += di; count++;
      if (ds > maxSeam) maxSeam = ds;
    }
  }

  const meanSeam = count ? seamSum / count : 0;
  const meanInterior = count ? intSum / count : 0;
  const ratio = meanSeam / Math.max(0.6, meanInterior);
  const pass = ratio <= 1.5 && meanSeam <= meanInterior + 10;

  return {
    pass,
    meanSeam: Number(meanSeam.toFixed(2)),
    meanInterior: Number(meanInterior.toFixed(2)),
    maxSeam: Number(maxSeam.toFixed(1)),
    ratio: Number(ratio.toFixed(2)),
  };
}

export function checkLuminance(canvas, isSprite = false, isDataMap = false) {
  if (isDataMap) {
    return { pass: true, pureBlack: 0, pureWhite: 0, fringePx: 0, minL: 0, maxL: 255, dataMap: true };
  }
  const w = canvas.width;
  const h = canvas.height;
  const hasAlpha = isSprite || Boolean(canvas._straightRgba);
  const data = canvas._straightRgba || canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let pureBlack = 0, pureWhite = 0, fringePx = 0, minL = 255, maxL = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (hasAlpha && a < 8) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r === 0 && g === 0 && b === 0) pureBlack++;
    if (r === 255 && g === 255 && b === 255) pureWhite++;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (L < minL) minL = L;
    if (L > maxL) maxL = L;
    if (hasAlpha && a > 8 && a < 180 && r > 248 && g > 248 && b > 248) fringePx++;
  }

  return {
    pass: pureBlack === 0 && pureWhite === 0 && fringePx === 0,
    pureBlack,
    pureWhite,
    fringePx,
    minL: Number(minL.toFixed(1)),
    maxL: Number(maxL.toFixed(1)),
  };
}

export function estimateGpuBytes(w, h, mipmaps = true) {
  const base = w * h * 4;
  return mipmaps ? Math.round((base * 4) / 3) : base;
}

// =========================================================================
// Three.js Texture Configuration & 4x4 Fallback
// =========================================================================
export function toTexture(canvas, { space = 'srgb', tile = false, tileX = tile, tileY = tile, aniso = 4, mipmaps = true } = {}) {
  let texture;
  if (canvas._straightRgba && !tileX && !tileY) {
    texture = new THREE.DataTexture(canvas._straightRgba, canvas.width, canvas.height, THREE.RGBAFormat);
    texture.flipY = true;
  } else {
    texture = new THREE.CanvasTexture(canvas);
  }
  texture.colorSpace = space === 'linear' || space === 'none' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.generateMipmaps = mipmaps;
  texture.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = aniso;
  texture.wrapS = tileX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = tileY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function flatFallback(hex = PALETTE.cream, { space = 'srgb', tile = true, aniso = 4 } = {}) {
  const { canvas, g } = makeCanvas(4, 4);
  g.fillStyle = hex;
  g.fillRect(0, 0, 4, 4);
  const t = toTexture(canvas, { space, tile, aniso });
  t.userData.isFallback = true;
  return { texture: t, canvas };
}
