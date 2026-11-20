/**
 * Dreamback Texture Kit — T5: Characters and Creatures (15 ids)
 * Built for sphere/cylinder UVs: key details centered, wraps horizontally seamlessly.
 * Zero black outlines anywhere; darkest tone #2C4A47.
 */

import { register } from './store.js';
import { PALETTE, PIP_COLORS, mixHex } from './palette.js';
import {
  rng,
  fbm,
  domainWarp,
  smoothstep,
  makeCanvas,
  rampMap,
  dab,
  scatterDabs,
  wrappedEllipse,
  wrappedPolyline,
  finishSurface,
  dilateAlphaEdges,
} from './core.js';

// 1. char.pip.shell (256, wraps X)
register('char.pip.shell', {
  size: 256, tile: false, tileX: true, tileY: false, space: 'srgb', kind: 'tile',
  usage: 'Pip warm russet shell with faint segment lines, cream belly & soft top sheen',
  baseColor: PIP_COLORS.shellBase,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = fbm(w, h, { scaleX: 4, scaleY: 3, octaves: 3, seed, wrapX: true, wrapY: false });
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, PIP_COLORS.shellHighlight);
    grad.addColorStop(0.45, PIP_COLORS.shellBase);
    grad.addColorStop(0.76, mixHex(PIP_COLORS.shellBase, PIP_COLORS.belly, 0.45));
    grad.addColorStop(1.0, PIP_COLORS.belly);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    scatterDabs(g, rand, {
      count: Math.round(220 * ctx.dabMult),
      colors: [PIP_COLORS.shellBase, PIP_COLORS.shellHighlight, PIP_COLORS.belly, PALETTE.peach],
      minR: 0.03, maxR: 0.09, minAlpha: 0.05, maxAlpha: 0.14, wrapX: true, wrapY: false,
    });

    // Soft top sheen & faint horizontal carapace segments
    const sheen = g.createLinearGradient(0, 0, 0, h * 0.35);
    sheen.addColorStop(0, 'rgba(255,244,220,0.32)');
    sheen.addColorStop(1, 'rgba(255,244,220,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h * 0.35);

    for (const sy of [0.34, 0.52, 0.68]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) pts.push([(k / 12) * w, h * sy + Math.sin((k / 12) * Math.PI * 2) * h * 0.015]);
      wrappedPolyline(g, pts, PALETTE.roof, Math.max(1.2, h * 0.012), 0.28, true, false);
    }

    finishSurface(g, f, { aoStrength: 0.18, warmLift: 0.08, seed, wrapX: true, wrapY: false });
    return canvas;
  },
});

// 2. char.pip.eye (128: big friendly dark eye, two highlights, warm rim — darkest #2C4A47)
register('char.pip.eye', {
  size: 128, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Pip eye sphere texture (dark #2C4A47 iris, two warm sparks, warm rim)',
  baseColor: PIP_COLORS.eyeDark,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    // Warm cream-russet eyelid rim around sphere
    g.fillStyle = PIP_COLORS.shellHighlight;
    g.fillRect(0, 0, w, h);

    // Big dark iris centered on UV (0.5, 0.5)
    const iris = g.createRadialGradient(cx, cy, w * 0.04, cx, cy, w * 0.36);
    iris.addColorStop(0.0, PALETTE.coolShadow);
    iris.addColorStop(0.72, '#355450');
    iris.addColorStop(0.92, PALETTE.roof);
    iris.addColorStop(1.0, PIP_COLORS.shellBase);
    g.fillStyle = iris;
    g.beginPath(); g.arc(cx, cy, w * 0.38, 0, Math.PI * 2); g.fill();

    // Primary bright warm-white spark + soft secondary crescent highlight
    g.fillStyle = PALETTE.brightest;
    g.beginPath(); g.arc(cx - w * 0.11, cy - h * 0.11, w * 0.095, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.65;
    g.beginPath(); g.arc(cx + w * 0.12, cy + h * 0.10, w * 0.048, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;

    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.015, seed, wrapX: false, wrapY: false });
    return canvas;
  },
});

