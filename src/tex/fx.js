/**
 * Dreamback Texture Kit — T4: Sprites, Particles and Glow (24 ids)
 * All alpha, ClampToEdge, soft falloff, additive-safe (alpha channel, never black backgrounds).
 */

import { register } from './store.js';
import { PALETTE, hexToRgb, mixHex } from './palette.js';
import {
  rng,
  domainWarp,
  makeCanvas,
  dab,
  dilateAlphaEdges,
} from './core.js';

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

function paintRadialHalo(w, h, coreHex, midHex, tailHex, power = 2.2) {
  const { canvas, g } = makeCanvas(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  const c0 = hexToRgb(coreHex);
  const c1 = hexToRgb(midHex);
  const c2 = hexToRgb(tailHex);
  const cx = (w - 1) * 0.5, cy = (h - 1) * 0.5;
  const invR = 1 / (Math.min(w, h) * 0.5);

  let idx = 0;
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) * invR;
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) * invR;
      const r = Math.min(1, Math.hypot(dx, dy));
      const a = Math.pow(1 - r, power);
      const t1 = Math.min(1, r * 2);
      const t2 = Math.max(0, (r - 0.45) / 0.55);
      const rr = (c0[0] + (c1[0] - c0[0]) * t1) * (1 - t2) + c2[0] * t2;
      const gg = (c0[1] + (c1[1] - c0[1]) * t1) * (1 - t2) + c2[1] * t2;
      const bb = (c0[2] + (c1[2] - c0[2]) * t1) * (1 - t2) + c2[2] * t2;
      const p = idx++ * 4;
      d[p] = rr; d[p + 1] = gg; d[p + 2] = bb;
      d[p + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  dilateAlphaEdges(canvas, 4);
  return canvas;
}

// 1, 2, 3. fx.halo.warm / cool / pink (256)
register('fx.halo.warm', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Warm golden gaussian halo glow (additive-safe)',
  baseColor: PALETTE.sun,
  build: (w, h) => paintRadialHalo(w, h, PALETTE.brightest, PALETTE.sun, PALETTE.peach, 2.4),
});

register('fx.halo.cool', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Cool cavern-teal gaussian halo glow (additive-safe)',
  baseColor: PALETTE.cavernTeal,
  build: (w, h) => paintRadialHalo(w, h, PALETTE.brightest, PALETTE.cavernTeal, PALETTE.marshMist, 2.4),
});

register('fx.halo.pink', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Soft rose-blush gaussian halo glow (additive-safe)',
  baseColor: PALETTE.crownBlush,
  build: (w, h) => paintRadialHalo(w, h, PALETTE.brightest, PALETTE.crownBlush, PALETTE.cavernRose, 2.4),
});

