/**
 * Dreamback Texture Kit — T3: Nature Props (22 ids)
 * Every sprite sits on transparent with zero white fringe via straight-alpha RGB dilation.
 */

import { register } from './store.js';
import { PALETTE, mixHex } from './palette.js';
import {
  rng,
  fbm,
  domainWarp,
  ridgedFbm,
  makeCanvas,
  rampMap,
  dab,
  scatterDabs,
  wrappedEllipse,
  wrappedPolyline,
  grainLines,
  finishSurface,
  dilateAlphaEdges,
} from './core.js';

// 1 & 2. nature.reed & nature.reed.cattail (64x256 alpha)
function paintReed(w, h, seed, cattail) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  g.clearRect(0, 0, w, h);

  const grad = g.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0.0, PALETTE.forestOlive);
  grad.addColorStop(0.55, PALETTE.marsh);
  grad.addColorStop(1.0, PALETTE.forestHoney);

  // Stalk
  g.save();
  g.strokeStyle = grad;
  g.lineWidth = w * 0.18;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.96);
  g.quadraticCurveTo(w * 0.44, h * 0.52, w * 0.52, h * (cattail ? 0.14 : 0.06));
  g.stroke();

  if (!cattail) {
    // Slender waving side blade
    g.lineWidth = w * 0.13;
    g.beginPath();
    g.moveTo(w * 0.48, h * 0.82);
    g.quadraticCurveTo(w * 0.2, h * 0.46, w * 0.18, h * 0.16);
    g.stroke();
    g.beginPath();
    g.moveTo(w * 0.52, h * 0.72);
    g.quadraticCurveTo(w * 0.82, h * 0.48, w * 0.84, h * 0.24);
    g.stroke();
  } else {
    // Velvety cattail seed head
    g.fillStyle = PALETTE.roof;
    g.beginPath();
    g.ellipse(w * 0.51, h * 0.26, w * 0.24, h * 0.14, 0.04, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.stone;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.ellipse(w * 0.44, h * 0.24, w * 0.09, h * 0.09, 0.04, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // Soft painterly modulation
  for (let i = 0; i < 20; i++) {
    dab(g, w * (0.35 + rand() * 0.3), rand() * h, w * 0.12, h * 0.04, rand(), PALETTE.cream, 0.08, false, false);
  }
  dilateAlphaEdges(canvas, 6);
  return canvas;
}

register('nature.reed', {
  size: [64, 256], tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Marsh reed blade sprite (alpha)',
  baseColor: PALETTE.marsh,
  build: (w, h, seed) => paintReed(w, h, seed, false),
});

register('nature.reed.cattail', {
  size: [64, 256], tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Marsh cattail seed-head reed variant (alpha)',
  baseColor: PALETTE.roof,
  build: (w, h, seed) => paintReed(w, h, seed, true),
});

// 3 & 4. nature.grassblade & nature.grassblade.dry (32x128 alpha)
function paintGrassBlade(w, h, dry) {
  const { canvas, g } = makeCanvas(w, h);
  g.clearRect(0, 0, w, h);

  const grad = g.createLinearGradient(0, h, 0, 0);
  if (dry) {
    grad.addColorStop(0.0, PALETTE.stoneDark);
    grad.addColorStop(0.55, PALETTE.dirt);
    grad.addColorStop(1.0, PALETTE.forestGoldLight);
  } else {
    grad.addColorStop(0.0, PALETTE.hubMeadow);
    grad.addColorStop(0.55, PALETTE.marsh);
    grad.addColorStop(1.0, '#E8D98A');
  }

  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w * 0.22, h * 0.98);
  g.quadraticCurveTo(w * 0.18, h * 0.45, w * 0.56, h * 0.04);
  g.quadraticCurveTo(w * 0.78, h * 0.46, w * 0.78, h * 0.98);
  g.closePath();
  g.fill();

  // Center-vein highlight
  g.strokeStyle = PALETTE.brightest;
  g.globalAlpha = 0.35;
  g.lineWidth = Math.max(1, w * 0.08);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.94);
  g.quadraticCurveTo(w * 0.48, h * 0.48, w * 0.55, h * 0.12);
  g.stroke();
  g.globalAlpha = 1;

  dilateAlphaEdges(canvas, 5);
  return canvas;
}

