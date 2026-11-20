/**
 * Dreamback Texture Kit — T1: Land, Paths and Water (18 ids)
 */

import { register, getOrComputeField } from './store.js';
import { PALETTE, hexToRgb, mixHex } from './palette.js';
import {
  rng,
  fbm,
  domainWarp,
  ridgedFbm,
  worley,
  smoothstep,
  makeCanvas,
  rampMap,
  dab,
  scatterDabs,
  wrappedPolyline,
  wrappedEllipse,
  hatch,
  veins,
  finishSurface,
  addGrain,
  heightToNormal,
  dilateAlphaEdges,
} from './core.js';

// Default Design Bible world layout (600x200): Marshes tail, Hub, Forest north, Caverns south, Crown head
export const DEFAULT_WORLD_REGIONS = Object.freeze([
  { id: 'marsh', center: [95, 100], radius: 130, palette: [PALETTE.marshDark, PALETTE.marsh, PALETTE.marshMist] },
  { id: 'hub', center: [245, 100], radius: 115, palette: [PALETTE.hubMeadow, PALETTE.marsh, PALETTE.hubGold] },
  { id: 'forest', center: [360, 48], radius: 120, palette: [PALETTE.forestOlive, PALETTE.forestAmber, PALETTE.forestHoney] },
  { id: 'cavern', center: [360, 152], radius: 120, palette: [PALETTE.cavernIndigo, PALETTE.cavernMid, PALETTE.cavernTeal] },
  { id: 'crown', center: [515, 100], radius: 125, palette: [PALETTE.crownPearl, PALETTE.crownBlush, PALETTE.crownGold] },
]);

/**
 * World-wide painterly watercolor variation map (1024x512, NOT tiling) for the 600x200 world.
 */
export function buildMacro(regions = DEFAULT_WORLD_REGIONS, w = 1024, h = 512, seed = 1337, dabMult = 1) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  // Paint smooth watercolor region wash at 1/4 res (256x128) and upscale smoothly onto full canvas (16x faster!)
  const lw = Math.min(256, w), lh = Math.min(128, h);
  const low = makeCanvas(lw, lh);
  const wash = domainWarp(lw, lh, { scaleX: 6, scaleY: 3, octaves: 3, warpAmp: 0.25, seed, wrapX: false, wrapY: false, fast: false });
  const mottling = fbm(lw, lh, { scaleX: 14, scaleY: 7, octaves: 3, seed: seed + 37, wrapX: false, wrapY: false, fast: false });

  const img = low.g.createImageData(lw, lh);
  const px = img.data;
  const parsed = regions.map((r) => ({
    cx: r.center[0] / 600,
    cy: r.center[1] / 200,
    rx: r.radius / 600,
    ry: r.radius / 200,
    cols: r.palette.map(hexToRgb),
  }));

  const dryGold = hexToRgb(PALETTE.hubGold);
  const mossDark = hexToRgb(PALETTE.marshHollow);
  const lightMeadow = hexToRgb(PALETTE.cream);

  let idx = 0;
  for (let y = 0; y < lh; y++) {
    const vy = y / lh;
    for (let x = 0; x < lw; x++) {
      const vx = x / lw;
      const n = wash[idx];
      const m = mottling[idx];

      let wr = 0, wg = 0, wb = 0, wSum = 0;
      for (let k = 0; k < parsed.length; k++) {
        const reg = parsed[k];
        const dx = (vx - reg.cx) / reg.rx;
        const dy = (vy - reg.cy) / reg.ry;
        const d2 = dx * dx + dy * dy;
        const weight = Math.exp(-d2 * 1.45) + 0.04;
        const cPick = n < 0.5 ? reg.cols[0] : n < 0.78 ? reg.cols[1] : reg.cols[2];
        wr += cPick[0] * weight;
        wg += cPick[1] * weight;
        wb += cPick[2] * weight;
        wSum += weight;
      }

      let r = wr / wSum;
      let gr = wg / wSum;
      let b = wb / wSum;

      const goldAmt = smoothstep(0.62, 0.88, m) * 0.22;
      const darkAmt = smoothstep(0.36, 0.12, n) * 0.18;
      const liftAmt = smoothstep(0.68, 0.92, n) * 0.16;

      r = r * (1 - goldAmt) + dryGold[0] * goldAmt;
      gr = gr * (1 - goldAmt) + dryGold[1] * goldAmt;
      b = b * (1 - goldAmt) + dryGold[2] * goldAmt;

      r = r * (1 - darkAmt) + mossDark[0] * darkAmt;
      gr = gr * (1 - darkAmt) + mossDark[1] * darkAmt;
      b = b * (1 - darkAmt) + mossDark[2] * darkAmt;

      r = r * (1 - liftAmt) + lightMeadow[0] * liftAmt;
      gr = gr * (1 - liftAmt) + lightMeadow[1] * liftAmt;
      b = b * (1 - liftAmt) + lightMeadow[2] * liftAmt;

      const p = idx * 4;
      px[p] = 178 + (r - 128) * 0.52;
      px[p + 1] = 178 + (gr - 128) * 0.52;
      px[p + 2] = 174 + (b - 128) * 0.52;
      px[p + 3] = 255;
      idx++;
    }
  }
  low.g.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(low.canvas, 0, 0, w, h);

  scatterDabs(g, rand, {
    count: Math.round(200 * dabMult),
    colors: [PALETTE.hubGold, PALETTE.marsh, PALETTE.cream, PALETTE.crownBlush, PALETTE.cavernTeal],
    minR: 0.04,
    maxR: 0.14,
    minAlpha: 0.05,
    maxAlpha: 0.11,
    wrapX: false,
    wrapY: false,
  });

  addGrain(g, 0.025, seed, false);
  return canvas;
}