// 3. char.pip.leaf (128 alpha: backpack leaf with midrib, side veins, tiny nibbled holes)
register('char.pip.leaf', {
  size: 128, tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Pip backpack leaf sprite with midrib, veins and tiny holes (alpha)',
  baseColor: PIP_COLORS.leafBase,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(w * 0.2, h * 0.9, w * 0.8, h * 0.1);
    grad.addColorStop(0.0, PALETTE.hubMeadow);
    grad.addColorStop(0.55, PALETTE.marsh);
    grad.addColorStop(1.0, PALETTE.marshLight);

    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.08);
    g.bezierCurveTo(w * 0.88, h * 0.28, w * 0.86, h * 0.76, w * 0.5, h * 0.92);
    g.bezierCurveTo(w * 0.14, h * 0.76, w * 0.12, h * 0.28, w * 0.5, h * 0.08);
    g.fill();

    // Midrib & side veins
    g.strokeStyle = PALETTE.cream;
    g.lineWidth = w * 0.028;
    g.lineCap = 'round';
    g.globalAlpha = 0.62;
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.92); g.lineTo(w * 0.5, h * 0.14);
    for (const y of [0.34, 0.52, 0.70]) {
      g.moveTo(w * 0.5, h * y); g.lineTo(w * 0.26, h * (y - 0.1));
      g.moveTo(w * 0.5, h * y); g.lineTo(w * 0.74, h * (y - 0.1));
    }
    g.stroke();
    g.globalAlpha = 1;

    // Tiny cozy insect-nibbled leaf holes
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(w * 0.34, h * 0.44, w * 0.045, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w * 0.67, h * 0.62, w * 0.032, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';

    dilateAlphaEdges(canvas, 6);
    return canvas;
  },
});

// 4. char.pip.bulb (128 emissive: warm filament glow gradient with flicker mask)
register('char.pip.bulb', {
  size: 128, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Pip lantern bulb warm filament emissive gradient',
  baseColor: PIP_COLORS.bulbEmissive,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    const grad = g.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.55);
    grad.addColorStop(0.0, PALETTE.brightest);
    grad.addColorStop(0.45, PALETTE.sun);
    grad.addColorStop(0.82, PALETTE.peach);
    grad.addColorStop(1.0, PALETTE.forestAmber);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // Delicate glowing filament loop
    g.strokeStyle = PALETTE.brightest;
    g.lineWidth = w * 0.04;
    g.beginPath();
    g.arc(cx, cy, w * 0.16, 0, Math.PI * 2);
    g.stroke();
    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.015, seed, wrapX: false, wrapY: false });
    return canvas;
  },
});

// 5. char.grandma.body (256, wraps X: sage with soft moss patches)
register('char.grandma.body', {
  size: 256, tile: false, tileX: true, tileY: false, space: 'srgb', kind: 'tile',
  usage: 'Grandma cozy sage body with soft moss patches (wraps X)',
  baseColor: PALETTE.marsh,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 3, octaves: 3, warpAmp: 0.22, seed, wrapX: true, wrapY: false });
    rampMap(f, [PALETTE.marshHollow, PALETTE.marshDark, PALETTE.marsh, PALETTE.marshLight, PALETTE.cream], g, w, h);
    scatterDabs(g, rand, { count: Math.round(240 * ctx.dabMult), colors: [PALETTE.marsh, PALETTE.marshLight, PALETTE.marshDark, PALETTE.cream], minR: 0.025, maxR: 0.08, wrapX: true, wrapY: false });
    finishSurface(g, f, { aoStrength: 0.26, warmLift: 0.07, seed, wrapX: true, wrapY: false });
    return canvas;
  },
});