register('nature.grassblade', {
  size: [32, 128], tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Lush tapered grass blade with center vein (alpha)',
  baseColor: PALETTE.hubMeadow,
  build: (w, h) => paintGrassBlade(w, h, false),
});

register('nature.grassblade.dry', {
  size: [32, 128], tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Dry golden-tan grass blade variant (alpha)',
  baseColor: PALETTE.dirt,
  build: (w, h) => paintGrassBlade(w, h, true),
});

// 5. nature.flowers (atlas 512x256, 8 cells of 128)
function drawFlowerCell(g, cx, cy, r, petals, petalCol, innerCol, centerCol, rand) {
  g.save();
  for (let p = 0; p < petals; p++) {
    const a = (p / petals) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const px = cx + Math.cos(a) * r * 0.46;
    const py = cy + Math.sin(a) * r * 0.46;
    g.fillStyle = p % 2 === 0 ? petalCol : innerCol;
    g.globalAlpha = 0.92;
    g.beginPath();
    g.ellipse(px, py, r * 0.42, r * 0.26, a, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = centerCol;
  g.beginPath();
  g.arc(cx, cy, r * 0.24, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PALETTE.brightest;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.arc(cx - r * 0.06, cy - r * 0.06, r * 0.09, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

register('nature.flowers', {
  size: [512, 256], tile: false, space: 'srgb', kind: 'sprite',
  usage: '8-cell flower atlas (daisy, buttercup, pink, lavender, marigold, teal, pearl lily, blush cosmos)',
  baseColor: PALETTE.cream,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    const cw = w / 4, ch = h / 2, r = Math.min(cw, ch) * 0.42;

    const specs = [
      [8, PALETTE.brightest, PALETTE.cream, PALETTE.forestAmber],          // cream daisy
      [5, PALETTE.sun, PALETTE.forestHoney, PALETTE.forestBrown],          // buttercup
      [6, PALETTE.crownBlush, PALETTE.peach, PALETTE.crownGold],           // soft pink bloom
      [5, '#B8A9E0', PALETTE.crownCool, PALETTE.cream],                    // lavender bell
      [8, PALETTE.forestAmber, PALETTE.sun, PALETTE.roof],                 // honey marigold
      [6, PALETTE.cavernTeal, PALETTE.marshMist, PALETTE.brightest],       // teal glow-bloom
      [6, PALETTE.crownPearl, PALETTE.paper, PALETTE.crownGold],           // pearl lily
      [7, PALETTE.crownBlush, PALETTE.crownPearl, PALETTE.forestAmber],    // blush cosmos
    ];
    specs.forEach(([n, c1, c2, cen], i) => {
      const col = i % 4, row = (i / 4) | 0;
      drawFlowerCell(g, (col + 0.5) * cw, (row + 0.5) * ch, r, n, c1, c2, cen, rand);
    });
    dilateAlphaEdges(canvas, 6);
    return canvas;
  },
});

// 6. nature.flowers.bloom (384x128: 3 tiny single-tint heads for ending wave)
register('nature.flowers.bloom', {
  size: [384, 128], tile: false, space: 'srgb', kind: 'sprite',
  usage: '3 tiny single-tint flower heads for the ending wave',
  baseColor: PALETTE.crownBlush,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    const cw = w / 3, r = Math.min(cw, h) * 0.36;
    drawFlowerCell(g, cw * 0.5, h * 0.5, r, 5, PALETTE.crownBlush, PALETTE.crownBlush, PALETTE.brightest, rand);
    drawFlowerCell(g, cw * 1.5, h * 0.5, r, 6, PALETTE.sun, PALETTE.sun, PALETTE.brightest, rand);
    drawFlowerCell(g, cw * 2.5, h * 0.5, r, 5, PALETTE.crownPearl, PALETTE.cream, PALETTE.crownGold, rand);
    dilateAlphaEdges(canvas, 6);
    return canvas;
  },
});

// 7. nature.clover (128 alpha tile)
register('nature.clover', {
  size: 128, tile: true, space: 'srgb', kind: 'sprite',
  usage: 'Tileable clover leaf triplet scatter (alpha)',
  baseColor: PALETTE.hubMeadow,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const cx = rand() * w, cy = rand() * h;
      const r = w * (0.045 + rand() * 0.03);
      const baseA = rand() * Math.PI * 2;
      const col = i % 2 === 0 ? PALETTE.hubMeadow : PALETTE.marsh;
      for (let k = 0; k < 3; k++) {
        const a = baseA + k * 2.094;
        wrappedEllipse(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.9, r * 0.72, a, col, 0.85);
      }
      wrappedEllipse(g, cx, cy, r * 0.35, r * 0.35, 0, PALETTE.marshLight, 0.7);
    }
    dilateAlphaEdges(canvas, 5, { wrapX: true, wrapY: true });
    return canvas;
  },
});

// 8. nature.ivy (atlas 256x256, 6 leaf shapes with veins)
register('nature.ivy', {
  size: 256, tile: false, space: 'srgb', kind: 'sprite',
  usage: '6-leaf ivy atlas with painted veins (alpha)',
  baseColor: PALETTE.hubMeadow,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    const cols = [PALETTE.hubMeadow, PALETTE.marsh, PALETTE.marshLight];
    const cw = w / 3, ch = h / 2;

    for (let i = 0; i < 6; i++) {
      const cx = (i % 3 + 0.5) * cw;
      const cy = (((i / 3) | 0) + 0.5) * ch;
      const r = Math.min(cw, ch) * 0.36;
      const col = cols[i % 3];
      g.save();
      g.translate(cx, cy);
      g.rotate((rand() - 0.5) * 0.5);
      g.fillStyle = col;
      // 3-lobed soft ivy heart leaf
      g.beginPath();
      g.ellipse(0, -r * 0.2, r * 0.62, r * 0.75, 0, 0, Math.PI * 2);
      g.ellipse(-r * 0.45, r * 0.15, r * 0.45, r * 0.36, -0.5, 0, Math.PI * 2);
      g.ellipse(r * 0.45, r * 0.15, r * 0.45, r * 0.36, 0.5, 0, Math.PI * 2);
      g.fill();
      // Midrib & side veins
      g.strokeStyle = PALETTE.marshLight;
      g.globalAlpha = 0.65;
      g.lineWidth = Math.max(1, r * 0.08);
      g.beginPath();
      g.moveTo(0, r * 0.65); g.lineTo(0, -r * 0.72);
      g.moveTo(0, r * 0.15); g.lineTo(-r * 0.55, -r * 0.05);
      g.moveTo(0, r * 0.15); g.lineTo(r * 0.55, -r * 0.05);
      g.stroke();
      g.restore();
    }
    dilateAlphaEdges(canvas, 6);
    return canvas;
  },
});

