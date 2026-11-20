/**
 * Dreamback Texture Kit — T8: Menu and Storytelling Pages (11 ids + STORY_TOKENS)
 * Painted picture-book scenes at 1280x720 (high), 960x540 (med), 640x360 (low).
 * Delivered via css(id). ZERO text baked into any page.
 */

import { register } from './store.js';
import { PALETTE, TIME_KEYFRAMES, hexToRgb, mixHex } from './palette.js';
import {
  rng,
  makeCanvas,
  dab,
  addGrain,
  dilateAlphaEdges,
} from './core.js';

export const STORY_TOKENS = Object.freeze({
  textColor: PALETTE.ink,
  textLight: PALETTE.brightest,
  textShadow: '0 2px 10px rgba(74, 59, 42, 0.28)',
  caretColor: PALETTE.pipRusset,
  maxLineLengthCh: 54,
  lineHeight: 1.62,
});

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// =========================================================================
// Shared Picture-Book Scene Kit (sky, sun, 3..5 hills, trees, towers, puffs, grain, vignette)
// =========================================================================
function paintSky(g, w, h, kf) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, kf.zenith);
  grad.addColorStop(0.48, kf.mid);
  grad.addColorStop(1.0, kf.horizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function paintSun(g, w, h, sx, sy, rad, color = PALETTE.sun) {
  const x = sx * w, y = sy * h, r = rad * h;
  const glow = g.createRadialGradient(x, y, r * 0.15, x, y, r * 4.2);
  glow.addColorStop(0.0, rgba(PALETTE.brightest, 0.95));
  glow.addColorStop(0.24, rgba(color, 0.68));
  glow.addColorStop(0.6, rgba(PALETTE.peach, 0.22));
  glow.addColorStop(1.0, rgba(PALETTE.peach, 0.0));
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  g.fillStyle = PALETTE.brightest;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function paintRollingHill(g, w, h, baseY, amp, freq, phase, color, rand) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const y = baseY * h + Math.sin(u * Math.PI * freq + phase) * amp * h + Math.cos(u * Math.PI * freq * 1.9 + phase) * amp * 0.35 * h;
    g.lineTo(u * w, y);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();

  // Soft painterly brush texture along hill crest
  if (rand) {
    for (let i = 0; i < 16; i++) {
      const u = rand();
      const y = baseY * h + Math.sin(u * Math.PI * freq + phase) * amp * h + h * (0.04 + rand() * 0.12);
      dab(g, u * w, y, w * 0.07, h * 0.05, (rand() - 0.5) * 0.4, mixHex(color, PALETTE.sun, 0.25), 0.09, false, false);
    }
  }
}

function paintTower(g, x, y, scale, color) {
  g.save();
  g.fillStyle = color;
  const tw = scale * 0.42, th = scale * 1.05;
  g.fillRect(x - tw * 0.5, y - th, tw, th);
  // Conical cottage roof
  g.beginPath();
  g.moveTo(x - tw * 0.72, y - th + 2);
  g.lineTo(x, y - th - scale * 0.48);
  g.lineTo(x + tw * 0.72, y - th + 2);
  g.closePath();
  g.fill();
  // Warm lit window dot
  dab(g, x, y - th * 0.62, tw * 0.35, tw * 0.35, 0, PALETTE.sun, 0.9, false, false);
  g.restore();
}

function paintTree(g, x, y, scale, color) {
  g.save();
  g.fillStyle = color;
  g.fillRect(x - scale * 0.07, y - scale * 0.55, scale * 0.14, scale * 0.55);
  g.beginPath(); g.arc(x, y - scale * 0.68, scale * 0.36, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x - scale * 0.22, y - scale * 0.54, scale * 0.26, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + scale * 0.22, y - scale * 0.52, scale * 0.25, 0, Math.PI * 2); g.fill();
  g.restore();
}

function paintPuff(g, x, y, scale) {
  g.save();
  g.fillStyle = PALETTE.paper;
  g.beginPath(); g.ellipse(x, y, scale * 0.65, scale * 0.46, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x - scale * 0.35, y - scale * 0.15, scale * 0.32, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + scale * 0.32, y - scale * 0.12, scale * 0.30, 0, Math.PI * 2); g.fill();
  g.fillStyle = PALETTE.puffMuzzle;
  g.beginPath(); g.arc(x + scale * 0.55, y - scale * 0.06, scale * 0.22, 0, Math.PI * 2); g.fill();
  g.restore();
}

function paintPipWithLantern(g, x, y, scale) {
  g.save();
  g.fillStyle = PALETTE.ink;
  g.beginPath(); g.ellipse(x - scale * 0.35, y, scale * 0.32, scale * 0.24, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + scale * 0.05, y - scale * 0.06, scale * 0.22, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + scale * 0.38, y - scale * 0.18, scale * 0.20, 0, Math.PI * 2); g.fill();
  // Glowing lantern ahead of Pip
  dab(g, x + scale * 0.85, y - scale * 0.42, scale * 1.1, scale * 1.1, 0, PALETTE.sun, 0.55, false, false);
  dab(g, x + scale * 0.85, y - scale * 0.42, scale * 0.35, scale * 0.35, 0, PALETTE.brightest, 0.95, false, false);
  g.restore();
}

function paintParticles(g, w, h, rand, count, color) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h * 0.85;
    const r = (2 + rand() * 5) * (w / 1280);
    dab(g, x, y, r * 3, r * 3, 0, color, 0.35 + rand() * 0.45, false, false);
  }
}