// =========================================================================
// T1 Registrations (Exact 18 IDs)
// =========================================================================

// 1. land.marsh
register('land.marsh', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Marshes sage moss-grass terrain',
  baseColor: PALETTE.marsh,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 4, warpAmp: 0.25, seed });
    const hollows = fbm(w, h, { scaleX: 8, scaleY: 8, octaves: 3, seed: seed + 19 });
    const field = new Float32Array(w * h);
    for (let i = 0; i < field.length; i++) field[i] = Math.max(0, Math.min(1, f[i] * 0.65 + hollows[i] * 0.35));

    rampMap(field, [
      { t: 0.0, color: PALETTE.marshHollow },
      { t: 0.28, color: PALETTE.marshDark },
      { t: 0.64, color: PALETTE.marsh },
      { t: 0.92, color: PALETTE.marshLight },
      { t: 1.0, color: PALETTE.cream },
    ], g, w, h);

    // Clumpy moss dabs 8..14 px scaled to resolution
    const s = w / 512;
    scatterDabs(g, rand, {
      count: Math.round(380 * ctx.dabMult),
      colors: [PALETTE.marsh, PALETTE.marshDark, PALETTE.marshLight, PALETTE.marshHollow],
      minR: (8 * s) / w,
      maxR: (16 * s) / w,
      minAlpha: 0.07,
      maxAlpha: 0.18,
    });

    // Cream flecks #F4E9CD & tiny moss tufts
    for (let i = 0; i < 65; i++) {
      wrappedEllipse(g, rand() * w, rand() * h, w * (0.004 + rand() * 0.005), w * 0.004, rand() * Math.PI, PALETTE.cream, 0.42);
    }
    finishSurface(g, field, { aoStrength: 0.35, warmLift: 0.06, seed });
    return canvas;
  },
});

// 2. land.hub
register('land.hub', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Hub lush meadow with clover and daisies',
  baseColor: PALETTE.hubMeadow,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 4, warpAmp: 0.26, seed });
    const dry = fbm(w, h, { scaleX: 3, scaleY: 3, octaves: 3, seed: seed + 29 });
    const field = new Float32Array(w * h);
    for (let i = 0; i < field.length; i++) field[i] = Math.max(0, Math.min(1, f[i] * 0.58 + dry[i] * 0.42));

    rampMap(field, [
      { t: 0.0, color: PALETTE.hubMeadow },
      { t: 0.52, color: PALETTE.marsh },
      { t: 0.85, color: PALETTE.hubGold },
      { t: 1.0, color: PALETTE.cream },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(380 * ctx.dabMult),
      colors: [PALETTE.hubMeadow, PALETTE.marsh, PALETTE.hubGold, PALETTE.marshLight],
      minR: 0.015,
      maxR: 0.052,
      minAlpha: 0.06,
      maxAlpha: 0.17,
    });

    // Clover clusters & tiny daisy specks
    for (let i = 0; i < 52; i++) {
      const cx = rand() * w, cy = rand() * h;
      for (let k = 0; k < 3; k++) {
        const a = k * 2.094 + rand() * 0.3;
        wrappedEllipse(g, cx + Math.cos(a) * w * 0.008, cy + Math.sin(a) * w * 0.008, w * 0.006, w * 0.005, a, PALETTE.hubMeadow, 0.38);
      }
    }
    for (let d = 0; d < 28; d++) {
      const dx = rand() * w, dy = rand() * h;
      wrappedEllipse(g, dx, dy, w * 0.0065, w * 0.0065, 0, PALETTE.brightest, 0.62);
      wrappedEllipse(g, dx, dy, w * 0.0028, w * 0.0028, 0, PALETTE.forestAmber, 0.72);
    }
    finishSurface(g, field, { aoStrength: 0.3, warmLift: 0.07, seed });
    return canvas;
  },
});