// 6. char.grandma.shawl (128 tile: knit V-stitch rows in cream with fringe edge strip)
register('char.grandma.shawl', {
  size: 128, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Grandma knitted V-stitch cream shawl with bottom fringe',
  baseColor: PALETTE.cream,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = fbm(w, h, { scaleX: 4, scaleY: 4, octaves: 3, seed });
    rampMap(f, [PALETTE.puffShadow, PALETTE.cream, PALETTE.paper, PALETTE.brightest], g, w, h);

    // Knit V-stitch rows
    const cols = 8, rows = 8;
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * ch;
      const col = r % 3 === 0 ? PALETTE.peach : PALETTE.stone;
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw;
        wrappedPolyline(g, [[x - cw * 0.34, y - ch * 0.28], [x, y + ch * 0.28], [x + cw * 0.34, y - ch * 0.28]], col, Math.max(1.2, w * 0.016), 0.45);
      }
    }
    scatterDabs(g, rand, { count: 200, colors: [PALETTE.cream, PALETTE.paper, PALETTE.peach], minR: 0.02, maxR: 0.06, minAlpha: 0.05, maxAlpha: 0.12 });
    finishSurface(g, f, { aoStrength: 0.24, warmLift: 0.06, seed });
    return canvas;
  },
});

// 7. char.bramble.shell (256, wraps X: olive & amber beetle shell with split line & spots)
register('char.bramble.shell', {
  size: 256, tile: false, tileX: true, tileY: false, space: 'srgb', kind: 'tile',
  usage: 'Bramble olive & amber glossy shell with center split & cream spots',
  baseColor: PALETTE.forestOlive,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 3, octaves: 3, warpAmp: 0.2, seed, wrapX: true, wrapY: false });
    rampMap(f, [PALETTE.coolShadow, PALETTE.forestOlive, PALETTE.forestAmber, PALETTE.forestHoney], g, w, h);
    scatterDabs(g, rand, { count: Math.round(220 * ctx.dabMult), colors: [PALETTE.forestOlive, PALETTE.forestAmber, PALETTE.forestHoney], minR: 0.025, maxR: 0.075, wrapX: true, wrapY: false });

    // Center elytra split line
    wrappedPolyline(g, [[w * 0.5, 0], [w * 0.5, h]], PALETTE.coolShadow, w * 0.018, 0.62, true, false);
    // Glossy highlight streaks on either side
    wrappedPolyline(g, [[w * 0.34, h * 0.14], [w * 0.32, h * 0.72]], PALETTE.brightest, w * 0.022, 0.32, true, false);
    wrappedPolyline(g, [[w * 0.66, h * 0.14], [w * 0.68, h * 0.72]], PALETTE.brightest, w * 0.022, 0.32, true, false);

    // Small cream spots
    for (let i = 0; i < 16; i++) {
      wrappedEllipse(g, rand() * w, h * (0.15 + rand() * 0.7), w * 0.026, w * 0.022, rand(), PALETTE.cream, 0.68, true, false);
    }
    finishSurface(g, f, { aoStrength: 0.25, warmLift: 0.08, seed, wrapX: true, wrapY: false });
    return canvas;
  },
});

// 8 & 9. char.pebble.shell & char.pebble.glow (256, wraps X)
function drawSnailSwirl(g, w, h, color, lw, alpha) {
  const cx = w * 0.5, cy = h * 0.5;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.globalAlpha = alpha;
  g.beginPath();
  for (let t = 0; t <= 48; t++) {
    const a = t * 0.38;
    const r = (t / 48) * Math.min(w, h) * 0.42;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  g.restore();
}

register('char.pebble.shell', {
  size: 256, tile: false, tileX: true, tileY: false, space: 'srgb', kind: 'tile',
  usage: 'Old Pebble spiral cream snail shell with warm swirls & glowing rim',
  baseColor: PALETTE.cream,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = fbm(w, h, { scaleX: 4, scaleY: 4, octaves: 3, seed, wrapX: true, wrapY: false });
    rampMap(f, [PALETTE.stone, PALETTE.puffShadow, PALETTE.cream, PALETTE.paper], g, w, h);
    scatterDabs(g, rand, { count: Math.round(220 * ctx.dabMult), colors: [PALETTE.cream, PALETTE.paper, PALETTE.peach, PALETTE.stoneLight], minR: 0.025, maxR: 0.08, wrapX: true, wrapY: false });
    drawSnailSwirl(g, w, h, PALETTE.stone, w * 0.024, 0.55);
    drawSnailSwirl(g, w, h, PALETTE.sun, w * 0.012, 0.62);
    finishSurface(g, f, { aoStrength: 0.25, warmLift: 0.08, seed, wrapX: true, wrapY: false });
    return canvas;
  },
});

