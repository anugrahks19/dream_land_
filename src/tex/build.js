/**
 * Dreamback Texture Kit — T2: Built Props: Stone, Roofs, Wood, Glass (24 ids)
 */

import { register, getOrComputeField } from './store.js';
import { PALETTE, shiftHexHue, mixHex } from './palette.js';
import {
  rng,
  fbm,
  domainWarp,
  ridgedFbm,
  smoothstep,
  makeCanvas,
  rampMap,
  dab,
  scatterDabs,
  wrappedPolyline,
  wrappedEllipse,
  grainLines,
  veins,
  finishSurface,
  heightToNormal,
} from './core.js';

// Shared offset rounded stone block masonry field for build.stone & build.stone.normal
function getStoneMasonry(w, h, seed) {
  return getOrComputeField(`stone_${w}_${h}_${seed}`, () => {
    const rw = w > 256 ? 256 : w, rh = h > 256 ? 256 : h;
    const wobble = fbm(rw, rh, { scaleX: 4, scaleY: 4, octaves: 2, seed: seed + 11, fast: false });
    const fineLow = fbm(rw, rh, { scaleX: 10, scaleY: 10, octaves: 2, seed: seed + 23, fast: false });
    const rows = 6;
    const cols = 4;
    const lenLow = rw * rh;
    const hLow = new Float32Array(lenLow);
    const mLow = new Float32Array(lenLow);
    const tLow = new Float32Array(lenLow);

    for (let y = 0; y < rh; y++) {
      const vy = y / rh;
      for (let x = 0; x < rw; x++) {
        const vx = x / rw;
        const i = y * rw + x;
        const wy = (wobble[i] - 0.5) * 0.16;
        const wx = (wobble[(i + 3571) % lenLow] - 0.5) * 0.12;

        const ry = ((vy * rows + 0.5 + wy) % rows + rows) % rows;
        const rIdx = Math.floor(ry);
        const ly = ry - rIdx;

        const stagger = (rIdx % 2) * 0.5;
        const rx = ((vx * cols + stagger + 0.5 + wx) % cols + cols) % cols;
        const cIdx = Math.floor(rx);
        const lx = rx - cIdx;

        const dx = Math.abs(lx - 0.5) * 2;
        const dy = Math.abs(ly - 0.5) * 2;
        const dx2 = dx * dx, dy2 = dy * dy;
        const corner = Math.sqrt(Math.sqrt(dx2 * dx2 + dy2 * dy2));
        const block = smoothstep(0.96, 0.78, corner);

        const hash = Math.sin((rIdx * 19.7 + cIdx * 43.1 + seed) * 1.13) * 0.5 + 0.5;
        mLow[i] = block;
        tLow[i] = (hash - 0.5) * 0.16;
        hLow[i] = Math.max(0.06, Math.min(1, block * (0.72 + (1 - corner) * 0.18 + fineLow[i] * 0.12) + (1 - block) * 0.14));
      }
    }
    if (rw === w && rh === h) return { height: hLow, blockMask: mLow, blockTint: tLow, fine: fineLow };
    const len = w * h;
    const height = new Float32Array(len);
    const blockMask = new Float32Array(len);
    const blockTint = new Float32Array(len);
    const fine = new Float32Array(len);
    for (let y = 0; y < h; y++) {
      const sy = (y >> 1) * rw, dyRow = y * w;
      for (let x = 0; x < w; x++) {
        const si = sy + (x >> 1), di = dyRow + x;
        height[di] = hLow[si];
        blockMask[di] = mLow[si];
        blockTint[di] = tLow[si];
        fine[di] = fineLow[si];
      }
    }
    return { height, blockMask, blockTint, fine };
  });
}