// 9. nature.moss (256 alpha puffy moss cap)
register('nature.moss', {
  size: 256, tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Puffy moss cap decal/sprite (alpha)',
  baseColor: PALETTE.marsh,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.5;
    for (let i = 0; i < 65; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.pow(rand(), 0.65) * w * 0.32;
      const r = w * (0.07 + rand() * 0.12);
      const col = i % 3 === 0 ? PALETTE.marshLight : i % 3 === 1 ? PALETTE.marsh : PALETTE.marshDark;
      dab(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.88, r, r * 0.82, rand() * Math.PI, col, 0.45, false, false);
    }
    dilateAlphaEdges(canvas, 6);
    return canvas;
  },
});

// 10 & 11. nature.bark & nature.bark.pale (256 vertical tile)
function paintBark(w, h, seed, ctx, pale) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  const r = ridgedFbm(w, h, { scaleX: 8, scaleY: 2, octaves: 4, warpAmp: 0.14, seed });
  rampMap(r, pale
    ? [PALETTE.stoneDark, PALETTE.stoneLight, PALETTE.cream, PALETTE.paper]
    : [PALETTE.ink, PALETTE.forestBrown, PALETTE.plank, PALETTE.forestAmber],
    g, w, h
  );
  scatterDabs(g, rand, {
    count: Math.round(240 * ctx.dabMult),
    colors: pale ? [PALETTE.cream, PALETTE.stoneLight, PALETTE.paper] : [PALETTE.forestBrown, PALETTE.forestAmber, PALETTE.ink],
    minR: 0.015, maxR: 0.05, aspectMin: 0.2, aspectMax: 0.45,
  });
  grainLines(g, rand, { count: 44, vertical: true, color: pale ? PALETTE.ink : PALETTE.forestAmber, lineWidth: Math.max(1, w * 0.008), alpha: pale ? 0.25 : 0.32 });
  if (pale) {
    // Dark willow flecks
    for (let i = 0; i < 40; i++) wrappedEllipse(g, rand() * w, rand() * h, w * 0.025, h * 0.007, 0, PALETTE.ink, 0.35);
  }
  finishSurface(g, r, { aoStrength: pale ? 0.3 : 0.5, warmLift: 0.06, seed });
  return canvas;
}