register('char.pebble.glow', {
  size: 256, tile: false, tileX: true, tileY: false, space: 'srgb', kind: 'tile',
  usage: 'Emissive glowing spiral rim for Old Pebble snail shell',
  baseColor: PALETTE.sun,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    g.fillStyle = PALETTE.darkest;
    g.fillRect(0, 0, w, h);
    drawSnailSwirl(g, w, h, PALETTE.sun, w * 0.055, 0.32);
    drawSnailSwirl(g, w, h, PALETTE.brightest, w * 0.018, 0.85);
    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.015, seed, wrapX: true, wrapY: false });
    return canvas;
  },
});

// 10. char.pebble.body (128, wraps X)
register('char.pebble.body', {
  size: 128, tile: false, tileX: true, tileY: false, space: 'srgb', kind: 'tile',
  usage: 'Old Pebble pale peach snail body with soft moist sheen',
  baseColor: PALETTE.peach,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = fbm(w, h, { scaleX: 3, scaleY: 3, octaves: 3, seed, wrapX: true, wrapY: false });
    rampMap(f, [PALETTE.peach, PALETTE.cream, PALETTE.paper, PALETTE.brightest], g, w, h);
    scatterDabs(g, rand, { count: 200, colors: [PALETTE.peach, PALETTE.cream, PALETTE.brightest], minR: 0.04, maxR: 0.12, wrapX: true, wrapY: false });
    finishSurface(g, f, { aoStrength: 0.16, warmLift: 0.09, seed, wrapX: true, wrapY: false });
    return canvas;
  },
});

// 11. char.moth.body (64 emissive)
register('char.moth.body', {
  size: 64, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Wisp-Moth warm emissive fuzzy body gradient',
  baseColor: PALETTE.sun,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, PALETTE.brightest);
    grad.addColorStop(0.5, PALETTE.sun);
    grad.addColorStop(1.0, PALETTE.crownBlush);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.02, seed, wrapX: false, wrapY: false });
    return canvas;
  },
});

// 12. char.puff.wool (256 tile: soft curly fluff, tiles every 1.5 world units)
register('char.puff.wool', {
  size: 256, tile: true, space: 'srgb', kind: 'tile',
  usage: 'Sheep-like Puff curly cream wool tile (tiles every 1.5 units)',
  baseColor: PALETTE.cream,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 5, scaleY: 5, octaves: 3, warpAmp: 0.25, seed });
    rampMap(f, [PALETTE.puffShadow, PALETTE.cream, PALETTE.paper, PALETTE.brightest], g, w, h);

    // Soft overlapping wool curls
    for (let i = 0; i < 65; i++) {
      const cx = rand() * w, cy = rand() * h;
      const r = w * (0.04 + rand() * 0.045);
      dab(g, cx, cy + r * 0.25, r, r * 0.85, rand(), PALETTE.puffShadow, 0.24);
      dab(g, cx, cy, r * 0.9, r * 0.8, rand(), PALETTE.cream, 0.42);
      dab(g, cx - r * 0.15, cy - r * 0.2, r * 0.45, r * 0.4, 0, PALETTE.brightest, 0.35);
    }
    scatterDabs(g, rand, { count: Math.round(200 * ctx.dabMult), colors: [PALETTE.cream, PALETTE.paper, PALETTE.puffShadow], minR: 0.02, maxR: 0.06, minAlpha: 0.06, maxAlpha: 0.14 });
    finishSurface(g, f, { aoStrength: 0.26, warmLift: 0.08, seed });
    return canvas;
  },
});