function paintStoneWall(w, h, seed, ctx, ruin = false) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  const { height, blockMask, blockTint, fine } = getStoneMasonry(w, h, seed);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const m = blockMask[i];
    gray[i] = Math.max(0.06, Math.min(0.96, m * (0.56 + blockTint[i] + (fine[i] - 0.5) * 0.22) + (1 - m) * 0.12));
  }

  rampMap(gray, [
    { t: 0.0, color: PALETTE.mortar },
    { t: 0.24, color: PALETTE.stoneDark },
    { t: 0.62, color: PALETTE.stone },
    { t: 0.92, color: PALETTE.stoneLight },
    { t: 1.0, color: PALETTE.cream },
  ], g, w, h);

  scatterDabs(g, rand, {
    count: Math.round(320 * ctx.dabMult),
    colors: [PALETTE.stone, PALETTE.stoneDark, PALETTE.stoneLight, PALETTE.cream],
    minR: 0.016,
    maxR: 0.048,
    minAlpha: 0.06,
    maxAlpha: 0.15,
  });

  // Lichen dabs (or heavy moss + cracks for ruin variant)
  const mossCount = ruin ? 95 : 22;
  for (let i = 0; i < mossCount; i++) {
    dab(
      g,
      rand() * w,
      rand() * h,
      w * (ruin ? 0.025 + rand() * 0.05 : 0.012 + rand() * 0.022),
      h * (ruin ? 0.02 + rand() * 0.04 : 0.01 + rand() * 0.018),
      rand() * Math.PI,
      ruin ? (rand() > 0.35 ? PALETTE.marshDark : PALETTE.lichen) : PALETTE.lichen,
      ruin ? 0.26 : 0.18
    );
  }
  veins(g, rand, { count: ruin ? 16 : 6, segs: 4, step: 0.028, color: PALETTE.ink, lineWidth: Math.max(1, w * 0.003), alpha: ruin ? 0.42 : 0.24 });

  finishSurface(g, height, { aoStrength: ruin ? 0.55 : 0.46, warmLift: 0.07, seed });
  return canvas;
}

// 1 & 2 & 3. build.stone, build.stone.normal, build.stone.ruin
register('build.stone', {
  size: 512, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Tower stone masonry (tiles every 4 world units)',
  baseColor: PALETTE.stone,
  build: (w, h, seed, ctx) => paintStoneWall(w, h, seed, ctx, false),
});

register('build.stone.normal', {
  size: 512, tile: true, space: 'linear', kind: 'data',
  usage: 'Tower stone masonry normal map',
  baseColor: '#8080ff',
  build(w, h, seed) {
    const { height } = getStoneMasonry(w, h, seed);
    return heightToNormal(height, w, h, 2.2, true, true);
  },
});

register('build.stone.ruin', {
  size: 512, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Mossy ruined stone masonry with chipped corners and cracks',
  baseColor: PALETTE.stoneDark,
  build: (w, h, seed, ctx) => paintStoneWall(w, h, seed, ctx, true),
});

// 4. build.stone.arch (256x128, tiles in X)
register('build.stone.arch', {
  size: [256, 128], tile: false, tileX: true, tileY: false, space: 'srgb', kind: 'tile',
  usage: 'Voussoir wedge stone strip for arches (tiles in X)',
  baseColor: PALETTE.stone,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const fine = fbm(w, h, { scaleX: 6, scaleY: 3, octaves: 3, seed, wrapX: true, wrapY: false });
    const wedges = 6;
    const height = new Float32Array(w * h);
    const gray = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      const vy = y / h;
      const borderY = smoothstep(0.0, 0.12, vy) * smoothstep(0.0, 0.12, 1 - vy);
      for (let x = 0; x < w; x++) {
        const vx = x / w;
        const i = y * w + x;
        const wx = ((vx * wedges + 0.5) % wedges);
        const idx = Math.floor(wx);
        const lx = wx - idx;
        const joint = smoothstep(0.0, 0.08, lx) * smoothstep(0.0, 0.08, 1 - lx);
        const tint = Math.sin(idx * 3.7 + seed) * 0.1;
        height[i] = joint * borderY * (0.72 + fine[i] * 0.24) + (1 - joint * borderY) * 0.15;
        gray[i] = Math.max(0.08, Math.min(0.95, joint * borderY * (0.58 + tint + (fine[i] - 0.5) * 0.2) + (1 - joint * borderY) * 0.14));
      }
    }

    rampMap(gray, [PALETTE.mortar, PALETTE.stoneDark, PALETTE.stone, PALETTE.stoneLight], g, w, h);
    scatterDabs(g, rand, { count: Math.round(200 * ctx.dabMult), colors: [PALETTE.stone, PALETTE.stoneLight, PALETTE.lichen], minR: 0.03, maxR: 0.08, wrapX: true, wrapY: false });
    finishSurface(g, height, { aoStrength: 0.44, seed, wrapX: true, wrapY: false });
    return canvas;
  },
});