// 3. land.forest
register('land.forest', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Forest warm amber leaf-litter terrain',
  baseColor: PALETTE.forestAmber,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 4, warpAmp: 0.24, seed });

    rampMap(f, [
      { t: 0.0, color: PALETTE.forestBrown },
      { t: 0.32, color: PALETTE.forestOlive },
      { t: 0.66, color: PALETTE.forestAmber },
      { t: 0.94, color: PALETTE.forestHoney },
      { t: 1.0, color: PALETTE.sun },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(360 * ctx.dabMult),
      colors: [PALETTE.forestAmber, PALETTE.forestHoney, PALETTE.forestOlive, PALETTE.forestBrown],
      minR: 0.015,
      maxR: 0.048,
      minAlpha: 0.07,
      maxAlpha: 0.17,
    });

    // Small leaf-shaped dabs with midrib, randomly rotated
    const leafCols = [PALETTE.forestAmber, PALETTE.forestHoney, PALETTE.forestOlive, PALETTE.sun];
    for (let i = 0; i < 85; i++) {
      const lx = rand() * w, ly = rand() * h;
      const rx = w * (0.014 + rand() * 0.014);
      const ry = rx * 0.52;
      const rot = rand() * Math.PI * 2;
      wrappedEllipse(g, lx, ly, rx, ry, rot, leafCols[(rand() * leafCols.length) | 0], 0.52);
      const dx = Math.cos(rot) * rx * 0.85, dy = Math.sin(rot) * rx * 0.85;
      wrappedPolyline(g, [[lx - dx, ly - dy], [lx + dx, ly + dy]], PALETTE.forestBrown, Math.max(0.8, w * 0.002), 0.38);
    }
    // Pine-needle strokes
    hatch(g, rand, { count: 70, angle: 0, len: 0.032, color: PALETTE.ink, lineWidth: Math.max(0.8, w * 0.002), alpha: 0.24 });

    finishSurface(g, f, { aoStrength: 0.42, warmLift: 0.07, seed });
    return canvas;
  },
});

// 4 & 5. land.cavern + land.cavern.rough (shared Worley + ridged stone field)
function getCavernData(w, h, seed) {
  return getOrComputeField(`cavern_${w}_${h}_${seed}`, () => {
    const wo = worley(w, h, { cellsX: 6, cellsY: 6, jitter: 0.78, warpAmp: 0.04, seed });
    const r = ridgedFbm(w, h, { scaleX: 5, scaleY: 5, octaves: 3, warpAmp: 0.16, seed: seed + 17 });
    const len = w * h;
    const height = new Float32Array(len);
    const gray = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const crack = smoothstep(0.02, 0.15, wo.edge[i]);
      height[i] = Math.max(0.05, Math.min(1, crack * 0.65 + r[i] * 0.35));
      gray[i] = Math.max(0.08, Math.min(0.95, r[i] * 0.5 + crack * 0.35 + wo.id[i] * 0.15));
    }
    return { wo, height, gray };
  });
}