// 4. fx.godray (64x512)
register('fx.godray', {
  size: [64, 512], tile: false, space: 'srgb', kind: 'fx',
  usage: 'Soft vertical golden sunbeam god-ray (brightest at top)',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const img = g.createImageData(w, h);
    const d = img.data;
    const cTop = hexToRgb(PALETTE.brightest);
    const cBot = hexToRgb(PALETTE.sun);
    let idx = 0;
    for (let y = 0; y < h; y++) {
      const vy = y / (h - 1);
      const yFade = Math.sin(Math.min(1, vy * 4) * Math.PI * 0.5) * Math.pow(1 - vy, 1.5);
      for (let x = 0; x < w; x++) {
        const vx = (x / (w - 1)) * 2 - 1;
        const xFade = Math.pow(Math.max(0, 1 - vx * vx), 2.1);
        const a = xFade * yFade * 0.72;
        const p = idx++ * 4;
        d[p] = cTop[0] + (cBot[0] - cTop[0]) * vy;
        d[p + 1] = cTop[1] + (cBot[1] - cTop[1]) * vy;
        d[p + 2] = cTop[2] + (cBot[2] - cTop[2]) * vy;
        d[p + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(img, 0, 0);
    dilateAlphaEdges(canvas, 3);
    return canvas;
  },
});

// 5. fx.firefly (64)
register('fx.firefly', {
  size: 64, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Bright firefly core with soft warm halo',
  baseColor: PALETTE.sun,
  build: (w, h) => paintRadialHalo(w, h, PALETTE.brightest, PALETTE.sun, PALETTE.forestHoney, 3.0),
});

// 6. fx.wishlight (64)
register('fx.wishlight', {
  size: 64, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Gold-white wishlight orb with soft trailing tail',
  baseColor: PALETTE.brightest,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    // Soft vertical comet tail below core
    const tail = g.createLinearGradient(w * 0.5, h * 0.25, w * 0.5, h * 0.96);
    tail.addColorStop(0.0, rgba(PALETTE.brightest, 0.85));
    tail.addColorStop(0.45, rgba(PALETTE.sun, 0.45));
    tail.addColorStop(1.0, rgba(PALETTE.peach, 0.0));
    g.fillStyle = tail;
    g.beginPath();
    g.moveTo(w * 0.34, h * 0.28);
    g.quadraticCurveTo(w * 0.5, h * 0.96, w * 0.5, h * 0.96);
    g.quadraticCurveTo(w * 0.5, h * 0.96, w * 0.66, h * 0.28);
    g.closePath();
    g.fill();

    // Bright core
    const core = g.createRadialGradient(w * 0.5, h * 0.28, w * 0.02, w * 0.5, h * 0.28, w * 0.3);
    core.addColorStop(0.0, rgba(PALETTE.brightest, 1.0));
    core.addColorStop(0.45, rgba(PALETTE.sun, 0.72));
    core.addColorStop(1.0, rgba(PALETTE.sun, 0.0));
    g.fillStyle = core;
    g.fillRect(0, 0, w, h);
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 7. fx.sparkle (128: soft 4-point star)
register('fx.sparkle', {
  size: 128, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Soft 4-point golden sparkle star',
  baseColor: PALETTE.brightest,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);
    // Soft ambient bloom
    dab(g, cx, cy, w * 0.32, h * 0.32, 0, PALETTE.sun, 0.42, false, false);
    // Horizontal & vertical tapered star rays
    const drawRay = (rx, ry) => {
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      grad.addColorStop(0.0, rgba(PALETTE.brightest, 0.96));
      grad.addColorStop(0.5, rgba(PALETTE.sun, 0.55));
      grad.addColorStop(1.0, rgba(PALETTE.sun, 0.0));
      g.save();
      g.translate(cx, cy);
      g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    drawRay(w * 0.46, h * 0.09);
    drawRay(w * 0.09, h * 0.46);
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 8. fx.butterfly (atlas 512x128, 4 wing sets: gold, amber, teal-pink moth, pearl)
register('fx.butterfly', {
  size: [512, 128], tile: false, space: 'srgb', kind: 'fx',
  usage: '4-cell painted butterfly wing atlas (mirrored in shader)',
  baseColor: PALETTE.butterflyGold,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const cw = w / 4;
    const wings = [
      { main: PALETTE.butterflyGold, rim: PALETTE.brightest, dot: PALETTE.peach, vein: PALETTE.roof },
      { main: PALETTE.forestAmber, rim: PALETTE.sun, dot: PALETTE.brightest, vein: PALETTE.ink },
      { main: PALETTE.cavernTeal, rim: PALETTE.cavernRose, dot: PALETTE.brightest, vein: PALETTE.cavernIndigo },
      { main: PALETTE.crownPearl, rim: PALETTE.crownGold, dot: PALETTE.crownBlush, vein: PALETTE.stone },
    ];

    wings.forEach((wc, i) => {
      const ox = i * cw;
      const hingeX = ox + cw * 0.16;
      const midY = h * 0.52;

      g.save();
      // Upper forewing
      g.fillStyle = wc.main;
      g.beginPath();
      g.ellipse(ox + cw * 0.52, h * 0.34, cw * 0.38, h * 0.25, -0.32, 0, Math.PI * 2);
      g.fill();
      // Lower hindwing
      g.beginPath();
      g.ellipse(ox + cw * 0.46, h * 0.68, cw * 0.29, h * 0.21, 0.28, 0, Math.PI * 2);
      g.fill();

      // Glowing rim
      g.strokeStyle = wc.rim;
      g.lineWidth = Math.max(1.5, cw * 0.035);
      g.globalAlpha = 0.85;
      g.beginPath();
      g.ellipse(ox + cw * 0.52, h * 0.34, cw * 0.35, h * 0.22, -0.32, 0, Math.PI * 2);
      g.stroke();

      // Painted wing veins
      g.strokeStyle = wc.vein;
      g.lineWidth = Math.max(1, cw * 0.018);
      g.globalAlpha = 0.42;
      for (const [tx, ty] of [[0.76, 0.22], [0.80, 0.36], [0.72, 0.48], [0.68, 0.70], [0.56, 0.80]]) {
        g.beginPath();
        g.moveTo(hingeX, midY);
        g.quadraticCurveTo(ox + cw * 0.45, midY, ox + cw * tx, h * ty);
        g.stroke();
      }
      // Soft decorative wing spots
      g.fillStyle = wc.dot;
      g.globalAlpha = 0.82;
      g.beginPath(); g.arc(ox + cw * 0.62, h * 0.30, cw * 0.075, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ox + cw * 0.52, h * 0.70, cw * 0.055, 0, Math.PI * 2); g.fill();
      g.restore();
    });
    dilateAlphaEdges(canvas, 6);
    return canvas;
  },
});

// 9. fx.moth (128: fuzzy moth wing)
register('fx.moth', {
  size: 128, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Fuzzy glowing moth wing sprite (alpha)',
  baseColor: PALETTE.cream,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    dab(g, w * 0.52, h * 0.38, w * 0.36, h * 0.24, -0.25, PALETTE.paper, 0.92, false, false);
    dab(g, w * 0.48, h * 0.66, w * 0.28, h * 0.20, 0.22, PALETTE.crownBlush, 0.82, false, false);
    dab(g, w * 0.58, h * 0.36, w * 0.14, h * 0.12, -0.2, PALETTE.sun, 0.75, false, false);
    dab(g, w * 0.52, h * 0.66, w * 0.09, h * 0.08, 0.2, PALETTE.cavernTeal, 0.65, false, false);
    dilateAlphaEdges(canvas, 6);
    return canvas;
  },
});

// 10. fx.bird (atlas 256x64, 3 flap frames)
register('fx.bird', {
  size: [256, 64], tile: false, space: 'srgb', kind: 'fx',
  usage: '3-frame distant bird flap silhouette atlas',
  baseColor: PALETTE.ink,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const cw = w / 3;
    const flapY = [-0.26, 0.02, 0.24];
    g.strokeStyle = PALETTE.ink;
    g.fillStyle = PALETTE.ink;
    g.lineCap = 'round';

    flapY.forEach((fy, i) => {
      const cx = (i + 0.5) * cw;
      const cy = h * 0.52;
      g.lineWidth = Math.max(2, h * 0.11);
      g.beginPath();
      g.moveTo(cx - cw * 0.36, cy + h * fy);
      g.quadraticCurveTo(cx - cw * 0.16, cy - h * 0.16, cx, cy);
      g.quadraticCurveTo(cx + cw * 0.16, cy - h * 0.16, cx + cw * 0.36, cy + h * fy);
      g.stroke();
      g.beginPath();
      g.ellipse(cx, cy + h * 0.02, cw * 0.08, h * 0.08, 0, 0, Math.PI * 2);
      g.fill();
    });
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 11. fx.leaf (atlas 192x64, 3 shapes: amber, olive, honey)
register('fx.leaf', {
  size: [192, 64], tile: false, space: 'srgb', kind: 'fx',
  usage: '3-shape drifting leaf particle atlas (amber, olive, honey)',
  baseColor: PALETTE.forestAmber,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const cw = w / 3;
    const cols = [PALETTE.forestAmber, PALETTE.forestOlive, PALETTE.forestHoney];
    cols.forEach((col, i) => {
      const cx = (i + 0.5) * cw, cy = h * 0.5;
      g.save();
      g.translate(cx, cy);
      g.rotate((i - 1) * 0.25);
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(0, 0, cw * 0.34, h * (0.24 + (i % 2) * 0.06), 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = PALETTE.forestBrown;
      g.lineWidth = Math.max(1, h * 0.04);
      g.globalAlpha = 0.55;
      g.beginPath(); g.moveTo(-cw * 0.28, 0); g.lineTo(cw * 0.28, 0); g.stroke();
      g.restore();
    });
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 12. fx.petal (atlas 192x64, 3 shapes: cream, pink, gold)
register('fx.petal', {
  size: [192, 64], tile: false, space: 'srgb', kind: 'fx',
  usage: '3-shape drifting blossom petal atlas (cream, pink, gold)',
  baseColor: PALETTE.crownBlush,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const cw = w / 3;
    const cols = [PALETTE.cream, PALETTE.crownBlush, PALETTE.crownGold];
    cols.forEach((col, i) => {
      const cx = (i + 0.5) * cw, cy = h * 0.5;
      dab(g, cx, cy, cw * 0.32, h * 0.28, (i - 1) * 0.3, col, 0.92, false, false);
      dab(g, cx - cw * 0.06, cy - h * 0.04, cw * 0.16, h * 0.14, 0, PALETTE.brightest, 0.45, false, false);
    });
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 13. fx.spore (64)
register('fx.spore', {
  size: 64, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Soft glowing teal cavern spore particle',
  baseColor: PALETTE.cavernTeal,
  build: (w, h) => paintRadialHalo(w, h, PALETTE.brightest, PALETTE.cavernTeal, PALETTE.cavernTeal, 2.2),
});

// 14. fx.dust (64)
register('fx.dust', {
  size: 64, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Faint golden sun-dust mote particle',
  baseColor: PALETTE.sun,
  build: (w, h) => paintRadialHalo(w, h, PALETTE.brightest, PALETTE.sun, PALETTE.cream, 2.8),
});

// 15. fx.mist (256: extremely soft, low alpha)
register('fx.mist', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Extremely soft low-alpha drifting meadow mist puff',
  baseColor: PALETTE.paper,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * w * 0.16;
      dab(g, w * 0.5 + Math.cos(a) * d, h * 0.5 + Math.sin(a) * d, w * (0.24 + rand() * 0.12), h * (0.22 + rand() * 0.1), rand(), i % 2 === 0 ? PALETTE.paper : PALETTE.marshMist, 0.08, false, false);
    }
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 16. fx.smoke (128: curl puff)
register('fx.smoke', {
  size: 128, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Soft warm chimney smoke curl puff',
  baseColor: PALETTE.cream,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const lobes = [[0.5, 0.5, 0.3], [0.36, 0.54, 0.22], [0.62, 0.44, 0.23], [0.48, 0.34, 0.20]];
    for (const [x, y, r] of lobes) {
      dab(g, x * w, y * h, r * w, r * h, 0, PALETTE.cream, 0.42, false, false);
      dab(g, x * w, (y - 0.04) * h, r * 0.7 * w, r * 0.7 * h, 0, PALETTE.paper, 0.34, false, false);
    }
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 17. fx.ring (256: hum pulse ring)
register('fx.ring', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Warm golden hum pulse ring with soft inner and outer falloff',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const img = g.createImageData(w, h);
    const d = img.data;
    const c1 = hexToRgb(PALETTE.brightest);
    const c2 = hexToRgb(PALETTE.sun);
    const cx = (w - 1) * 0.5, cy = (h - 1) * 0.5, invR = 1 / (Math.min(w, h) * 0.5);
    let idx = 0;
    for (let y = 0; y < h; y++) {
      const dy = (y - cy) * invR;
      for (let x = 0; x < w; x++) {
        const r = Math.hypot((x - cx) * invR, dy);
        const distRing = Math.abs(r - 0.74) / 0.18;
        const a = Math.max(0, 1 - distRing * distRing);
        const soft = a * a;
        const p = idx++ * 4;
        d[p] = c2[0] + (c1[0] - c2[0]) * soft;
        d[p + 1] = c2[1] + (c1[1] - c2[1]) * soft;
        d[p + 2] = c2[2] + (c1[2] - c2[2]) * soft;
        d[p + 3] = Math.round(soft * 240);
      }
    }
    g.putImageData(img, 0, 0);
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 18. fx.calm (256: Calm Spot disc)
register('fx.calm', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Calm Spot disc: radial moss glow, thin ring, drifting specks',
  baseColor: PALETTE.marsh,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);

    // Radial moss-mint glow
    const gr = g.createRadialGradient(cx, cy, w * 0.04, cx, cy, w * 0.48);
    gr.addColorStop(0.0, rgba(PALETTE.marshMist, 0.52));
    gr.addColorStop(0.55, rgba(PALETTE.marsh, 0.34));
    gr.addColorStop(0.84, rgba(PALETTE.sun, 0.42));
    gr.addColorStop(1.0, rgba(PALETTE.marsh, 0.0));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);

    // Thin hand-painted ring
    g.strokeStyle = rgba(PALETTE.brightest, 0.75);
    g.lineWidth = w * 0.015;
    g.beginPath(); g.arc(cx, cy, w * 0.39, 0, Math.PI * 2); g.stroke();

    // Drifting specks
    for (let i = 0; i < 24; i++) {
      const a = rand() * Math.PI * 2;
      const dist = w * (0.08 + rand() * 0.32);
      dab(g, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, w * 0.02, w * 0.02, 0, i % 2 === 0 ? PALETTE.brightest : PALETTE.sun, 0.65, false, false);
    }
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 19. fx.orb (256: dream orb pink & gold warped fbm swirl)
register('fx.orb', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Dream orb with pink-gold warped fBm swirl, bright rim and inner glow',
  baseColor: PALETTE.crownBlush,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const swirl = domainWarp(w, h, { scaleX: 4, scaleY: 4, octaves: 3, warpAmp: 0.35, seed, wrapX: false, wrapY: false });
    const img = g.createImageData(w, h);
    const d = img.data;
    const cPink = hexToRgb(PALETTE.crownBlush);
    const cGold = hexToRgb(PALETTE.sun);
    const cRim = hexToRgb(PALETTE.brightest);
    const cx = (w - 1) * 0.5, cy = (h - 1) * 0.5, invR = 1 / (Math.min(w, h) * 0.46);

    let idx = 0;
    for (let y = 0; y < h; y++) {
      const dy = (y - cy) * invR;
      for (let x = 0; x < w; x++) {
        const r = Math.hypot((x - cx) * invR, dy);
        const s = swirl[idx];
        const edgeA = r < 1 ? Math.pow(1 - r * r, 0.65) : 0;
        const rim = Math.exp(-Math.pow((r - 0.84) / 0.1, 2)) * 0.85;
        const inner = Math.exp(-r * r * 3.2) * 0.7;
        const mix = Math.min(1, s * 0.85 + inner * 0.3);
        const rr = cPink[0] + (cGold[0] - cPink[0]) * mix;
        const gg = cPink[1] + (cGold[1] - cPink[1]) * mix;
        const bb = cPink[2] + (cGold[2] - cPink[2]) * mix;
        const p = idx++ * 4;
        d[p] = rr + (cRim[0] - rr) * Math.min(1, rim + inner * 0.5);
        d[p + 1] = gg + (cRim[1] - gg) * Math.min(1, rim + inner * 0.5);
        d[p + 2] = bb + (cRim[2] - bb) * Math.min(1, rim + inner * 0.5);
        d[p + 3] = Math.round(Math.min(1, edgeA * 0.82 + rim) * 255);
      }
    }
    g.putImageData(img, 0, 0);
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 20. fx.fragment (256: Dream Fragment halo with 6 soft rays)
register('fx.fragment', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Dream Fragment glowing halo with 6 soft starburst rays',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);
    dab(g, cx, cy, w * 0.42, h * 0.42, 0, PALETTE.sun, 0.55, false, false);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      const grad = g.createLinearGradient(0, 0, w * 0.48, 0);
      grad.addColorStop(0.0, rgba(PALETTE.brightest, 0.9));
      grad.addColorStop(0.45, rgba(PALETTE.sun, 0.45));
      grad.addColorStop(1.0, rgba(PALETTE.peach, 0.0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -h * 0.045);
      g.lineTo(w * 0.48, 0);
      g.lineTo(0, h * 0.045);
      g.closePath();
      g.fill();
      g.restore();
    }
    dab(g, cx, cy, w * 0.2, h * 0.2, 0, PALETTE.brightest, 0.95, false, false);
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 21. fx.fragment.crystal (128: tintable per-zone faceted crystal)
register('fx.fragment.crystal', {
  size: 128, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Neutral-warm faceted Dream Fragment crystal sprite (tintable per zone)',
  baseColor: PALETTE.paper,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    g.clearRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.5;
    const poly = (pts, col, a) => {
      g.save(); g.fillStyle = col; g.globalAlpha = a;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath(); g.fill(); g.restore();
    };
    const top = [cx, h * 0.08], bot = [cx, h * 0.92], left = [w * 0.22, cy], right = [w * 0.78, cy], mid = [cx, cy];
    poly([top, left, mid], PALETTE.brightest, 0.95);
    poly([top, mid, right], PALETTE.paper, 0.92);
    poly([left, bot, mid], PALETTE.cream, 0.90);
    poly([mid, bot, right], PALETTE.stoneLight, 0.88);
    dab(g, cx, cy * 0.85, w * 0.2, h * 0.2, 0, PALETTE.brightest, 0.7, false, false);
    dilateAlphaEdges(canvas, 5);
    return canvas;
  },
});

// 22. fx.footprint (64: tiny flower footprint)
register('fx.footprint', {
  size: 64, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Tiny golden flower footprint decal',
  baseColor: PALETTE.cream,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5, r = w * 0.34;
    g.clearRect(0, 0, w, h);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      dab(g, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.45, r * 0.35, a, PALETTE.cream, 0.78, false, false);
    }
    dab(g, cx, cy, r * 0.3, r * 0.3, 0, PALETTE.sun, 0.88, false, false);
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 23. fx.shadow (128: soft contact shadow in #2C4A47, never black)
register('fx.shadow', {
  size: 128, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Soft round contact shadow tinted #2C4A47 (never black)',
  baseColor: PALETTE.coolShadow,
  build: (w, h) => paintRadialHalo(w, h, PALETTE.coolShadow, PALETTE.coolShadow, PALETTE.coolShadow, 1.9),
});

// 24. fx.lanternpool (256: warm ground light pool)
register('fx.lanternpool', {
  size: 256, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Warm golden lantern light pool for ground projection',
  baseColor: PALETTE.sun,
  build: (w, h) => paintRadialHalo(w, h, PALETTE.brightest, PALETTE.sun, PALETTE.peach, 2.0),
});