function paintWarmVignette(g, w, h, strength = 0.28) {
  const gr = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.28, w * 0.5, h * 0.5, w * 0.65);
  gr.addColorStop(0.0, rgba(PALETTE.ink, 0.0));
  gr.addColorStop(1.0, rgba(PALETTE.ink, strength));
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

// =========================================================================
// T8 Registrations (Exact 11 IDs)
// =========================================================================

// 1. story.menu: golden-hour meadow, two stone towers, path, Puffs, butterflies, calm right side for logo
register('story.menu', {
  size: [1280, 720], tile: false, space: 'srgb', kind: 'story',
  usage: 'Title screen fallback painting (golden meadow, 2 towers, Puffs, calm right space for logo)',
  baseColor: PALETTE.sun,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    paintSky(g, w, h, TIME_KEYFRAMES[0]); // golden
    paintSun(g, w, h, 0.76, 0.44, 0.085, PALETTE.sun);

    // 4 layered atmospheric rolling hills (farther = lighter, warmer, lower contrast)
    paintRollingHill(g, w, h, 0.60, 0.07, 1.3, 0.4, '#D9A78C', rand);
    paintRollingHill(g, w, h, 0.67, 0.08, 1.6, 1.8, '#9FB589', rand);
    paintTower(g, w * 0.22, h * 0.64, h * 0.16, '#7C856B');
    paintRollingHill(g, w, h, 0.74, 0.07, 1.4, 3.1, PALETTE.marshDark, rand);
    paintTower(g, w * 0.34, h * 0.74, h * 0.22, PALETTE.roof);
    paintTree(g, w * 0.12, h * 0.76, h * 0.18, PALETTE.forestOlive);
    paintTree(g, w * 0.44, h * 0.77, h * 0.14, PALETTE.forestOlive);

    // Foreground golden-lit meadow + winding path on left/center (calm right space for logo)
    paintRollingHill(g, w, h, 0.84, 0.05, 1.2, 0.6, PALETTE.hubMeadow, rand);
    g.strokeStyle = rgba(PALETTE.dirt, 0.82);
    g.lineWidth = h * 0.055;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.22, h * 1.02);
    g.quadraticCurveTo(w * 0.28, h * 0.88, w * 0.36, h * 0.77);
    g.stroke();

    // Grazing Puffs & glowing butterflies
    paintPuff(g, w * 0.16, h * 0.87, h * 0.032);
    paintPuff(g, w * 0.24, h * 0.89, h * 0.026);
    paintPuff(g, w * 0.48, h * 0.88, h * 0.028);
    paintParticles(g, w, h, rand, 32, PALETTE.butterflyGold);

    paintWarmVignette(g, w, h, 0.24);
    addGrain(g, 0.028, seed, false);
    return canvas;
  },
});