register('land.cavern', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Caverns indigo stone with teal moss cracks and pink spores',
  baseColor: PALETTE.cavernIndigo,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const { wo, height, gray } = getCavernData(w, h, seed);

    rampMap(gray, [
      { t: 0.0, color: PALETTE.cavernFloor },
      { t: 0.35, color: PALETTE.cavernIndigo },
      { t: 0.80, color: PALETTE.cavernMid },
      { t: 1.0, color: mixHex(PALETTE.cavernMid, PALETTE.cavernTeal, 0.35) },
    ], g, w, h);

    // 25% teal moss along Worley cell edges
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const teal = hexToRgb(PALETTE.cavernTeal);
    for (let i = 0; i < wo.edge.length; i++) {
      const moss = smoothstep(0.14, 0.02, wo.edge[i]) * 0.28;
      if (moss > 0.01) {
        const p = i * 4;
        d[p] = d[p] * (1 - moss) + teal[0] * moss;
        d[p + 1] = d[p + 1] * (1 - moss) + teal[1] * moss;
        d[p + 2] = d[p + 2] * (1 - moss) + teal[2] * moss;
      }
    }
    g.putImageData(img, 0, 0);

    scatterDabs(g, rand, {
      count: Math.round(340 * ctx.dabMult),
      colors: [PALETTE.cavernIndigo, PALETTE.cavernMid, PALETTE.cavernTeal, PALETTE.cavernFloor],
      minR: 0.018,
      maxR: 0.055,
      minAlpha: 0.06,
      maxAlpha: 0.15,
    });

    // Pink spore specks #E27BB1
    for (let i = 0; i < 42; i++) {
      wrappedEllipse(g, rand() * w, rand() * h, w * (0.004 + rand() * 0.005), w * 0.004, 0, PALETTE.cavernRose, 0.55);
    }

    finishSurface(g, height, { aoStrength: 0.42, warmLift: 0.04, seed });
    return canvas;
  },
});

register('land.cavern.rough', {
  size: 512,
  tile: true,
  space: 'linear',
  kind: 'data',
  usage: 'Caverns roughness map (wet gloss in Worley cracks)',
  baseColor: '#b8b8b8',
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    // Match cavern master seed derivation by passing the base cavern key seed
    const { wo, height } = getCavernData(w, h, seed);
    const img = g.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < height.length; i++) {
      // Wet glossy cracks (roughness ~0.22) vs matte indigo stone (~0.84)
      const crack = smoothstep(0.14, 0.02, wo.edge[i]);
      const rough = Math.max(0.18, Math.min(0.92, 0.84 - crack * 0.58 - (1 - height[i]) * 0.08));
      const v = (rough * 255) | 0;
      const p = i * 4;
      d[p] = v; d[p + 1] = v; d[p + 2] = v; d[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvas;
  },
});

// 6. land.crown
register('land.crown', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Crown pearl marble-cloud terrain with blush veins and gold dust',
  baseColor: PALETTE.crownPearl,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const cloud = domainWarp(w, h, { scaleX: 3, scaleY: 3, octaves: 4, warpAmp: 0.3, seed });
    const ridge = ridgedFbm(w, h, { scaleX: 4, scaleY: 4, octaves: 3, warpAmp: 0.25, seed: seed + 43 });

    const field = new Float32Array(w * h);
    for (let i = 0; i < field.length; i++) {
      field[i] = Math.max(0.08, Math.min(0.98, cloud[i] * 0.72 + Math.pow(ridge[i], 3) * 0.35));
    }

    rampMap(field, [
      { t: 0.0, color: PALETTE.crownCool },
      { t: 0.30, color: PALETTE.crownPearl },
      { t: 0.72, color: PALETTE.paper },
      { t: 0.90, color: PALETTE.crownBlush },
      { t: 1.0, color: PALETTE.crownGold },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(340 * ctx.dabMult),
      colors: [PALETTE.crownPearl, PALETTE.crownBlush, PALETTE.crownCool, PALETTE.paper],
      minR: 0.024,
      maxR: 0.08,
      minAlpha: 0.05,
      maxAlpha: 0.14,
    });

    // Blush veins & sparse gold dust #F2C879
    veins(g, rand, { count: 8, segs: 7, step: 0.04, color: PALETTE.crownBlush, lineWidth: Math.max(1.2, w * 0.004), alpha: 0.34 });
    for (let i = 0; i < 48; i++) {
      wrappedEllipse(g, rand() * w, rand() * h, w * 0.004, w * 0.004, 0, PALETTE.crownGold, 0.55);
    }

    finishSurface(g, cloud, { aoStrength: 0.22, warmLift: 0.08, seed });
    return canvas;
  },
});