// 5 & 6. build.roof & build.roof.moss (256 tile)
function paintRoof(w, h, seed, ctx, mossy = false) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  const wood = ridgedFbm(w, h, { scaleX: 10, scaleY: 3, octaves: 3, warpAmp: 0.06, seed });
  const wobble = fbm(w, h, { scaleX: 4, scaleY: 4, octaves: 2, seed: seed + 19 });
  const rows = 6, cols = 6;
  const len = w * h;
  const gray = new Float32Array(len);
  const height = new Float32Array(len);

  for (let y = 0; y < h; y++) {
    const vy = y / h;
    for (let x = 0; x < w; x++) {
      const vx = x / w;
      const i = y * w + x;
      const ry = ((vy * rows + (wobble[i] - 0.5) * 0.16) % rows + rows) % rows;
      const rIdx = Math.floor(ry);
      const ly = ry - rIdx;
      const stagger = (rIdx % 2) * 0.5;
      const rx = ((vx * cols + stagger + (wobble[i] - 0.5) * 0.1) % cols + cols) % cols;
      const cIdx = Math.floor(rx);
      const lx = rx - cIdx;

      // Rounded-bottom scalloped shingle shape
      const side = smoothstep(0.0, 0.09, lx) * smoothstep(0.0, 0.09, 1 - lx);
      const dx = (lx - 0.5) * 2;
      const bottomCurve = 0.88 - dx * dx * 0.14;
      const lip = smoothstep(bottomCurve + 0.08, bottomCurve - 0.04, ly);
      const shift = Math.sin(rIdx * 17.3 + cIdx * 29.1 + seed) * 0.14;

      height[i] = Math.max(0.08, Math.min(1, side * (0.35 + ly * 0.55) * (0.3 + 0.7 * lip) + wood[i] * 0.1));
      gray[i] = Math.max(0.08, Math.min(0.95, 0.48 + shift + (wood[i] - 0.5) * 0.2 + (ly - 0.5) * 0.16 - (1 - side) * 0.3));
    }
  }

  rampMap(gray, [PALETTE.coolShadow, PALETTE.roofDark, PALETTE.roof, PALETTE.roofLight, PALETTE.stone], g, w, h);
  scatterDabs(g, rand, {
    count: Math.round(240 * ctx.dabMult),
    colors: [PALETTE.roof, PALETTE.roofLight, PALETTE.roofDark, PALETTE.lichen],
    minR: 0.02, maxR: 0.055, minAlpha: 0.06, maxAlpha: 0.15,
  });

  const mossN = mossy ? 58 : 12;
  for (let i = 0; i < mossN; i++) {
    dab(g, rand() * w, rand() * h, w * (0.02 + rand() * 0.045), h * (0.015 + rand() * 0.03), rand() * Math.PI, rand() > 0.4 ? PALETTE.marshDark : PALETTE.lichen, mossy ? 0.28 : 0.18);
  }
  finishSurface(g, height, { aoStrength: 0.52, warmLift: 0.06, seed });
  return canvas;
}

register('build.roof', {
  size: 256, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Rounded-bottom cottage roof shingles (tiles every 3 units)',
  baseColor: PALETTE.roof,
  build: (w, h, seed, ctx) => paintRoof(w, h, seed, ctx, false),
});

register('build.roof.moss', {
  size: 256, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Moss-covered roof shingle variant',
  baseColor: PALETTE.roof,
  build: (w, h, seed, ctx) => paintRoof(w, h, seed, ctx, true),
});

// 7. build.plaster
register('build.plaster', {
  size: 512, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Colony hut clay plaster (cream to sage with trowel strokes)',
  baseColor: PALETTE.cream,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 3, scaleY: 3, octaves: 4, warpAmp: 0.24, seed });

    rampMap(f, [
      { t: 0.0, color: PALETTE.marshMist },
      { t: 0.35, color: PALETTE.cream },
      { t: 0.72, color: PALETTE.paper },
      { t: 1.0, color: PALETTE.brightest },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(320 * ctx.dabMult),
      colors: [PALETTE.cream, PALETTE.marshMist, PALETTE.paper, PALETTE.peach],
      minR: 0.028, maxR: 0.09, minAlpha: 0.06, maxAlpha: 0.14,
    });
    veins(g, rand, { count: 6, segs: 5, step: 0.026, color: PALETTE.stone, lineWidth: Math.max(0.8, w * 0.0022), alpha: 0.32 });
    finishSurface(g, f, { aoStrength: 0.24, warmLift: 0.06, seed });
    return canvas;
  },
});