// 2. story.beat1: 'Old Mother Hush' — sleeping Giant as vast mossy hill-range at sunset, glowing tail huts
register('story.beat1', {
  size: [1280, 720], tile: false, space: 'srgb', kind: 'story',
  usage: 'Intro Beat 1 painting: sleeping Giant mossy hill-range at sunset, glowing tail colony',
  baseColor: PALETTE.peach,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    paintSky(g, w, h, TIME_KEYFRAMES[0]);
    paintSun(g, w, h, 0.82, 0.50, 0.09, PALETTE.peach);

    // Vast slumbering Giant silhouette spanning the horizon (tail left -> head right)
    paintRollingHill(g, w, h, 0.62, 0.06, 1.1, 0.8, '#CFA192', rand);
    g.fillStyle = PALETTE.marshDark;
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, h * 0.72);
    g.bezierCurveTo(w * 0.18, h * 0.68, w * 0.34, h * 0.46, w * 0.56, h * 0.48); // Broad mossy back
    g.bezierCurveTo(w * 0.70, h * 0.50, w * 0.76, h * 0.38, w * 0.88, h * 0.45); // Gentle sleeping crown/head
    g.bezierCurveTo(w * 0.95, h * 0.50, w * 0.98, h * 0.62, w, h * 0.68);
    g.lineTo(w, h);
    g.closePath();
    g.fill();

    // Soft closed-eyelid curve near head & tiny glowing colony huts on tail (left)
    g.strokeStyle = rgba(PALETTE.crownBlush, 0.5);
    g.lineWidth = h * 0.008;
    g.beginPath(); g.arc(w * 0.85, h * 0.50, h * 0.04, 0.2, Math.PI - 0.2); g.stroke();

    for (const [hx, hy] of [[0.10, 0.71], [0.15, 0.70], [0.20, 0.68], [0.25, 0.67]]) {
      g.fillStyle = PALETTE.roof;
      g.beginPath(); g.arc(w * hx, h * hy, h * 0.025, Math.PI, 0); g.fill();
      dab(g, w * hx, h * (hy - 0.005), h * 0.04, h * 0.04, 0, PALETTE.sun, 0.78, false, false);
    }

    paintRollingHill(g, w, h, 0.86, 0.04, 1.5, 2.2, PALETTE.coolShadow, rand);
    paintParticles(g, w, h, rand, 24, PALETTE.sun);
    paintWarmVignette(g, w, h, 0.28);
    addGrain(g, 0.028, seed, false);
    return canvas;
  },
});

// 3. story.beat2: 'Dreams fall' — glowing fragments drifting down hills, sky shifting to rose
register('story.beat2', {
  size: [1280, 720], tile: false, space: 'srgb', kind: 'story',
  usage: 'Intro Beat 2 painting: glowing dream fragments drifting down hills under rose sky',
  baseColor: PALETTE.crownBlush,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    paintSky(g, w, h, TIME_KEYFRAMES[1]); // rose
    paintSun(g, w, h, 0.52, 0.34, 0.075, PALETTE.crownBlush);

    paintRollingHill(g, w, h, 0.64, 0.08, 1.5, 0.2, '#BC8FA5', rand);
    paintRollingHill(g, w, h, 0.73, 0.07, 1.7, 1.9, '#766F93', rand);
    paintRollingHill(g, w, h, 0.83, 0.06, 1.4, 3.0, PALETTE.cavernIndigo, rand);

    // Falling glowing dream fragments with soft trails
    const frags = [
      [0.24, 0.28, PALETTE.marsh],
      [0.42, 0.42, PALETTE.forestAmber],
      [0.64, 0.36, PALETTE.cavernTeal],
      [0.78, 0.52, PALETTE.crownBlush],
      [0.52, 0.62, PALETTE.sun],
    ];
    for (const [fx, fy, col] of frags) {
      g.strokeStyle = rgba(col, 0.42);
      g.lineWidth = h * 0.008;
      g.beginPath();
      g.moveTo(w * (fx - 0.08), h * (fy - 0.16));
      g.quadraticCurveTo(w * (fx - 0.03), h * (fy - 0.06), w * fx, h * fy);
      g.stroke();
      dab(g, w * fx, h * fy, h * 0.07, h * 0.07, 0, col, 0.68, false, false);
      dab(g, w * fx, h * fy, h * 0.025, h * 0.025, 0, PALETTE.brightest, 0.95, false, false);
    }

    paintParticles(g, w, h, rand, 36, PALETTE.brightest);
    paintWarmVignette(g, w, h, 0.28);
    addGrain(g, 0.028, seed, false);
    return canvas;
  },
});