// 7 & 8. land.scales + land.scales.normal (Giant's overlapping soft scales)
function getScalesField(w, h, seed) {
  return getOrComputeField(`scales_${w}_${h}_${seed}`, () => {
    const rw = w > 256 ? 256 : w, rh = h > 256 ? 256 : h;
    const heightLow = new Float32Array(rw * rh);
    const rimLow = new Float32Array(rw * rh);
    const warp = fbm(rw, rh, { scaleX: 4, scaleY: 4, octaves: 2, seed: seed + 9, fast: false });
    const rows = 6;
    const cols = 6;

    for (let y = 0; y < rh; y++) {
      const vy = y / rh;
      for (let x = 0; x < rw; x++) {
        const vx = x / rw;
        const idx = y * rw + x;
        const wx = (warp[idx] - 0.5) * 0.14;
        const wy = (warp[(idx + 7919) % heightLow.length] - 0.5) * 0.12;

        let bestH = 0;
        let bestRim = 0;
        const gy = ((vy * rows + wy) % rows + rows) % rows;
        const baseRow = Math.floor(gy);

        for (let dr = 0; dr <= 1; dr++) {
          const rIdx = (baseRow - dr + rows) % rows;
          const stagger = (rIdx % 2) * 0.5;
          const gx = ((vx * cols + stagger + wx) % cols + cols) % cols;
          const lx = (gx - Math.floor(gx)) - 0.5;
          const ly = (gy - Math.floor(gy)) + dr;
          const dx = lx * 1.15, dy = (ly - 0.55) * 0.92;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.62) {
            const dome = smoothstep(0.62, 0.05, dist) * (0.65 + 0.35 * (1 - ly * 0.4));
            const topRim = smoothstep(0.60, 0.44, dist) * smoothstep(0.32, 0.52, dist) * smoothstep(0.75, 0.25, ly);
            if (dome > bestH) { bestH = dome; bestRim = topRim; }
          }
        }
        heightLow[idx] = Math.max(0.08, Math.min(1, bestH));
        rimLow[idx] = bestRim;
      }
    }
    if (rw === w && rh === h) return { height: heightLow, rim: rimLow };
    const height = new Float32Array(w * h);
    const rim = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const sy = (y >> 1) * rw, dyRow = y * w;
      for (let x = 0; x < w; x++) {
        const si = sy + (x >> 1);
        height[dyRow + x] = heightLow[si];
        rim[dyRow + x] = rimLow[si];
      }
    }
    return { height, rim };
  });
}

register('land.scales', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Giant skin soft scale overlay (tiles every 40 world units)',
  baseColor: '#8d867a',
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const { height, rim } = getScalesField(w, h, seed);
    const field = new Float32Array(w * h);
    for (let i = 0; i < field.length; i++) {
      field[i] = Math.max(0.12, Math.min(0.95, 0.38 + height[i] * 0.42 + rim[i] * 0.22));
    }

    // Near 50% warm gray for clean overlay/multiply blending
    rampMap(field, [
      { t: 0.0, color: '#645E58' },
      { t: 0.48, color: '#8C8478' },
      { t: 0.80, color: '#A89E8E' },
      { t: 1.0, color: '#C8BDA8' },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(240 * ctx.dabMult),
      colors: ['#8C8478', '#A89E8E', '#726B62'],
      minR: 0.02,
      maxR: 0.06,
      minAlpha: 0.05,
      maxAlpha: 0.12,
    });
    finishSurface(g, height, { aoStrength: 0.38, warmLift: 0.06, seed });
    return canvas;
  },
});

register('land.scales.normal', {
  size: 512,
  tile: true,
  space: 'linear',
  kind: 'data',
  usage: 'Giant skin soft scale normal map',
  baseColor: '#8080ff',
  build(w, h, seed) {
    const { height } = getScalesField(w, h, seed);
    return heightToNormal(height, w, h, 2.0, true, true);
  },
});

// 9. land.macro
register('land.macro', {
  size: [1024, 512],
  tile: false,
  space: 'srgb',
  kind: 'tile',
  usage: 'World-wide watercolor variation map across 600x200 world',
  baseColor: PALETTE.cream,
  build(w, h, seed, ctx) {
    return buildMacro(DEFAULT_WORLD_REGIONS, w, h, seed, ctx.dabMult);
  },
});