register('nature.bark', {
  size: 256, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Old Honeytree warm brown bark with honey fissures (tiles every 3 units)',
  baseColor: PALETTE.forestBrown,
  build: (w, h, seed, ctx) => paintBark(w, h, seed, ctx, false),
});

register('nature.bark.pale', {
  size: 256, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Pale willow bark in cream with dark flecks',
  baseColor: PALETTE.cream,
  build: (w, h, seed, ctx) => paintBark(w, h, seed, ctx, true),
});

// 12. nature.canopy (256 tile)
register('nature.canopy', {
  size: 256, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Golden olive-to-honey leaf cluster canopy tile (tiles every 4 units)',
  baseColor: PALETTE.forestOlive,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 3, warpAmp: 0.25, seed });
    rampMap(f, [PALETTE.forestOlive, PALETTE.marshDark, PALETTE.forestAmber, PALETTE.forestHoney, PALETTE.forestGoldLight], g, w, h);
    scatterDabs(g, rand, {
      count: Math.round(320 * ctx.dabMult),
      colors: [PALETTE.forestOlive, PALETTE.forestHoney, PALETTE.forestGoldLight, PALETTE.forestAmber],
      minR: 0.03, maxR: 0.085, minAlpha: 0.08, maxAlpha: 0.2,
    });
    finishSurface(g, f, { aoStrength: 0.34, warmLift: 0.08, seed });
    return canvas;
  },
});