// 8 & 9. build.plank & build.plank.painted
function paintPlanks(w, h, seed, ctx, painted = false) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  const grain = domainWarp(w, h, { scaleX: 12, scaleY: 2, octaves: 4, warpAmp: 0.15, seed });
  const boards = 4;
  const len = w * h;
  const gray = new Float32Array(len);
  const height = new Float32Array(len);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const vx = ((x / w) + 0.5 / boards) * boards % boards;
      const bIdx = Math.floor(vx);
      const lx = vx - bIdx;
      const seam = smoothstep(0.0, 0.05, lx) * smoothstep(0.0, 0.05, 1 - lx);
      const tint = Math.sin((bIdx + 1) * 4.3 + seed) * 0.1;
      const ring = Math.sin(grain[i] * Math.PI * 6) * 0.5 + 0.5;
      height[i] = Math.max(0.08, seam * (0.68 + ring * 0.2 + grain[i] * 0.12));
      gray[i] = Math.max(0.08, Math.min(0.95, seam * (0.45 + tint + grain[i] * 0.25 + ring * 0.14) + (1 - seam) * 0.1));
    }
  }

  rampMap(gray, painted
    ? [PALETTE.ink, PALETTE.plank, PALETTE.stoneLight, PALETTE.cream, PALETTE.paper]
    : [PALETTE.ink, PALETTE.roof, PALETTE.plank, PALETTE.stone, PALETTE.sun],
    g, w, h
  );

  scatterDabs(g, rand, {
    count: Math.round(280 * ctx.dabMult),
    colors: painted ? [PALETTE.cream, PALETTE.plank, PALETTE.paper] : [PALETTE.plank, PALETTE.roof, PALETTE.stone],
    minR: 0.015, maxR: 0.055, minAlpha: 0.06, maxAlpha: 0.14, aspectMin: 0.2, aspectMax: 0.45,
  });

  // Vertical grain & knots & nail dots
  grainLines(g, rand, { count: 48, vertical: true, color: PALETTE.ink, lineWidth: Math.max(0.8, w * 0.0022), alpha: 0.22 });
  for (let b = 0; b < boards; b++) {
    const cx = (((b + 1) / boards) % 1) * w;
    wrappedEllipse(g, cx, h * 0.2, w * 0.008, w * 0.008, 0, PALETTE.ink, 0.6);
    wrappedEllipse(g, cx, h * 0.78, w * 0.008, w * 0.008, 0, PALETTE.ink, 0.6);
    if (painted) {
      // Chalky cream edge wear along board seams
      const seamX = ((b + 0.5) / boards) * w;
      wrappedPolyline(g, [[seamX, 0], [seamX, h]], PALETTE.cream, Math.max(2, w * 0.016), 0.32);
    }
  }
  finishSurface(g, height, { aoStrength: 0.44, warmLift: 0.06, seed });
  return canvas;
}

register('build.plank', {
  size: 512, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Warm vertical wood planks (tiles every 2 world units)',
  baseColor: PALETTE.plank,
  build: (w, h, seed, ctx) => paintPlanks(w, h, seed, ctx, false),
});

register('build.plank.painted', {
  size: 512, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Sign board wood planks with chalky cream edge wear',
  baseColor: PALETTE.cream,
  build: (w, h, seed, ctx) => paintPlanks(w, h, seed, ctx, true),
});

// 10. build.log (256: left half bark, right half end rings; tiles vertically along log)
register('build.log', {
  size: 256, tile: false, tileX: false, tileY: true, space: 'srgb', kind: 'tile',
  usage: 'Log texture: left half bark, right half end-grain rings (tiles in Y)',
  baseColor: PALETTE.forestBrown,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const barkF = ridgedFbm(w, h, { scaleX: 10, scaleY: 3, octaves: 3, seed });
    const half = w >> 1;

    // Left half: bark
    const img = g.createImageData(w, h);
    const d = img.data;
    const height = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x < half) {
          height[i] = barkF[i];
        } else {
          // Right half: concentric growth rings
          const dx = (x - (half + half * 0.5)) / (half * 0.5);
          const dy = (y - h * 0.5) / (h * 0.5);
          const r = Math.hypot(dx, dy) + (barkF[i] - 0.5) * 0.08;
          const ring = Math.sin(r * Math.PI * 10) * 0.5 + 0.5;
          height[i] = r > 0.88 ? 0.25 : 0.55 + ring * 0.35;
        }
      }
    }
    g.putImageData(img, 0, 0);
    rampMap(height, [PALETTE.ink, PALETTE.forestBrown, PALETTE.plank, PALETTE.stoneLight, PALETTE.cream], g, w, h);
    scatterDabs(g, rand, { count: Math.round(200 * ctx.dabMult), colors: [PALETTE.forestBrown, PALETTE.plank, PALETTE.cream], minR: 0.02, maxR: 0.06, minAlpha: 0.06, maxAlpha: 0.14 });
    finishSurface(g, height, { aoStrength: 0.4, seed });
    return canvas;
  },
});