// 10. land.cliff
register('land.cliff', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Flat-facet rock cliff with strata and top-edge moss',
  baseColor: PALETTE.cliffLight,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const strata = ridgedFbm(w, h, { scaleX: 3, scaleY: 9, octaves: 4, warpAmp: 0.14, seed });
    const blocks = worley(w, h, { cellsX: 4, cellsY: 6, jitter: 0.65, warpAmp: 0.03, seed: seed + 23 });
    const field = new Float32Array(w * h);
    for (let i = 0; i < field.length; i++) {
      const facet = smoothstep(0.02, 0.14, blocks.edge[i]);
      field[i] = Math.max(0.08, Math.min(0.95, strata[i] * 0.52 + facet * 0.32 + blocks.id[i] * 0.16));
    }

    rampMap(field, [
      { t: 0.0, color: PALETTE.coolShadow },
      { t: 0.25, color: PALETTE.cliffDark },
      { t: 0.65, color: PALETTE.cliffLight },
      { t: 1.0, color: PALETTE.stoneLight },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(320 * ctx.dabMult),
      colors: [PALETTE.cliffLight, PALETTE.cliffDark, PALETTE.stone, PALETTE.coolShadow],
      minR: 0.018,
      maxR: 0.058,
      minAlpha: 0.06,
      maxAlpha: 0.16,
    });

    // Horizontal strata cracks & subtle moss hint on top ledges
    for (let s = 0; s < 14; s++) {
      const y = rand() * h;
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([(k / 8) * w, y + Math.sin((k / 8) * Math.PI * 2 + s) * h * 0.018]);
      wrappedPolyline(g, pts, PALETTE.coolShadow, Math.max(1, w * 0.004), 0.35);
      if (s % 3 === 0) wrappedPolyline(g, pts.map(([px, py]) => [px, py - h * 0.008]), PALETTE.marshDark, Math.max(2, w * 0.01), 0.24);
    }

    finishSurface(g, field, { aoStrength: 0.5, warmLift: 0.05, seed });
    return canvas;
  },
});

// 11. path.dirt
register('path.dirt', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Warm tan dirt path with pebbles and faint ruts',
  baseColor: PALETTE.dirt,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 4, warpAmp: 0.22, seed });
    const field = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        // Faint wagon ruts running vertically
        const rut = Math.sin((x / w) * Math.PI * 4) * 0.07;
        field[i] = Math.max(0.08, Math.min(0.95, f[i] * 0.85 + 0.08 + rut));
      }
    }

    rampMap(field, [
      { t: 0.0, color: PALETTE.mortar },
      { t: 0.35, color: PALETTE.stone },
      { t: 0.72, color: PALETTE.dirt },
      { t: 1.0, color: PALETTE.cream },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(340 * ctx.dabMult),
      colors: [PALETTE.dirt, PALETTE.stone, PALETTE.mortar, PALETTE.cream],
      minR: 0.015,
      maxR: 0.052,
      minAlpha: 0.06,
      maxAlpha: 0.16,
    });

    // Small pebbles & darker damp specks
    for (let i = 0; i < 65; i++) {
      wrappedEllipse(g, rand() * w, rand() * h, w * (0.005 + rand() * 0.009), w * (0.004 + rand() * 0.007), rand() * Math.PI, rand() > 0.4 ? PALETTE.stoneLight : PALETTE.mortar, 0.5);
    }

    finishSurface(g, field, { aoStrength: 0.35, warmLift: 0.06, seed });
    return canvas;
  },
});

// 12. path.dirt.strip (256x512, tiles in Y only, soft alpha edges over 25% of each side)
register('path.dirt.strip', {
  size: [256, 512],
  tile: false,
  tileX: false,
  tileY: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Dirt path ribbon strip with soft alpha sides & grass nicks',
  baseColor: PALETTE.dirt,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 3, scaleY: 6, octaves: 4, warpAmp: 0.18, seed, wrapX: false, wrapY: true });

    rampMap(f, [
      { t: 0.0, color: PALETTE.mortar },
      { t: 0.4, color: PALETTE.stone },
      { t: 0.75, color: PALETTE.dirt },
      { t: 1.0, color: PALETTE.cream },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(240 * ctx.dabMult),
      colors: [PALETTE.dirt, PALETTE.stone, PALETTE.cream, PALETTE.mortar],
      minR: 0.025,
      maxR: 0.08,
      minAlpha: 0.06,
      maxAlpha: 0.16,
      wrapX: false,
      wrapY: true,
    });

    // Pebbles & grass nicks near edges
    for (let i = 0; i < 45; i++) {
      const gx = rand() > 0.5 ? w * (0.14 + rand() * 0.15) : w * (0.71 + rand() * 0.15);
      const gy = rand() * h;
      wrappedEllipse(g, gx, gy, w * 0.03, h * 0.012, (rand() - 0.5) * 0.8, PALETTE.marshDark, 0.36, false, true);
    }

    finishSurface(g, f, { aoStrength: 0.3, warmLift: 0.05, seed, wrapX: false, wrapY: true });

    // Soft alpha fade over 25% of each side with organic wobble (periodic in Y)
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const edgeNoise = fbm(w, h, { scaleX: 4, scaleY: 8, octaves: 3, seed: seed + 71, wrapX: false, wrapY: true });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const u = x / (w - 1);
        const distSide = Math.min(u, 1 - u);
        const wob = (edgeNoise[idx] - 0.5) * 0.1;
        const a = smoothstep(0.02, 0.27, distSide + wob);
        d[idx * 4 + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(img, 0, 0);
    dilateAlphaEdges(canvas, 5, { wrapX: false, wrapY: true });
    return canvas;
  },
});