// 4. story.beat3: 'Pip sets out' — tiny Pip with leaf lantern on ridge looking toward distant dawn head
register('story.beat3', {
  size: [1280, 720], tile: false, space: 'srgb', kind: 'story',
  usage: 'Intro Beat 3 painting: tiny Pip with lantern on ridge facing distant dawn head',
  baseColor: PALETTE.peach,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    paintSky(g, w, h, TIME_KEYFRAMES[3]); // peach
    paintSun(g, w, h, 0.82, 0.46, 0.095, PALETTE.sun);

    paintRollingHill(g, w, h, 0.58, 0.08, 1.2, 0.5, '#D7A9A1', rand);
    paintRollingHill(g, w, h, 0.68, 0.07, 1.5, 2.0, '#8A987F', rand);
    paintRollingHill(g, w, h, 0.78, 0.06, 1.3, 0.9, PALETTE.coolShadow, rand);

    // Foreground ridge on left with Pip + lantern looking right toward distant dawn
    g.fillStyle = PALETTE.ink;
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, h * 0.64);
    g.quadraticCurveTo(w * 0.24, h * 0.66, w * 0.44, h);
    g.closePath();
    g.fill();

    paintPipWithLantern(g, w * 0.20, h * 0.68, h * 0.055);
    paintParticles(g, w, h, rand, 28, PALETTE.sun);
    paintWarmVignette(g, w, h, 0.26);
    addGrain(g, 0.028, seed, false);
    return canvas;
  },
});

// 5. story.lose: cream wash, soft swaying swirls, small sleepy-eyelid motif (gentle, nothing dark)
register('story.lose', {
  size: [1280, 720], tile: false, space: 'srgb', kind: 'story',
  usage: 'Gentle cream wash lose card with swaying swirls and sleepy-eyelid motif',
  baseColor: PALETTE.paper,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, PALETTE.paper);
    grad.addColorStop(0.55, PALETTE.cream);
    grad.addColorStop(1.0, '#EFE0C4');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    for (let i = 0; i < 24; i++) {
      dab(g, rand() * w, rand() * h, w * 0.16, h * 0.14, rand(), i % 2 === 0 ? PALETTE.crownBlush : PALETTE.marshMist, 0.08, false, false);
    }
    // Soft swaying lullaby swirl lines
    g.strokeStyle = rgba(PALETTE.stone, 0.38);
    g.lineWidth = h * 0.005;
    for (let s = 0; s < 5; s++) {
      g.beginPath();
      const yBase = h * (0.2 + s * 0.16);
      for (let k = 0; k <= 24; k++) {
        const u = k / 24;
        const y = yBase + Math.sin(u * Math.PI * 3 + s) * h * 0.04;
        if (k === 0) g.moveTo(u * w, y); else g.lineTo(u * w, y);
      }
      g.stroke();
    }
    // Small sleepy-eyelid motif centered near top
    const cx = w * 0.5, cy = h * 0.26;
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = h * 0.007;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, h * 0.08, 0.25, Math.PI - 0.25);
    g.stroke();
    for (let l = -2; l <= 2; l++) {
      const a = Math.PI * 0.5 + l * 0.34;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * h * 0.08, cy + Math.sin(a) * h * 0.08);
      g.lineTo(cx + Math.cos(a) * h * 0.115, cy + Math.sin(a) * h * 0.115);
      g.stroke();
    }

    addGrain(g, 0.028, seed, false);
    return canvas;
  },
});