// 11. build.rope (64x128 tile)
register('build.rope', {
  size: [64, 128], tile: true, space: 'srgb', kind: 'tile',
  usage: 'Twisted diagonal rope stripe tile',
  baseColor: PALETTE.stone,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const height = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const diag = ((x / w) * 2 + (y / h) * 4) * Math.PI * 2;
        const twist = Math.sin(diag) * 0.5 + 0.5;
        height[y * w + x] = 0.25 + twist * 0.65;
      }
    }
    rampMap(height, [PALETTE.ink, PALETTE.mortar, PALETTE.dirt, PALETTE.cream], g, w, h);
    scatterDabs(g, rand, { count: 200, colors: [PALETTE.dirt, PALETTE.cream, PALETTE.mortar], minR: 0.05, maxR: 0.14, minAlpha: 0.06, maxAlpha: 0.14 });
    finishSurface(g, height, { aoStrength: 0.4, seed });
    return canvas;
  },
});

// 12. build.barrel (128 tile)
register('build.barrel', {
  size: 128, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Wooden barrel staves with two iron hoops',
  baseColor: PALETTE.plank,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const staves = 6;
    const f = fbm(w, h, { scaleX: 6, scaleY: 3, octaves: 3, seed });
    const height = new Float32Array(w * h);
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const vy = y / h;
      const band = (Math.abs(vy - 0.24) < 0.065 || Math.abs(vy - 0.76) < 0.065);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const lx = ((x / w) * staves + 0.5) % 1;
        const seam = smoothstep(0, 0.08, lx) * smoothstep(0, 0.08, 1 - lx);
        height[i] = band ? 0.9 : seam * (0.65 + f[i] * 0.2);
        gray[i] = band ? 0.12 : seam * (0.45 + f[i] * 0.35);
      }
    }
    rampMap(gray, [PALETTE.coolShadow, PALETTE.ink, PALETTE.roof, PALETTE.plank, PALETTE.stone], g, w, h);
    scatterDabs(g, rand, { count: 200, colors: [PALETTE.plank, PALETTE.roof, PALETTE.stone], minR: 0.03, maxR: 0.08, minAlpha: 0.06, maxAlpha: 0.14 });
    finishSurface(g, height, { aoStrength: 0.42, seed });
    return canvas;
  },
});

// 13. build.door (256 clamp)
register('build.door', {
  size: 256, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Round storybook wooden cottage door with iron straps',
  baseColor: PALETTE.roof,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = fbm(w, h, { scaleX: 8, scaleY: 3, octaves: 3, seed, wrapX: false, wrapY: false });
    rampMap(f, [PALETTE.roofDark, PALETTE.roof, PALETTE.plank, PALETTE.stone], g, w, h);
    scatterDabs(g, rand, { count: Math.round(220 * ctx.dabMult), colors: [PALETTE.roof, PALETTE.plank, PALETTE.stone], minR: 0.025, maxR: 0.07, wrapX: false, wrapY: false });

    // Plank seams
    for (let i = 1; i < 5; i++) {
      const x = (i / 5) * w;
      wrappedPolyline(g, [[x, 0], [x, h]], PALETTE.ink, Math.max(1.5, w * 0.012), 0.55, false, false);
    }
    // Iron hinge bands & round brass knob
    g.fillStyle = PALETTE.coolShadow;
    g.globalAlpha = 0.78;
    g.fillRect(0, h * 0.25, w * 0.62, h * 0.085);
    g.fillRect(0, h * 0.68, w * 0.62, h * 0.085);
    g.globalAlpha = 1;
    wrappedEllipse(g, w * 0.76, h * 0.52, w * 0.055, w * 0.055, 0, PALETTE.sun, 0.92, false, false);
    wrappedEllipse(g, w * 0.74, h * 0.50, w * 0.02, w * 0.02, 0, PALETTE.brightest, 0.75, false, false);

    // Circular frame shadow
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = w * 0.055;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(w * 0.5, h * 0.5, w * 0.47, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;

    finishSurface(g, f, { aoStrength: 0.35, seed, wrapX: false, wrapY: false });
    return canvas;
  },
});