// 13. path.cobble
register('path.cobble', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Small rounded pebble cobblestone near towers',
  baseColor: PALETTE.stone,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const wo = worley(w, h, { cellsX: 8, cellsY: 8, jitter: 0.78, warpAmp: 0.035, seed });
    const gNoise = fbm(w, h, { scaleX: 8, scaleY: 8, octaves: 3, seed: seed + 31 });
    const len = w * h;
    const gray = new Float32Array(len);
    const height = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const m = smoothstep(0.03, 0.18, wo.edge[i]);
      height[i] = Math.max(0.06, Math.min(1, m * (0.72 + 0.28 * (1 - wo.f1[i]))));
      gray[i] = Math.max(0.08, Math.min(0.95, m * (0.45 + (wo.id[i] - 0.5) * 0.35 + (gNoise[i] - 0.5) * 0.15) + (1 - m) * 0.88));
    }

    rampMap(gray, [
      { t: 0.0, color: PALETTE.cliffDark },
      { t: 0.35, color: PALETTE.stone },
      { t: 0.72, color: PALETTE.stoneLight },
      { t: 0.90, color: PALETTE.cream },
      { t: 1.0, color: PALETTE.paper },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(320 * ctx.dabMult),
      colors: [PALETTE.stone, PALETTE.cliffLight, PALETTE.cream, PALETTE.stoneDark],
      minR: 0.012,
      maxR: 0.038,
      minAlpha: 0.06,
      maxAlpha: 0.15,
    });
    finishSurface(g, height, { aoStrength: 0.48, warmLift: 0.06, seed });
    return canvas;
  },
});

// 14. path.steps
register('path.steps', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Stepping-stone top with mossy rim',
  baseColor: PALETTE.stoneLight,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 3, warpAmp: 0.2, seed });
    const wo = worley(w, h, { cellsX: 3, cellsY: 3, jitter: 0.55, warpAmp: 0.04, seed: seed + 13 });
    const len = w * h;
    const gray = new Float32Array(len);
    const height = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const stone = smoothstep(0.04, 0.22, wo.edge[i]);
      height[i] = stone * (0.75 + f[i] * 0.2) + (1 - stone) * 0.15;
      gray[i] = stone * (0.55 + f[i] * 0.32) + (1 - stone) * 0.18;
    }

    rampMap(gray, [
      { t: 0.0, color: PALETTE.marshDark },
      { t: 0.28, color: PALETTE.marsh },
      { t: 0.55, color: PALETTE.stone },
      { t: 0.85, color: PALETTE.stoneLight },
      { t: 1.0, color: PALETTE.cream },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(300 * ctx.dabMult),
      colors: [PALETTE.stoneLight, PALETTE.cream, PALETTE.marsh, PALETTE.stone],
      minR: 0.018,
      maxR: 0.055,
      minAlpha: 0.06,
      maxAlpha: 0.16,
    });
    finishSurface(g, height, { aoStrength: 0.44, warmLift: 0.07, seed });
    return canvas;
  },
});

// 15. shore.mud
register('shore.mud', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Wet brown-green mud gradient for pool edges',
  baseColor: PALETTE.forestBrown,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 4, warpAmp: 0.25, seed });

    rampMap(f, [
      { t: 0.0, color: PALETTE.coolShadow },
      { t: 0.32, color: PALETTE.roofDark },
      { t: 0.66, color: PALETTE.forestBrown },
      { t: 0.90, color: PALETTE.marshHollow },
      { t: 1.0, color: PALETTE.stone },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(320 * ctx.dabMult),
      colors: [PALETTE.forestBrown, PALETTE.marshHollow, PALETTE.coolShadow, PALETTE.stoneDark],
      minR: 0.018,
      maxR: 0.065,
      minAlpha: 0.07,
      maxAlpha: 0.17,
    });
    finishSurface(g, f, { aoStrength: 0.38, warmLift: 0.05, seed });
    return canvas;
  },
});

