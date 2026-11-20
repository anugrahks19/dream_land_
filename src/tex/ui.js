/**
 * Dreamback Texture Kit — T7: UI and HUD Skins (23 ids + UI_TOKENS + map wash/path helpers)
 * Delivered via css(id) for CSS backgrounds, plus tex(id) where WebGL uses them (ui.map, ui.map.icons).
 */

import { register } from './store.js';
import { PALETTE, hexToRgb } from './palette.js';
import {
  rng,
  fbm,
  domainWarp,
  makeCanvas,
  rampMap,
  dab,
  scatterDabs,
  wrappedPolyline,
  finishSurface,
  addGrain,
  dilateAlphaEdges,
} from './core.js';

export const UI_TOKENS = Object.freeze({
  '--db-paper': PALETTE.paper,
  '--db-paper-dark': '#E9D9B8',
  '--db-cream': PALETTE.cream,
  '--db-ink': PALETTE.ink,
  '--db-shadow-tint': PALETTE.coolShadow,
  '--db-accent-hub': PALETTE.sun,
  '--db-accent-marsh': PALETTE.marsh,
  '--db-accent-forest': PALETTE.forestAmber,
  '--db-accent-cavern': PALETTE.cavernTeal,
  '--db-accent-crown': PALETTE.crownBlush,
  '--db-radius-sm': '10px',
  '--db-radius-md': '16px',
  '--db-radius-lg': '24px',
  '--db-shadow-soft': '0 8px 24px rgba(74, 59, 42, 0.16)',
  '--db-shadow-inset': 'inset 0 2px 6px rgba(255, 244, 220, 0.7)',
  '--db-font-ui': "'Fredoka', 'Nunito', system-ui, sans-serif",
  '--db-font-title': "'Caveat Brush', Georgia, serif",
});

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