// 14. build.trim (128 tile)
register('build.trim', {
  size: 128, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Shutters and cottage trim in sage and cream',
  baseColor: PALETTE.marshMist,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = fbm(w, h, { scaleX: 4, scaleY: 4, octaves: 3, seed });
    const height = new Float32Array(w * h);
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const slat = Math.cos(((y + 0.5) / h) * Math.PI * 12) * 0.5 + 0.5;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const ux = (x + 0.5) / w;
        const border = Math.min(ux, 1 - ux) < 0.14;
        height[i] = border ? 0.85 : 0.4 + slat * 0.4;
        gray[i] = border ? 0.88 : 0.25 + slat * 0.4 + f[i] * 0.15;
      }
    }
    rampMap(gray, [PALETTE.marshHollow, PALETTE.marsh, PALETTE.marshMist, PALETTE.cream, PALETTE.paper], g, w, h);
    scatterDabs(g, rand, { count: 200, colors: [PALETTE.marsh, PALETTE.marshMist, PALETTE.cream], minR: 0.03, maxR: 0.09, minAlpha: 0.06, maxAlpha: 0.14 });
    finishSurface(g, height, { aoStrength: 0.36, seed });
    return canvas;
  },
});

// 15 & 16. build.window & build.window.dark (128 clamp)
function paintWindow(w, h, seed, lit) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  const cx = w * 0.5, cy = h * 0.5;
  const grad = g.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.62);
  if (lit) {
    grad.addColorStop(0.0, PALETTE.brightest);
    grad.addColorStop(0.45, PALETTE.sun);
    grad.addColorStop(0.85, PALETTE.peach);
    grad.addColorStop(1.0, PALETTE.roof);
  } else {
    grad.addColorStop(0.0, PALETTE.cavernIndigo);
    grad.addColorStop(0.65, PALETTE.coolShadow);
    grad.addColorStop(1.0, PALETTE.darkest);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  scatterDabs(g, rand, {
    count: 200,
    colors: lit ? [PALETTE.sun, PALETTE.brightest, PALETTE.peach] : [PALETTE.coolShadow, PALETTE.cavernIndigo, PALETTE.marshMist],
    minR: 0.03, maxR: 0.1, minAlpha: 0.05, maxAlpha: 0.12, wrapX: false, wrapY: false,
  });

  // Soft wooden frame & cross mullions
  g.strokeStyle = PALETTE.ink;
  g.lineWidth = w * 0.09;
  g.strokeRect(w * 0.045, h * 0.045, w * 0.91, h * 0.91);
  g.lineWidth = w * 0.06;
  g.beginPath();
  g.moveTo(cx, 0); g.lineTo(cx, h);
  g.moveTo(0, cy); g.lineTo(w, cy);
  g.stroke();

  finishSurface(g, null, { aoStrength: 0, grainAmount: 0.025, seed, wrapX: false, wrapY: false });
  return canvas;
}

register('build.window', {
  size: 128, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Warm glowing cottage window with cross mullions (emissive)',
  baseColor: PALETTE.sun,
  build: (w, h, seed) => paintWindow(w, h, seed, true),
});

register('build.window.dark', {
  size: 128, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Unlit dusk window glass with cross mullions',
  baseColor: PALETTE.coolShadow,
  build: (w, h, seed) => paintWindow(w, h, seed, false),
});

// 17. build.lantern (128 clamp)
register('build.lantern', {
  size: 128, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Translucent amber lantern glass with bright core and frame',
  baseColor: PALETTE.sun,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const grad = g.createRadialGradient(w * 0.5, h * 0.5, w * 0.04, w * 0.5, h * 0.5, w * 0.55);
    grad.addColorStop(0.0, PALETTE.brightest);
    grad.addColorStop(0.38, PALETTE.sun);
    grad.addColorStop(0.78, PALETTE.forestAmber);
    grad.addColorStop(1.0, PALETTE.roof);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    scatterDabs(g, rand, { count: 200, colors: [PALETTE.sun, PALETTE.brightest, PALETTE.peach], minR: 0.03, maxR: 0.1, wrapX: false, wrapY: false });

    g.strokeStyle = PALETTE.ink;
    g.lineWidth = w * 0.07;
    g.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
    g.beginPath();
    g.moveTo(w * 0.25, 0); g.lineTo(w * 0.25, h);
    g.moveTo(w * 0.75, 0); g.lineTo(w * 0.75, h);
    g.stroke();
    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.025, seed, wrapX: false, wrapY: false });
    return canvas;
  },
});