// 16. water.pool
register('water.pool', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Teal pool water with tileable soft caustic web (scrolling)',
  baseColor: PALETTE.waterLight,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 3, warpAmp: 0.22, seed });
    const wo = worley(w, h, { cellsX: 5, cellsY: 5, jitter: 0.82, warpAmp: 0.05, seed: seed + 53 });
    const field = new Float32Array(w * h);
    for (let i = 0; i < field.length; i++) {
      // Soft inverse Worley caustic web (~10% lift)
      const caustic = smoothstep(0.18, 0.0, wo.edge[i]) * 0.22;
      field[i] = Math.max(0.06, Math.min(0.98, f[i] * 0.68 + 0.14 + caustic));
    }

    rampMap(field, [
      { t: 0.0, color: PALETTE.waterDeep },
      { t: 0.55, color: PALETTE.waterLight },
      { t: 0.85, color: PALETTE.marshMist },
      { t: 1.0, color: PALETTE.cream },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(280 * ctx.dabMult),
      colors: [PALETTE.waterLight, PALETTE.waterDeep, PALETTE.marshMist],
      minR: 0.025,
      maxR: 0.08,
      minAlpha: 0.06,
      maxAlpha: 0.14,
      aspectMin: 0.3,
      aspectMax: 0.6,
    });
    finishSurface(g, field, { aoStrength: 0.18, warmLift: 0.08, seed });
    return canvas;
  },
});

// 17. water.foam (256x64, tiles in X, cream scalloped foam strip with soft alpha)
register('water.foam', {
  size: [256, 64],
  tile: false,
  tileX: true,
  tileY: false,
  space: 'srgb',
  kind: 'tile',
  usage: 'Cream scalloped shore foam strip with soft alpha',
  baseColor: PALETTE.cream,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);

    // Scalloped cream foam bubbles repeating cleanly across X
    const lobes = 8;
    for (let i = 0; i < lobes; i++) {
      const cx = ((i + 0.5) / lobes) * w;
      const cy = h * (0.48 + Math.sin(i * 1.9 + seed) * 0.08);
      const rx = (w / lobes) * (0.68 + rand() * 0.18);
      const ry = h * (0.28 + rand() * 0.1);
      dab(g, cx, cy, rx, ry, 0, PALETTE.cream, 0.72, true, false);
      dab(g, cx, cy - h * 0.06, rx * 0.7, ry * 0.6, 0, PALETTE.brightest, 0.55, true, false);
    }
    for (let k = 0; k < 24; k++) {
      dab(g, rand() * w, h * (0.3 + rand() * 0.4), w * 0.03, h * 0.12, 0, PALETTE.paper, 0.45, true, false);
    }
    dilateAlphaEdges(canvas, 5, { wrapX: true, wrapY: false });
    return canvas;
  },
});

// 18. ground.moss
register('ground.moss', {
  size: 512,
  tile: true,
  space: 'srgb',
  kind: 'tile',
  usage: 'Dense teal-green moss tile with tiny spore glints for cavern rocks',
  baseColor: PALETTE.marshHollow,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 5, scaleY: 5, octaves: 4, warpAmp: 0.28, seed });

    rampMap(f, [
      { t: 0.0, color: PALETTE.coolShadow },
      { t: 0.35, color: PALETTE.marshHollow },
      { t: 0.72, color: PALETTE.marsh },
      { t: 0.94, color: PALETTE.cavernTeal },
      { t: 1.0, color: PALETTE.marshMist },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(380 * ctx.dabMult),
      colors: [PALETTE.marshHollow, PALETTE.marsh, PALETTE.coolShadow, PALETTE.cavernTeal],
      minR: 0.014,
      maxR: 0.044,
      minAlpha: 0.07,
      maxAlpha: 0.18,
    });

    for (let i = 0; i < 45; i++) {
      wrappedEllipse(g, rand() * w, rand() * h, w * 0.004, w * 0.004, 0, rand() > 0.3 ? PALETTE.cavernTeal : PALETTE.marshMist, 0.65);
    }

    finishSurface(g, f, { aoStrength: 0.42, warmLift: 0.05, seed });
    return canvas;
  },
});