function roundedRectPath(g, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

function drawLeafSprig(g, x, y, scale, rot, color, alpha = 0.85) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = Math.max(1.5, scale * 0.08);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-scale * 0.85, scale * 0.1);
  g.quadraticCurveTo(0, -scale * 0.1, scale * 0.9, 0);
  g.stroke();

  const leaves = [[-0.5, -0.22, -0.5], [-0.45, 0.24, 0.55], [0.0, -0.24, -0.45], [0.05, 0.22, 0.5], [0.55, -0.18, -0.35], [0.55, 0.18, 0.35], [0.98, 0, 0]];
  for (const [lx, ly, lr] of leaves) {
    g.beginPath();
    g.ellipse(lx * scale, ly * scale, scale * 0.24, scale * 0.12, lr, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// 1 & 2. ui.paper & ui.paper.dark (512 tile)
function paintPaper(w, h, seed, ctx, dark = false) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  const f = domainWarp(w, h, { scaleX: 3, scaleY: 3, octaves: 3, warpAmp: 0.22, seed });
  rampMap(f, dark
    ? [PALETTE.stone, '#DFCCA8', '#E9D9B8', PALETTE.cream]
    : [PALETTE.cream, PALETTE.paper, PALETTE.brightest],
    g, w, h
  );
  // Very soft stain blotches
  scatterDabs(g, rand, {
    count: Math.round(240 * ctx.dabMult),
    colors: dark ? [PALETTE.stone, PALETTE.cream, PALETTE.peach] : [PALETTE.cream, PALETTE.paper, PALETTE.peach, PALETTE.brightest],
    minR: 0.03, maxR: 0.11, minAlpha: 0.05, maxAlpha: 0.1,
  });
  // Long paper fibers & faint speckles
  for (let i = 0; i < 65; i++) {
    const x = rand() * w, y = rand() * h, a = rand() * Math.PI * 2, l = w * (0.025 + rand() * 0.045);
    wrappedPolyline(g, [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], PALETTE.stone, 0.9, 0.14);
  }
  finishSurface(g, null, { aoStrength: 0, grainAmount: 0.03, seed });
  return canvas;
}

register('ui.paper', {
  size: 512, tile: true, space: 'srgb', kind: 'ui',
  usage: 'Cream storybook paper tile with fibers and soft tea-stain blotches',
  baseColor: PALETTE.paper,
  build: (w, h, seed, ctx) => paintPaper(w, h, seed, ctx, false),
});

register('ui.paper.dark', {
  size: 512, tile: true, space: 'srgb', kind: 'ui',
  usage: 'Warmer cream-tan paper tile for pause menu panels',
  baseColor: '#E9D9B8',
  build: (w, h, seed, ctx) => paintPaper(w, h, seed, ctx, true),
});

// 3. ui.panel.border (192 alpha, 9-slice friendly hand-drawn wobbly border + corner doodles)
register('ui.panel.border', {
  size: 192, tile: false, space: 'srgb', kind: 'ui',
  usage: '9-slice hand-drawn wobbly ink panel border with corner leaf & dot doodles',
  baseColor: PALETTE.ink,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    const m = w * 0.09;
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = Math.max(2, w * 0.022);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Hand-drawn wobbly rounded border (double pass for cozy pen feel)
    for (let pass = 0; pass < 2; pass++) {
      g.globalAlpha = pass === 0 ? 0.88 : 0.35;
      g.beginPath();
      const segs = 36;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        let px, py;
        const side = Math.floor(t * 4) % 4;
        const lt = (t * 4) % 1;
        const span = w - m * 2;
        if (side === 0) { px = m + lt * span; py = m; }
        else if (side === 1) { px = w - m; py = m + lt * span; }
        else if (side === 2) { px = w - m - lt * span; py = h - m; }
        else { px = m; py = h - m - lt * span; }
        px += (rand() - 0.5) * w * 0.012;
        py += (rand() - 0.5) * h * 0.012;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    }

    // Tiny corner doodles (leaf & dots)
    drawLeafSprig(g, m * 1.15, m * 1.15, w * 0.06, -0.75, PALETTE.ink, 0.8);
    drawLeafSprig(g, w - m * 1.15, h - m * 1.15, w * 0.06, 2.35, PALETTE.ink, 0.8);
    g.fillStyle = PALETTE.ink;
    g.globalAlpha = 0.78;
    for (const [dx, dy] of [[w - m * 1.1, m * 1.1], [m * 1.1, h - m * 1.1]]) {
      g.beginPath(); g.arc(dx, dy, w * 0.022, 0, Math.PI * 2); g.fill();
    }
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 4, 5, 6, 7. ui.button (normal, hover, pressed) & ui.button.start
function paintButton(w, h, seed, state = 'normal', withSprig = false) {
  const { canvas, g } = makeCanvas(w, h);
  const rand = rng(seed);
  g.clearRect(0, 0, w, h);
  const pad = h * 0.1;
  const bw = w - pad * 2, bh = h - pad * 2;
  const r = bh * 0.48;

  // Warm soft drop shadow
  g.save();
  roundedRectPath(g, pad, pad + (state === 'pressed' ? 1 : h * 0.045), bw, bh, r);
  g.fillStyle = rgba(PALETTE.ink, state === 'pressed' ? 0.14 : 0.24);
  g.fill();
  g.restore();

  // Pill body gradient
  const py = state === 'pressed' ? pad + h * 0.03 : pad;
  const grad = g.createLinearGradient(0, py, 0, py + bh);
  if (state === 'hover') {
    grad.addColorStop(0.0, PALETTE.brightest);
    grad.addColorStop(0.5, PALETTE.sun);
    grad.addColorStop(1.0, PALETTE.peach);
  } else if (state === 'pressed') {
    grad.addColorStop(0.0, PALETTE.stoneLight);
    grad.addColorStop(1.0, PALETTE.cream);
  } else if (withSprig) {
    grad.addColorStop(0.0, PALETTE.brightest);
    grad.addColorStop(0.45, PALETTE.sun);
    grad.addColorStop(1.0, PALETTE.forestHoney);
  } else {
    grad.addColorStop(0.0, PALETTE.brightest);
    grad.addColorStop(0.55, PALETTE.paper);
    grad.addColorStop(1.0, PALETTE.cream);
  }

  g.save();
  roundedRectPath(g, pad, py, bw, bh, r);
  g.fillStyle = grad;
  g.fill();
  g.clip();

  // Subtle inner watercolor warmth & top highlight
  for (let i = 0; i < 24; i++) {
    dab(g, pad + rand() * bw, py + rand() * bh, bh * 0.3, bh * 0.2, rand(), state === 'hover' ? PALETTE.peach : PALETTE.cream, 0.08, false, false);
  }
  g.strokeStyle = rgba(PALETTE.brightest, 0.72);
  g.lineWidth = Math.max(2, h * 0.045);
  roundedRectPath(g, pad + 2, py + 2, bw - 4, bh - 4, r - 2);
  g.stroke();
  g.restore();

  // Cozy ink outline
  g.strokeStyle = PALETTE.ink;
  g.lineWidth = Math.max(1.8, h * 0.028);
  roundedRectPath(g, pad, py, bw, bh, r);
  g.stroke();

  if (withSprig) {
    drawLeafSprig(g, pad + bh * 0.52, py + bh * 0.5, bh * 0.24, -0.3, PALETTE.roof, 0.8);
    drawLeafSprig(g, w - pad - bh * 0.52, py + bh * 0.5, bh * 0.24, Math.PI + 0.3, PALETTE.roof, 0.8);
  }

  finishSurface(g, null, { aoStrength: 0, grainAmount: 0.025, seed, wrapX: false, wrapY: false, preserveAlpha: true });
  dilateAlphaEdges(canvas, 4);
  return canvas;
}

register('ui.button', {
  size: [256, 96], tile: false, space: 'srgb', kind: 'ui',
  usage: 'Storybook pill button (normal state)',
  baseColor: PALETTE.paper,
  build: (w, h, seed) => paintButton(w, h, seed, 'normal', false),
});
register('ui.button.hover', {
  size: [256, 96], tile: false, space: 'srgb', kind: 'ui',
  usage: 'Storybook pill button (hover state)',
  baseColor: PALETTE.sun,
  build: (w, h, seed) => paintButton(w, h, seed, 'hover', false),
});
register('ui.button.pressed', {
  size: [256, 96], tile: false, space: 'srgb', kind: 'ui',
  usage: 'Storybook pill button (pressed state)',
  baseColor: PALETTE.cream,
  build: (w, h, seed) => paintButton(w, h, seed, 'pressed', false),
});
register('ui.button.start', {
  size: [320, 112], tile: false, space: 'srgb', kind: 'ui',
  usage: 'Primary start pill button with painted leaf sprigs',
  baseColor: PALETTE.sun,
  build: (w, h, seed) => paintButton(w, h, seed, 'normal', true),
});

// 8. ui.logo.brush (512 alpha tile: dry-brush mask for logo fill)
register('ui.logo.brush', {
  size: 512, tile: true, space: 'srgb', kind: 'ui',
  usage: 'Tileable dry-brush alpha mask for storybook title logo fill',
  baseColor: PALETTE.paper,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const f = domainWarp(w, h, { scaleX: 2, scaleY: 10, octaves: 4, warpAmp: 0.14, seed });
    const img = g.createImageData(w, h);
    const d = img.data;
    const c = hexToRgb(PALETTE.brightest);
    for (let i = 0; i < f.length; i++) {
      const a = Math.max(0, Math.min(1, (f[i] - 0.22) * 1.55));
      const p = i * 4;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2];
      d[p + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    dilateAlphaEdges(canvas, 3);
    return canvas;
  },
});

// 9 & 10. ui.logo.sprig & ui.logo.sprig.alt (256 alpha)
register('ui.logo.sprig', {
  size: 256, tile: false, space: 'srgb', kind: 'ui',
  usage: 'Hand-drawn cream-white leaf sprig for title logo (variant 1)',
  baseColor: PALETTE.brightest,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    drawLeafSprig(g, w * 0.5, h * 0.52, w * 0.42, -0.25, PALETTE.brightest, 0.94);
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

register('ui.logo.sprig.alt', {
  size: 256, tile: false, space: 'srgb', kind: 'ui',
  usage: 'Hand-drawn cream-white curling leaf sprig (variant 2)',
  baseColor: PALETTE.paper,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    drawLeafSprig(g, w * 0.5, h * 0.5, w * 0.40, 0.32, PALETTE.paper, 0.94);
    dab(g, w * 0.25, h * 0.34, w * 0.05, w * 0.05, 0, PALETTE.sun, 0.85, false, false);
    dab(g, w * 0.78, h * 0.66, w * 0.04, w * 0.04, 0, PALETTE.crownBlush, 0.85, false, false);
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 11. ui.breath (256 alpha: hand-drawn ring with gap & ticks over inner paper disc)
register('ui.breath', {
  size: 256, tile: false, space: 'srgb', kind: 'ui',
  usage: 'Breath meter HUD ring with gap, tick marks and inner paper disc',
  baseColor: PALETTE.paper,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);

    // Inner paper disc
    g.fillStyle = rgba(PALETTE.paper, 0.9);
    g.beginPath(); g.arc(cx, cy, w * 0.34, 0, Math.PI * 2); g.fill();

    // Hand-drawn outer breath ring with top gap
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = w * 0.036;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, w * 0.42, -Math.PI * 0.35, Math.PI * 1.35);
    g.stroke();

    // Soft golden inner progress track
    g.strokeStyle = rgba(PALETTE.sun, 0.65);
    g.lineWidth = w * 0.022;
    g.beginPath();
    g.arc(cx, cy, w * 0.37, -Math.PI * 0.35, Math.PI * 1.35);
    g.stroke();

    // Tick marks
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = w * 0.015;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.35 + (i / 7) * (Math.PI * 1.7);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * w * 0.39, cy + Math.sin(a) * w * 0.39);
      g.lineTo(cx + Math.cos(a) * w * 0.46, cy + Math.sin(a) * w * 0.46);
      g.stroke();
    }
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 12. ui.eyelid (512x96 alpha: closed-lid bar with lid-skin gradient, soft lashes, glow-fill mask)
register('ui.eyelid', {
  size: [512, 96], tile: false, space: 'srgb', kind: 'ui',
  usage: 'Giant eyelid calm bar with soft lashes and golden glow-fill',
  baseColor: PALETTE.crownBlush,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);

    // Closed-lid arched capsule
    const grad = g.createLinearGradient(0, h * 0.12, 0, h * 0.72);
    grad.addColorStop(0.0, PALETTE.crownPearl);
    grad.addColorStop(0.55, PALETTE.crownBlush);
    grad.addColorStop(1.0, PALETTE.sun);

    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(w * 0.06, h * 0.56);
    g.quadraticCurveTo(w * 0.5, h * 0.06, w * 0.94, h * 0.56);
    g.quadraticCurveTo(w * 0.5, h * 0.76, w * 0.06, h * 0.56);
    g.closePath();
    g.fill();

    // Ink rim & soft downward lashes
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = Math.max(2, h * 0.04);
    g.lineCap = 'round';
    g.stroke();

    for (let i = 1; i <= 9; i++) {
      const t = i / 10;
      const lx = w * (0.08 + t * 0.84);
      const arch = Math.sin(t * Math.PI);
      const ly = h * (0.56 + arch * 0.1);
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(lx + (t - 0.5) * w * 0.04, ly + h * (0.14 + arch * 0.09));
      g.stroke();
    }
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 13 & 14. ui.dot & ui.dot.filled (64 alpha: empty & glowing droplet)
function paintDot(w, h, filled) {
  const { canvas, g } = makeCanvas(w, h);
  g.clearRect(0, 0, w, h);
  const cx = w * 0.5;
  const dropletPath = () => {
    g.beginPath();
    g.moveTo(cx, h * 0.12);
    g.bezierCurveTo(w * 0.82, h * 0.48, w * 0.80, h * 0.86, cx, h * 0.88);
    g.bezierCurveTo(w * 0.20, h * 0.86, w * 0.18, h * 0.48, cx, h * 0.12);
    g.closePath();
  };

  if (filled) {
    dab(g, cx, h * 0.56, w * 0.44, h * 0.44, 0, PALETTE.sun, 0.45, false, false);
    const gr = g.createRadialGradient(cx, h * 0.54, w * 0.04, cx, h * 0.58, w * 0.36);
    gr.addColorStop(0.0, PALETTE.brightest);
    gr.addColorStop(0.55, PALETTE.sun);
    gr.addColorStop(1.0, PALETTE.peach);
    g.fillStyle = gr;
    dropletPath();
    g.fill();
  } else {
    g.fillStyle = rgba(PALETTE.paper, 0.35);
    dropletPath();
    g.fill();
  }
  g.strokeStyle = PALETTE.ink;
  g.lineWidth = Math.max(2, w * 0.065);
  dropletPath();
  g.stroke();
  dilateAlphaEdges(canvas, 4);
  return canvas;
}

register('ui.dot', {
  size: 64, tile: false, space: 'srgb', kind: 'ui',
  usage: 'Empty fragment droplet outline (zone-tintable)',
  baseColor: PALETTE.ink,
  build: (w, h) => paintDot(w, h, false),
});

register('ui.dot.filled', {
  size: 64, tile: false, space: 'srgb', kind: 'ui',
  usage: 'Filled glowing fragment droplet (zone-tintable)',
  baseColor: PALETTE.sun,
  build: (w, h) => paintDot(w, h, true),
});

// 15. ui.dialogue (768x192 alpha: paper box with name tab & small tail)
register('ui.dialogue', {
  size: [768, 192], tile: false, space: 'srgb', kind: 'ui',
  usage: 'Storybook dialogue paper box with speaker name tab and speech tail',
  baseColor: PALETTE.paper,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);

    // Name tab (top-left)
    roundedRectPath(g, w * 0.05, h * 0.04, w * 0.26, h * 0.28, h * 0.12);
    g.fillStyle = PALETTE.sun;
    g.fill();
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = Math.max(2, h * 0.018);
    g.stroke();

    // Main paper dialogue panel
    roundedRectPath(g, w * 0.02, h * 0.22, w * 0.96, h * 0.66, h * 0.14);
    g.fillStyle = PALETTE.paper;
    g.fill();
    g.stroke();

    // Small bottom-left speech tail
    g.beginPath();
    g.moveTo(w * 0.14, h * 0.87);
    g.lineTo(w * 0.10, h * 0.96);
    g.lineTo(w * 0.19, h * 0.87);
    g.closePath();
    g.fill();
    g.stroke();

    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.025, seed, wrapX: false, wrapY: false, preserveAlpha: true });
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 16. ui.portrait (atlas 512x128: 4x128 painted faces for Grandma, Bramble, Pebble, Moth)
register('ui.portrait', {
  size: [512, 128], tile: false, space: 'srgb', kind: 'ui',
  usage: '4-portrait dialogue atlas (Grandma, Bramble, Pebble, Moth)',
  baseColor: PALETTE.paper,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const cw = w / 4;
    const chars = [
      { bg: PALETTE.marshMist, face: PALETTE.marsh, hat: PALETTE.cream, accent: PALETTE.peach },       // Grandma
      { bg: PALETTE.forestGoldLight, face: PALETTE.forestOlive, hat: PALETTE.forestAmber, accent: PALETTE.cream }, // Bramble
      { bg: PALETTE.cream, face: PALETTE.peach, hat: PALETTE.stoneLight, accent: PALETTE.sun },        // Pebble
      { bg: PALETTE.crownCool, face: PALETTE.paper, hat: PALETTE.cavernTeal, accent: PALETTE.crownBlush }, // Moth
    ];

    chars.forEach((c, i) => {
      const cx = (i + 0.5) * cw, cy = h * 0.5, r = Math.min(cw, h) * 0.42;
      g.fillStyle = c.bg;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();

      // Head silhouette
      g.fillStyle = c.face;
      g.beginPath(); g.arc(cx, cy + r * 0.08, r * 0.62, 0, Math.PI * 2); g.fill();

      // Distinctive shawl/shell/antennae hat accent
      g.fillStyle = c.hat;
      g.beginPath(); g.ellipse(cx, cy - r * 0.34, r * 0.56, r * 0.28, 0, 0, Math.PI * 2); g.fill();

      // Friendly eyes & rosy cheeks
      for (const sx of [-0.22, 0.22]) {
        g.fillStyle = PALETTE.coolShadow;
        g.beginPath(); g.arc(cx + sx * r, cy + r * 0.04, r * 0.1, 0, Math.PI * 2); g.fill();
        g.fillStyle = PALETTE.brightest;
        g.beginPath(); g.arc(cx + sx * r - r * 0.03, cy + r * 0.01, r * 0.035, 0, Math.PI * 2); g.fill();
        g.fillStyle = c.accent;
        g.globalAlpha = 0.5;
        g.beginPath(); g.arc(cx + sx * r * 1.4, cy + r * 0.2, r * 0.1, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      // Portrait frame ring
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = Math.max(2, r * 0.09);
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    });
    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.02, seed, wrapX: false, wrapY: false, preserveAlpha: true });
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 17. ui.keys (atlas 768x64: 12 hand-drawn keycaps E,W,A,S,D,H,Space,Shift,Esc,M,Tab,P)
register('ui.keys', {
  size: [768, 64], tile: false, space: 'srgb', kind: 'ui',
  usage: '12 hand-drawn cream/ink keycap icons (E,W,A,S,D,H,Space,Shift,Esc,M,Tab,P)',
  baseColor: PALETTE.cream,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const keys = ['E', 'W', 'A', 'S', 'D', 'H', 'SPC', 'SHF', 'ESC', 'M', 'TAB', 'P'];
    const cw = w / keys.length;

    keys.forEach((label, i) => {
      const x = i * cw + cw * 0.1, y = h * 0.12, kw = cw * 0.8, kh = h * 0.76;
      // Warm bottom lip
      roundedRectPath(g, x, y + h * 0.07, kw, kh, h * 0.18);
      g.fillStyle = PALETTE.stone;
      g.fill();

      // Cream keycap face
      roundedRectPath(g, x, y, kw, kh, h * 0.18);
      g.fillStyle = PALETTE.paper;
      g.fill();
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = Math.max(1.5, h * 0.04);
      g.stroke();

      g.fillStyle = PALETTE.ink;
      g.font = `700 ${Math.round(h * (label.length > 1 ? 0.28 : 0.42))}px Fredoka, Segoe UI, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, x + kw * 0.5, y + kh * 0.52);
    });
    dilateAlphaEdges(canvas, 3);
    return canvas;
  },
});

// 18. ui.compass (256 alpha: soft edge-glow arrow)
register('ui.compass', {
  size: 256, tile: false, space: 'srgb', kind: 'ui',
  usage: 'Soft edge-glow golden compass direction arrow',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);
    dab(g, cx, cy, w * 0.44, h * 0.44, 0, PALETTE.sun, 0.42, false, false);

    g.fillStyle = PALETTE.brightest;
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = w * 0.03;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(cx, h * 0.14);
    g.lineTo(w * 0.74, h * 0.76);
    g.lineTo(cx, h * 0.62);
    g.lineTo(w * 0.26, h * 0.76);
    g.closePath();
    g.fill();
    g.stroke();
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 19. ui.signicons (384x128: 3x128 move, jump, climb doodles for wooden signs)
register('ui.signicons', {
  size: [384, 128], tile: false, space: 'srgb', kind: 'ui',
  usage: '3-cell painted wooden-sign tutorial doodles (move, jump, climb)',
  baseColor: PALETTE.ink,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const cw = w / 3;
    g.strokeStyle = PALETTE.ink;
    g.fillStyle = PALETTE.ink;
    g.lineWidth = Math.max(3, h * 0.055);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Cell 0: Move (left/right arrows + little footprints)
    let cx = cw * 0.5, cy = h * 0.5;
    g.beginPath();
    g.moveTo(cx - cw * 0.28, cy); g.lineTo(cx + cw * 0.28, cy);
    g.moveTo(cx - cw * 0.16, cy - h * 0.14); g.lineTo(cx - cw * 0.28, cy); g.lineTo(cx - cw * 0.16, cy + h * 0.14);
    g.moveTo(cx + cw * 0.16, cy - h * 0.14); g.lineTo(cx + cw * 0.28, cy); g.lineTo(cx + cw * 0.16, cy + h * 0.14);
    g.stroke();

    // Cell 1: Jump (parabolic hop arc with up arrow)
    cx = cw * 1.5;
    g.beginPath();
    g.moveTo(cx - cw * 0.28, h * 0.74);
    g.quadraticCurveTo(cx, h * 0.14, cx + cw * 0.28, h * 0.74);
    g.moveTo(cx + cw * 0.14, h * 0.66); g.lineTo(cx + cw * 0.28, h * 0.74); g.lineTo(cx + cw * 0.28, h * 0.56);
    g.stroke();

    // Cell 2: Climb (vertical ledge + upward steps)
    cx = cw * 2.5;
    g.beginPath();
    g.moveTo(cx - cw * 0.22, h * 0.8); g.lineTo(cx - cw * 0.22, h * 0.24); g.lineTo(cx + cw * 0.24, h * 0.24);
    g.moveTo(cx + cw * 0.05, h * 0.76); g.lineTo(cx + cw * 0.05, h * 0.42);
    g.moveTo(cx - cw * 0.06, h * 0.54); g.lineTo(cx + cw * 0.05, h * 0.42); g.lineTo(cx + cw * 0.16, h * 0.54);
    g.stroke();

    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 20. ui.map (1024x512 NOT tiling) + mapRegionWash(regions) & mapPaths(paths)
export function mapRegionWash(regions, g, w = g.canvas.width, h = g.canvas.height) {
  g.save();
  for (const reg of regions) {
    const cx = (reg.center[0] / 600) * w;
    const cy = (reg.center[1] / 200) * h;
    const rx = (reg.radius / 600) * w * 1.15;
    const ry = (reg.radius / 200) * h * 0.95;
    const col = reg.palette[1] || reg.palette[0];
    dab(g, cx, cy, rx, ry, 0, col, 0.24, false, false);
  }
  g.restore();
}

export function mapPaths(paths, g, w = g.canvas.width, h = g.canvas.height) {
  g.save();
  g.strokeStyle = PALETTE.roof;
  g.lineWidth = Math.max(2, h * 0.006);
  g.setLineDash([w * 0.01, w * 0.008]);
  g.lineCap = 'round';
  g.globalAlpha = 0.68;
  for (const path of paths) {
    if (!path || path.length < 2) continue;
    g.beginPath();
    g.moveTo((path[0][0] / 600) * w, (path[0][1] / 200) * h);
    for (let i = 1; i < path.length; i++) {
      g.lineTo((path[i][0] / 600) * w, (path[i][1] / 200) * h);
    }
    g.stroke();
  }
  g.restore();
}

register('ui.map', {
  size: [1024, 512], tile: false, space: 'srgb', kind: 'tile', // WebGL + CSS
  usage: 'World map parchment with stains, soft edge burn, and region-wash helpers',
  baseColor: PALETTE.paper,
  build(w, h, seed, ctx) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const f = domainWarp(w, h, { scaleX: 4, scaleY: 2, octaves: 3, warpAmp: 0.22, seed, wrapX: false, wrapY: false });
    rampMap(f, [PALETTE.stoneLight, PALETTE.cream, PALETTE.paper, PALETTE.brightest], g, w, h);
    scatterDabs(g, rand, {
      count: Math.round(260 * ctx.dabMult),
      colors: [PALETTE.cream, PALETTE.stoneLight, PALETTE.peach, PALETTE.paper],
      minR: 0.04, maxR: 0.14, minAlpha: 0.05, maxAlpha: 0.12, wrapX: false, wrapY: false,
    });
    // Soft edge burn
    const burn = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.3, w * 0.5, h * 0.5, w * 0.58);
    burn.addColorStop(0.0, rgba(PALETTE.roof, 0.0));
    burn.addColorStop(0.72, rgba(PALETTE.stone, 0.16));
    burn.addColorStop(1.0, rgba(PALETTE.roof, 0.42));
    g.fillStyle = burn;
    g.fillRect(0, 0, w, h);

    // Subtle map compass rose & border ink frame
    g.strokeStyle = rgba(PALETTE.ink, 0.45);
    g.lineWidth = Math.max(2, h * 0.005);
    roundedRectPath(g, w * 0.025, h * 0.05, w * 0.95, h * 0.9, h * 0.04);
    g.stroke();

    addGrain(g, 0.03, seed, false);
    return canvas;
  },
});

// 21. ui.map.icons (448x64: 7x64 ink-and-wash icons: tower, tree, ribs, eyelid, lookout, ant dot, wishlight)
register('ui.map.icons', {
  size: [448, 64], tile: false, space: 'srgb', kind: 'sprite',
  usage: '7-icon map atlas (tower, tree, ribs, eyelid, lookout, ant dot, wishlight)',
  baseColor: PALETTE.ink,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const cw = w / 7;
    const drawBase = (i, wash) => {
      const cx = (i + 0.5) * cw, cy = h * 0.5;
      dab(g, cx, cy, cw * 0.36, h * 0.36, 0, wash, 0.42, false, false);
      return [cx, cy];
    };
    g.strokeStyle = PALETTE.ink;
    g.fillStyle = PALETTE.ink;
    g.lineWidth = Math.max(2, h * 0.05);
    g.lineCap = 'round';

    // 0: Tower
    let [cx, cy] = drawBase(0, PALETTE.stone);
    g.strokeRect(cx - cw * 0.14, cy - h * 0.12, cw * 0.28, h * 0.34);
    g.beginPath(); g.moveTo(cx - cw * 0.2, cy - h * 0.12); g.lineTo(cx, cy - h * 0.34); g.lineTo(cx + cw * 0.2, cy - h * 0.12); g.closePath(); g.stroke();

    // 1: Tree
    [cx, cy] = drawBase(1, PALETTE.forestAmber);
    g.beginPath(); g.moveTo(cx, cy + h * 0.28); g.lineTo(cx, cy - h * 0.04); g.stroke();
    g.beginPath(); g.arc(cx, cy - h * 0.12, cw * 0.22, 0, Math.PI * 2); g.stroke();

    // 2: Ribs
    [cx, cy] = drawBase(2, PALETTE.cavernTeal);
    for (const dx of [-0.16, 0, 0.16]) {
      g.beginPath(); g.arc(cx + dx * cw, cy + h * 0.14, cw * 0.16, Math.PI, 0); g.stroke();
    }

    // 3: Eyelid
    [cx, cy] = drawBase(3, PALETTE.crownBlush);
    g.beginPath();
    g.moveTo(cx - cw * 0.28, cy);
    g.quadraticCurveTo(cx, cy - h * 0.24, cx + cw * 0.28, cy);
    g.quadraticCurveTo(cx, cy + h * 0.16, cx - cw * 0.28, cy);
    g.stroke();

    // 4: Lookout
    [cx, cy] = drawBase(4, PALETTE.sun);
    g.beginPath(); g.arc(cx, cy, cw * 0.22, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, cw * 0.08, 0, Math.PI * 2); g.fill();

    // 5: Ant dot (Pip)
    [cx, cy] = drawBase(5, PALETTE.pipRusset);
    g.fillStyle = PALETTE.pipRusset;
    g.beginPath(); g.arc(cx, cy, cw * 0.18, 0, Math.PI * 2); g.fill();
    g.stroke();

    // 6: Wishlight
    [cx, cy] = drawBase(6, PALETTE.sun);
    g.fillStyle = PALETTE.brightest;
    g.beginPath(); g.arc(cx, cy, cw * 0.14, 0, Math.PI * 2); g.fill();
    g.strokeStyle = PALETTE.sun;
    g.beginPath();
    g.moveTo(cx, cy - h * 0.3); g.lineTo(cx, cy + h * 0.3);
    g.moveTo(cx - cw * 0.3, cy); g.lineTo(cx + cw * 0.3, cy);
    g.stroke();

    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 22. ui.loading (256 alpha: sunrise ring around tiny ant with progress-fill mask)
register('ui.loading', {
  size: 256, tile: false, space: 'srgb', kind: 'ui',
  usage: 'Sunrise loading ring around tiny Pip silhouette',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);

    // Warm sunrise glow ring
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0.0, PALETTE.peach);
    gr.addColorStop(0.5, PALETTE.sun);
    gr.addColorStop(1.0, PALETTE.brightest);
    g.strokeStyle = gr;
    g.lineWidth = w * 0.07;
    g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, w * 0.38, 0, Math.PI * 2); g.stroke();

    // Tiny cozy Pip silhouette inside
    g.fillStyle = PALETTE.pipRusset;
    g.beginPath(); g.ellipse(cx - w * 0.08, cy + h * 0.03, w * 0.08, h * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + w * 0.02, cy + h * 0.01, w * 0.055, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + w * 0.10, cy - h * 0.02, w * 0.05, 0, Math.PI * 2); g.fill();
    // Little backpack leaf & glowing bulb
    g.fillStyle = PALETTE.marsh;
    g.beginPath(); g.ellipse(cx - w * 0.04, cy - h * 0.06, w * 0.07, h * 0.04, -0.4, 0, Math.PI * 2); g.fill();
    dab(g, cx + w * 0.16, cy - h * 0.08, w * 0.06, w * 0.06, 0, PALETTE.sun, 0.9, false, false);

    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 23. ui.toast (256x64 alpha: small paper strip)
register('ui.toast', {
  size: [256, 64], tile: false, space: 'srgb', kind: 'ui',
  usage: 'Small cream paper notification toast strip',
  baseColor: PALETTE.paper,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    roundedRectPath(g, w * 0.03, h * 0.1, w * 0.94, h * 0.8, h * 0.28);
    g.fillStyle = PALETTE.paper;
    g.fill();
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = Math.max(1.5, h * 0.035);
    g.stroke();
    finishSurface(g, null, { aoStrength: 0, grainAmount: 0.025, seed, wrapX: false, wrapY: false, preserveAlpha: true });
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});