// 18 & 19. build.gate & build.gate.emissive (512 tile)
function drawGateRunes(g, w, h, color, lw, alpha) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = alpha;
  // Repeating carved geometric storybook rune band across X and Y
  for (let row = 0; row < 2; row++) {
    const cy = (row * 0.5 + 0.25) * h;
    g.beginPath();
    for (let k = 0; k <= 16; k++) {
      const x = (k / 16) * w;
      const y = cy + Math.sin((k / 16) * Math.PI * 4) * h * 0.05;
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    for (let d = 0; d < 4; d++) {
      const cx = (d * 0.25 + 0.125) * w;
      const r = w * 0.04;
      g.beginPath();
      g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath();
      g.stroke();
    }
  }
  g.restore();
}

register('build.gate', {
  size: 512, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Caverns indigo carved stone gate',
  baseColor: PALETTE.cavernIndigo,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = ridgedFbm(w, h, { scaleX: 5, scaleY: 5, octaves: 4, warpAmp: 0.14, seed });
    rampMap(f, [PALETTE.cavernFloor, PALETTE.cavernIndigo, PALETTE.cavernMid, PALETTE.coolShadow], g, w, h);
    scatterDabs(g, rand, { count: Math.round(300 * ctx.dabMult), colors: [PALETTE.cavernIndigo, PALETTE.cavernMid, PALETTE.coolShadow], minR: 0.018, maxR: 0.055 });
    drawGateRunes(g, w, h, PALETTE.cavernFloor, Math.max(3, w * 0.012), 0.7);
    drawGateRunes(g, w, h, PALETTE.cavernTeal, Math.max(1.5, w * 0.005), 0.45);
    finishSurface(g, f, { aoStrength: 0.45, seed });
    return canvas;
  },
});

register('build.gate.emissive', {
  size: 512, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Glowing teal rune line emissive map for Caverns gate',
  baseColor: PALETTE.darkest,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    g.fillStyle = PALETTE.darkest;
    g.fillRect(0, 0, w, h);
    drawGateRunes(g, w, h, PALETTE.cavernTeal, Math.max(8, w * 0.032), 0.25);
    drawGateRunes(g, w, h, PALETTE.cavernTeal, Math.max(3, w * 0.012), 0.78);
    drawGateRunes(g, w, h, PALETTE.brightest, Math.max(1.4, w * 0.005), 0.85);
    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.015, seed });
    return canvas;
  },
});

// 20. build.altar (512 clamp)
register('build.altar', {
  size: 512, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Crown pearl stone circle altar top with rune ring',
  baseColor: PALETTE.crownPearl,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 4, warpAmp: 0.22, seed, wrapX: false, wrapY: false });
    rampMap(f, [PALETTE.crownCool, PALETTE.crownPearl, PALETTE.paper, PALETTE.crownBlush], g, w, h);
    scatterDabs(g, rand, { count: Math.round(320 * ctx.dabMult), colors: [PALETTE.crownPearl, PALETTE.crownBlush, PALETTE.crownGold, PALETTE.crownCool], minR: 0.02, maxR: 0.07, wrapX: false, wrapY: false });

    const cx = w * 0.5, cy = h * 0.5;
    // Concentric stone rings & rune ticks
    g.save();
    g.strokeStyle = PALETTE.stone;
    g.lineWidth = w * 0.012;
    g.globalAlpha = 0.55;
    g.beginPath(); g.arc(cx, cy, w * 0.44, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, w * 0.32, 0, Math.PI * 2); g.stroke();

    g.strokeStyle = PALETTE.crownGold;
    g.lineWidth = w * 0.008;
    g.globalAlpha = 0.72;
    g.beginPath(); g.arc(cx, cy, w * 0.38, 0, Math.PI * 2); g.stroke();

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * w * 0.33, cy + Math.sin(a) * w * 0.33);
      g.lineTo(cx + Math.cos(a) * w * 0.42, cy + Math.sin(a) * w * 0.42);
      g.stroke();
    }
    // Central sun emblem
    g.fillStyle = PALETTE.crownGold;
    g.globalAlpha = 0.5;
    g.beginPath(); g.arc(cx, cy, w * 0.09, 0, Math.PI * 2); g.fill();
    g.restore();

    finishSurface(g, f, { aoStrength: 0.25, warmLift: 0.08, seed, wrapX: false, wrapY: false });
    return canvas;
  },
});