// 13. nature.willow (64x256 alpha drooping strands)
register('nature.willow', {
  size: [64, 256], tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Drooping willow frond strands (alpha)',
  baseColor: PALETTE.marsh,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    const strands = [0.24, 0.44, 0.62, 0.78];
    for (const sx of strands) {
      g.strokeStyle = PALETTE.marshDark;
      g.lineWidth = Math.max(1.2, w * 0.05);
      g.beginPath();
      g.moveTo(sx * w, h * 0.03);
      g.quadraticCurveTo((sx + (rand() - 0.5) * 0.14) * w, h * 0.5, (sx + (rand() - 0.5) * 0.1) * w, h * 0.95);
      g.stroke();

      for (let k = 0; k < 14; k++) {
        const y = h * (0.06 + (k / 14) * 0.86);
        const side = k % 2 === 0 ? -1 : 1;
        g.fillStyle = k % 3 === 0 ? PALETTE.marshLight : PALETTE.marsh;
        g.beginPath();
        g.ellipse(sx * w + side * w * 0.1, y, w * 0.11, h * 0.025, side * 0.55, 0, Math.PI * 2);
        g.fill();
      }
    }
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 14 & 15. nature.mushroom.cap & .glow (atlas 384x128, 3 cells)
function paintMushroomCaps(w, h, seed, glow) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  const cw = w / 3;
  const caps = [
    { base: PALETTE.cavernTeal, edge: PALETTE.coolShadow, spot: PALETTE.cream },
    { base: PALETTE.cavernRose, edge: PALETTE.cavernIndigo, spot: PALETTE.crownGold },
    { base: PALETTE.cavernIndigo, edge: PALETTE.cavernFloor, spot: PALETTE.brightest },
  ];

  for (let i = 0; i < 3; i++) {
    const cx = (i + 0.5) * cw;
    const cy = h * 0.5;
    const r = Math.min(cw, h) * 0.48;
    const c = caps[i];
    const grad = g.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
    if (glow) {
      grad.addColorStop(0.0, PALETTE.brightest);
      grad.addColorStop(0.45, c.base);
      grad.addColorStop(1.0, PALETTE.darkest);
    } else {
      grad.addColorStop(0.0, mixHex(c.base, PALETTE.brightest, 0.25));
      grad.addColorStop(0.65, c.base);
      grad.addColorStop(1.0, c.edge);
    }
    g.fillStyle = grad;
    g.fillRect(i * cw, 0, cw, h);

    // Painted cap spots
    for (let s = 0; s < 10; s++) {
      const a = (s / 10) * Math.PI * 2 + rand() * 0.4;
      const dist = r * (0.2 + rand() * 0.58);
      g.fillStyle = glow ? PALETTE.brightest : c.spot;
      g.globalAlpha = glow ? 0.85 : 0.78;
      g.beginPath();
      g.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r * (0.06 + rand() * 0.06), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  finishSurface(g, null, { aoStrength: 0, grainAmount: 0.02, seed, wrapX: false, wrapY: false });
  return canvas;
}

register('nature.mushroom.cap', {
  size: [384, 128], tile: false, space: 'srgb', kind: 'tile',
  usage: '3-cell mushroom cap atlas (teal, pink, indigo with spots)',
  baseColor: PALETTE.cavernTeal,
  build: (w, h, seed) => paintMushroomCaps(w, h, seed, false),
});

register('nature.mushroom.cap.glow', {
  size: [384, 128], tile: false, space: 'srgb', kind: 'tile',
  usage: 'Emissive glow twin for mushroom cap atlas',
  baseColor: PALETTE.cavernTeal,
  build: (w, h, seed) => paintMushroomCaps(w, h, seed, true),
});

// 16. nature.mushroom.stem (64x128)
register('nature.mushroom.stem', {
  size: [64, 128], tile: false, tileX: true, tileY: false, space: 'srgb', kind: 'tile',
  usage: 'Cream mushroom stem with vertical striations and soft bottom shade',
  baseColor: PALETTE.cream,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, PALETTE.paper);
    grad.addColorStop(0.65, PALETTE.cream);
    grad.addColorStop(1.0, PALETTE.stone);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    grainLines(g, rand, { count: 24, vertical: true, color: PALETTE.stone, lineWidth: 1.1, alpha: 0.28, wrapX: true, wrapY: false });
    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.025, seed, wrapX: true, wrapY: false });
    return canvas;
  },
});

// 17, 18, 19, 20. nature.crystal (teal, pink, gold, glow) (128 alpha)
function paintCrystal(w, h, tintHex, emissive = false) {
  const { canvas, g } = makeCanvas(w, h);
  g.clearRect(0, 0, w, h);
  const cx = w * 0.5;
  // Faceted hexagonal crystal silhouette
  const drawPoly = (pts, fill, alpha = 1) => {
    g.save();
    g.fillStyle = fill;
    g.globalAlpha = alpha;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fill();
    g.restore();
  };

  const tip = [cx, h * 0.06];
  const lTop = [w * 0.22, h * 0.30], rTop = [w * 0.78, h * 0.30];
  const lBot = [w * 0.28, h * 0.90], rBot = [w * 0.72, h * 0.90];
  const midT = [cx, h * 0.34], midB = [cx, h * 0.94];

  const dark = emissive ? tintHex : mixHex(tintHex, PALETTE.cavernIndigo, 0.38);
  const light = mixHex(tintHex, PALETTE.brightest, 0.48);

  drawPoly([tip, lTop, midT], light, 0.95);
  drawPoly([tip, midT, rTop], tintHex, 0.95);
  drawPoly([lTop, lBot, midB, midT], tintHex, 0.92);
  drawPoly([midT, midB, rBot, rTop], dark, 0.92);

  // Bright inner core glow
  const core = g.createRadialGradient(cx, h * 0.45, w * 0.02, cx, h * 0.45, w * 0.28);
  core.addColorStop(0.0, PALETTE.brightest);
  core.addColorStop(0.55, light);
  core.addColorStop(1.0, 'rgba(255,244,220,0)');
  g.fillStyle = core;
  g.fillRect(w * 0.2, h * 0.15, w * 0.6, h * 0.65);

  dilateAlphaEdges(canvas, 6);
  return canvas;
}