// 6. story.ending: dawn pink-gold sky, flowers across hills, tiny Pip+lantern, soft sunburst
register('story.ending', {
  size: [1280, 720], tile: false, space: 'srgb', kind: 'story',
  usage: 'Ending storybook painting: dawn pink-gold sky, flower hills, Pip silhouette, sunburst',
  baseColor: PALETTE.crownBlush,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    paintSky(g, w, h, TIME_KEYFRAMES[4]); // dawn
    paintSun(g, w, h, 0.50, 0.42, 0.11, PALETTE.crownGold);

    // Soft sunburst rays
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.save();
      g.translate(w * 0.5, h * 0.42);
      g.rotate(a);
      g.fillStyle = rgba(PALETTE.brightest, 0.12);
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(w * 0.65, -h * 0.04); g.lineTo(w * 0.65, h * 0.04); g.closePath();
      g.fill();
      g.restore();
    }

    paintRollingHill(g, w, h, 0.62, 0.07, 1.3, 0.3, '#E8BBC5', rand);
    paintRollingHill(g, w, h, 0.72, 0.07, 1.6, 2.2, PALETTE.marsh, rand);
    paintRollingHill(g, w, h, 0.82, 0.06, 1.4, 0.8, PALETTE.hubMeadow, rand);

    // Blooming flower specks across foreground hills
    const flCols = [PALETTE.crownBlush, PALETTE.brightest, PALETTE.sun, PALETTE.crownPearl];
    for (let i = 0; i < 120; i++) {
      const fx = rand() * w, fy = h * (0.74 + rand() * 0.25);
      dab(g, fx, fy, h * 0.01, h * 0.01, 0, flCols[(rand() * flCols.length) | 0], 0.85, false, false);
    }

    paintPipWithLantern(g, w * 0.48, h * 0.82, h * 0.048);
    paintParticles(g, w, h, rand, 45, PALETTE.brightest);
    paintWarmVignette(g, w, h, 0.20);
    addGrain(g, 0.025, seed, false);
    return canvas;
  },
});

// 7. story.credits (720x2160 tall: night-to-dawn gradient with sprigs & tiny stars)
register('story.credits', {
  size: [720, 2160], tile: false, space: 'srgb', kind: 'story',
  usage: 'Tall scrolling credits backdrop (lavender dusk to crown dawn with stars & sprigs)',
  baseColor: PALETTE.cavernIndigo,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, PALETTE.cavernIndigo);
    grad.addColorStop(0.32, '#6E70B0');
    grad.addColorStop(0.62, '#C98FB5');
    grad.addColorStop(0.84, PALETTE.crownBlush);
    grad.addColorStop(1.0, '#FFE7B0');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // Tiny soft stars in the upper dusk two-thirds
    for (let i = 0; i < 90; i++) {
      const x = rand() * w, y = rand() * h * 0.68;
      const r = (1.5 + rand() * 2.5) * (w / 720);
      dab(g, x, y, r * 2.5, r * 2.5, 0, PALETTE.brightest, 0.35 + rand() * 0.5, false, false);
    }
    // Delicate floating botanical sprigs down the sides
    for (let s = 0; s < 10; s++) {
      const side = s % 2 === 0 ? 0.14 : 0.86;
      const sy = h * (0.12 + s * 0.085);
      dab(g, w * side, sy, w * 0.08, w * 0.04, (s % 2 === 0 ? -0.4 : 0.4), PALETTE.brightest, 0.22, false, false);
    }
    addGrain(g, 0.025, seed, false);
    return canvas;
  },
});

// 8. story.pause (1280x720: warm paper veil with soft blur feel)
register('story.pause', {
  size: [1280, 720], tile: false, space: 'srgb', kind: 'story',
  usage: 'Warm soft paper veil backdrop for the pause menu',
  baseColor: PALETTE.paper,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const grad = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.1, w * 0.5, h * 0.5, w * 0.68);
    grad.addColorStop(0.0, rgba(PALETTE.paper, 0.86));
    grad.addColorStop(0.7, rgba(PALETTE.cream, 0.90));
    grad.addColorStop(1.0, rgba(PALETTE.stoneLight, 0.94));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      dab(g, rand() * w, rand() * h, w * 0.2, h * 0.2, rand(), i % 2 === 0 ? PALETTE.sun : PALETTE.peach, 0.06, false, false);
    }
    addGrain(g, 0.028, seed, false);
    return canvas;
  },
});