// 21, 22, 23. build.altar.socket, .lit, .unlit (512x128 atlas: 4x128 in zone colors)
function paintAltarSockets(w, h, seed, mode) {
  const { canvas, g } = makeCanvas(w, h);
  const zones = [PALETTE.marsh, PALETTE.forestAmber, PALETTE.cavernTeal, PALETTE.crownBlush];
  const cellW = w / 4;

  g.fillStyle = mode === 'lit' ? PALETTE.darkest : PALETTE.crownPearl;
  g.fillRect(0, 0, w, h);

  for (let i = 0; i < 4; i++) {
    const cx = (i + 0.5) * cellW;
    const cy = h * 0.5;
    const r = Math.min(cellW, h) * 0.42;
    const col = zones[i];

    if (mode === 'lit') {
      const gr = g.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
      gr.addColorStop(0.0, PALETTE.brightest);
      gr.addColorStop(0.45, col);
      gr.addColorStop(1.0, PALETTE.darkest);
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    } else if (mode === 'unlit') {
      const gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      gr.addColorStop(0.0, PALETTE.stoneDark);
      gr.addColorStop(0.75, PALETTE.coolShadow);
      gr.addColorStop(1.0, PALETTE.stone);
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = PALETTE.stoneLight;
      g.lineWidth = r * 0.12;
      g.beginPath(); g.arc(cx, cy, r * 0.85, 0, Math.PI * 2); g.stroke();
    } else {
      const gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      gr.addColorStop(0.0, PALETTE.paper);
      gr.addColorStop(0.55, col);
      gr.addColorStop(0.88, PALETTE.stone);
      gr.addColorStop(1.0, PALETTE.crownPearl);
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = PALETTE.crownGold;
      g.lineWidth = r * 0.1;
      g.beginPath(); g.arc(cx, cy, r * 0.82, 0, Math.PI * 2); g.stroke();
    }
  }
  finishSurface(g, null, { aoStrength: 0, grainAmount: 0.02, seed, wrapX: false, wrapY: false });
  return canvas;
}

register('build.altar.socket', {
  size: [512, 128], tile: false, space: 'srgb', kind: 'tile',
  usage: 'Altar socket decals (4x128 atlas in zone colors)',
  baseColor: PALETTE.crownPearl,
  build: (w, h, seed) => paintAltarSockets(w, h, seed, 'base'),
});

register('build.altar.socket.lit', {
  size: [512, 128], tile: false, space: 'srgb', kind: 'tile',
  usage: 'Altar socket lit emissive atlas (4x128)',
  baseColor: PALETTE.sun,
  build: (w, h, seed) => paintAltarSockets(w, h, seed, 'lit'),
});

register('build.altar.socket.unlit', {
  size: [512, 128], tile: false, space: 'srgb', kind: 'tile',
  usage: 'Altar socket unlit carved stone atlas (4x128)',
  baseColor: PALETTE.stone,
  build: (w, h, seed) => paintAltarSockets(w, h, seed, 'unlit'),
});

// 24. build.rib (256 tile)
register('build.rib', {
  size: 256, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Giant-rib arch smooth pearl-indigo bone with faint growth rings',
  baseColor: PALETTE.crownPearl,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 3, scaleY: 6, octaves: 3, warpAmp: 0.16, seed });
    const field = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const ring = Math.sin((y / h) * Math.PI * 10) * 0.08;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        field[i] = Math.max(0.08, Math.min(0.96, f[i] * 0.72 + 0.16 + ring));
      }
    }

    rampMap(field, [
      { t: 0.0, color: PALETTE.cavernMid },
      { t: 0.30, color: PALETTE.crownCool },
      { t: 0.62, color: PALETTE.crownPearl },
      { t: 0.86, color: PALETTE.crownBlush },
      { t: 1.0, color: PALETTE.marshMist },
    ], g, w, h);

    scatterDabs(g, rand, {
      count: Math.round(220 * ctx.dabMult),
      colors: [PALETTE.crownPearl, PALETTE.crownBlush, PALETTE.marshMist, PALETTE.crownCool],
      minR: 0.025, maxR: 0.08, minAlpha: 0.05, maxAlpha: 0.13,
    });
    finishSurface(g, field, { aoStrength: 0.24, warmLift: 0.07, seed });
    return canvas;
  },
});