register('nature.crystal', {
  size: 128, tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Faceted teal cavern crystal with bright inner core (alpha)',
  baseColor: PALETTE.cavernTeal,
  build: (w, h) => paintCrystal(w, h, PALETTE.cavernTeal, false),
});

register('nature.crystal.pink', {
  size: 128, tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Faceted rose-pink crystal variant (alpha)',
  baseColor: PALETTE.cavernRose,
  build: (w, h) => paintCrystal(w, h, PALETTE.cavernRose, false),
});

register('nature.crystal.gold', {
  size: 128, tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Faceted golden crystal variant (alpha)',
  baseColor: PALETTE.crownGold,
  build: (w, h) => paintCrystal(w, h, PALETTE.crownGold, false),
});

register('nature.crystal.glow', {
  size: 128, tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Emissive inner-core glow twin for faceted crystals',
  baseColor: PALETTE.brightest,
  build: (w, h) => paintCrystal(w, h, PALETTE.sun, true),
});

// 21. nature.cloudpuff (256 alpha)
register('nature.cloudpuff', {
  size: 256, tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Soft storybook cloud puff (pink-lilac underside, gold top)',
  baseColor: PALETTE.crownPearl,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    const puffs = [
      [0.50, 0.44, 0.28, 0.22],
      [0.32, 0.54, 0.22, 0.18],
      [0.68, 0.54, 0.22, 0.18],
      [0.42, 0.36, 0.20, 0.17],
      [0.60, 0.38, 0.19, 0.16],
    ];
    // Pink-lilac soft underside
    for (const [x, y, rx, ry] of puffs) {
      dab(g, x * w, (y + 0.08) * h, rx * w, ry * h, 0, PALETTE.crownCool, 0.55, false, false);
      dab(g, x * w, (y + 0.05) * h, rx * w * 0.9, ry * h * 0.9, 0, PALETTE.crownBlush, 0.45, false, false);
    }
    // Cream-pearl body & gold top
    for (const [x, y, rx, ry] of puffs) {
      dab(g, x * w, y * h, rx * w, ry * h, 0, PALETTE.crownPearl, 0.85, false, false);
      dab(g, x * w, (y - 0.06) * h, rx * w * 0.78, ry * h * 0.65, 0, PALETTE.brightest, 0.65, false, false);
      dab(g, x * w, (y - 0.09) * h, rx * w * 0.55, ry * h * 0.4, 0, PALETTE.sun, 0.28, false, false);
    }
    // Extra airy fringe dabs
    for (let i = 0; i < 18; i++) {
      dab(g, w * (0.28 + rand() * 0.44), h * (0.34 + rand() * 0.28), w * 0.1, h * 0.08, rand(), PALETTE.paper, 0.22, false, false);
    }
    dilateAlphaEdges(canvas, 6);
    return canvas;
  },
});

// 22. nature.pebble (128 tile)
register('nature.pebble', {
  size: 128, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Small stone pebble surface with warm speckles',
  baseColor: PALETTE.stone,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = fbm(w, h, { scaleX: 4, scaleY: 4, octaves: 3, seed });
    rampMap(f, [PALETTE.cliffDark, PALETTE.stone, PALETTE.stoneLight, PALETTE.cream], g, w, h);
    scatterDabs(g, rand, { count: 200, colors: [PALETTE.stone, PALETTE.stoneLight, PALETTE.cream, PALETTE.cliffDark], minR: 0.025, maxR: 0.08 });
    for (let i = 0; i < 36; i++) wrappedEllipse(g, rand() * w, rand() * h, w * 0.015, w * 0.012, rand(), rand() > 0.5 ? PALETTE.cream : PALETTE.ink, 0.35);
    finishSurface(g, f, { aoStrength: 0.28, warmLift: 0.06, seed });
    return canvas;
  },
});