// 9. story.page (1280x720: storybook page frame with leaf border, corner flourishes, page-curl shadow)
register('story.page', {
  size: [1280, 720], tile: false, space: 'srgb', kind: 'story',
  usage: 'Storybook lore page frame with paper, corner flourishes and soft page-curl shadow',
  baseColor: PALETTE.paper,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    g.fillStyle = PALETTE.paper;
    g.fillRect(0, 0, w, h);

    // Soft center book-gutter & right page-curl shadow
    const curl = g.createLinearGradient(0, 0, w, 0);
    curl.addColorStop(0.0, rgba(PALETTE.ink, 0.12));
    curl.addColorStop(0.06, rgba(PALETTE.ink, 0.0));
    curl.addColorStop(0.92, rgba(PALETTE.ink, 0.0));
    curl.addColorStop(1.0, rgba(PALETTE.ink, 0.16));
    g.fillStyle = curl;
    g.fillRect(0, 0, w, h);

    // Double ink storybook frame
    const mx = w * 0.045, my = h * 0.065;
    g.strokeStyle = rgba(PALETTE.ink, 0.55);
    g.lineWidth = Math.max(2, h * 0.004);
    g.strokeRect(mx, my, w - mx * 2, h - my * 2);
    g.strokeStyle = rgba(PALETTE.stone, 0.45);
    g.strokeRect(mx + 8, my + 8, w - (mx + 8) * 2, h - (my + 8) * 2);

    // Corner golden-leaf flourishes
    for (const [cx, cy] of [[mx, my], [w - mx, my], [mx, h - my], [w - mx, h - my]]) {
      dab(g, cx, cy, h * 0.045, h * 0.045, 0, PALETTE.sun, 0.45, false, false);
      g.fillStyle = PALETTE.ink;
      g.beginPath(); g.arc(cx, cy, h * 0.01, 0, Math.PI * 2); g.fill();
    }
    addGrain(g, 0.028, seed, false);
    return canvas;
  },
});

// 10. story.divider (512x64 alpha flourish strip)
register('story.divider', {
  size: [512, 64], tile: false, space: 'srgb', kind: 'story',
  usage: 'Storybook horizontal ink-and-leaf divider flourish strip',
  baseColor: PALETTE.ink,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = Math.max(1.8, h * 0.05);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.06, cy);
    g.quadraticCurveTo(w * 0.28, cy - h * 0.14, cx - w * 0.05, cy);
    g.moveTo(cx + w * 0.05, cy);
    g.quadraticCurveTo(w * 0.72, cy + h * 0.14, w * 0.94, cy);
    g.stroke();

    // Central diamond & twin leaf buds
    g.fillStyle = PALETTE.forestAmber;
    g.beginPath();
    g.moveTo(cx, cy - h * 0.24); g.lineTo(cx + w * 0.028, cy);
    g.lineTo(cx, cy + h * 0.24); g.lineTo(cx - w * 0.028, cy);
    g.closePath();
    g.fill();
    g.stroke();
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 11. story.dropcap (128x128 alpha leaf-sprig motif)
register('story.dropcap', {
  size: 128, tile: false, space: 'srgb', kind: 'story',
  usage: 'Storybook illuminated dropcap leaf-sprig backdrop motif',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);
    dab(g, cx, cy, w * 0.42, h * 0.42, 0, PALETTE.sun, 0.36, false, false);
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = w * 0.025;
    g.beginPath(); g.arc(cx, cy, w * 0.38, 0, Math.PI * 2); g.stroke();
    g.fillStyle = PALETTE.marsh;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * w * 0.36, cy + Math.sin(a) * h * 0.36, w * 0.08, h * 0.045, a + 0.5, 0, Math.PI * 2);
      g.fill();
    }
    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});