// 13. char.puff.face (128: soft taupe muzzle, tiny eyes with highlights, pink inner ear)
register('char.puff.face', {
  size: 128, tile: false, space: 'srgb', kind: 'tile',
  usage: 'Puff friendly taupe muzzle with tiny sparkling eyes and blush cheeks',
  baseColor: PALETTE.puffMuzzle,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.fillStyle = PALETTE.puffMuzzle;
    g.fillRect(0, 0, w, h);

    // Soft lighter muzzle snout & rosy cheeks
    dab(g, cx, cy + h * 0.12, w * 0.26, h * 0.18, 0, PALETTE.stoneLight, 0.55, false, false);
    dab(g, cx - w * 0.22, cy + h * 0.06, w * 0.12, h * 0.08, 0, PALETTE.crownBlush, 0.48, false, false);
    dab(g, cx + w * 0.22, cy + h * 0.06, w * 0.12, h * 0.08, 0, PALETTE.crownBlush, 0.48, false, false);

    // Tiny friendly eyes (#2C4A47, never black) with bright highlights
    for (const sx of [-0.15, 0.15]) {
      g.fillStyle = PALETTE.coolShadow;
      g.beginPath(); g.arc(cx + sx * w, cy - h * 0.06, w * 0.065, 0, Math.PI * 2); g.fill();
      g.fillStyle = PALETTE.brightest;
      g.beginPath(); g.arc(cx + sx * w - w * 0.02, cy - h * 0.08, w * 0.022, 0, Math.PI * 2); g.fill();
    }
    // Cute tiny W smile
    g.strokeStyle = PALETTE.coolShadow;
    g.lineWidth = w * 0.025;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx - w * 0.04, cy + h * 0.10, w * 0.04, 0.2, Math.PI - 0.2);
    g.arc(cx + w * 0.04, cy + h * 0.10, w * 0.04, 0.2, Math.PI - 0.2);
    g.stroke();

    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.02, seed, wrapX: false, wrapY: false });
    return canvas;
  },
});

// 14. char.giant.eyelid (512x256: pearl-pink skin, fine veins, subtle wrinkles)
register('char.giant.eyelid', {
  size: [512, 256], tile: false, space: 'srgb', kind: 'tile',
  usage: 'Sleeping Giant pearl-pink eyelid skin with fine blush veins and gentle creases',
  baseColor: PALETTE.crownPearl,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 2, octaves: 4, warpAmp: 0.22, seed, wrapX: false, wrapY: false });
    rampMap(f, [PALETTE.crownCool, PALETTE.crownBlush, PALETTE.crownPearl, PALETTE.paper, PALETTE.brightest], g, w, h);
    scatterDabs(g, rand, { count: Math.round(280 * ctx.dabMult), colors: [PALETTE.crownPearl, PALETTE.crownBlush, PALETTE.peach, PALETTE.crownCool], minR: 0.03, maxR: 0.09, wrapX: false, wrapY: false });

    // Subtle arched eyelid wrinkle creases
    for (const cy of [0.32, 0.56, 0.78]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        pts.push([u * w, h * cy - Math.sin(u * Math.PI) * h * 0.09]);
      }
      wrappedPolyline(g, pts, PALETTE.crownBlush, Math.max(1.5, h * 0.016), 0.34, false, false);
    }
    finishSurface(g, f, { aoStrength: 0.2, warmLift: 0.08, seed, wrapX: false, wrapY: false });
    return canvas;
  },
});

// 15. char.giant.lash (64x256 alpha: long soft lash strands)
register('char.giant.lash', {
  size: [64, 256], tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Sleeping Giant long soft eyelash strand (alpha)',
  baseColor: PALETTE.coolShadow,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, PALETTE.coolShadow);
    grad.addColorStop(0.6, PALETTE.cavernIndigo);
    grad.addColorStop(1.0, PALETTE.crownBlush);

    g.fillStyle = grad;
    for (const [bx, tx, bw] of [[0.34, 0.18, 0.13], [0.52, 0.50, 0.16], [0.70, 0.82, 0.12]]) {
      g.beginPath();
      g.moveTo((bx - bw) * w, h * 0.96);
      g.quadraticCurveTo(bx * w, h * 0.48, tx * w, h * 0.05);
      g.quadraticCurveTo((bx + bw * 0.5) * w, h * 0.48, (bx + bw) * w, h * 0.96);
      g.closePath();
      g.fill();
    }
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});
