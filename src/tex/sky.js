/**
 * Dreamback Texture Kit — T6: Sky, Atmosphere and Grade (11 ids)
 */

import { register } from './store.js';
import { PALETTE, TIME_KEYFRAMES, hexToRgb, mixRgb } from './palette.js';
import {
  rng,
  fbm,
  domainWarp,
  smoothstep,
  makeCanvas,
  dab,
  finishSurface,
  dilateAlphaEdges,
} from './core.js';

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// 1. sky.lut (5x256, NOT tiling: 1 column per keyframe, zenith top -> horizon bottom)
register('sky.lut', {
  size: [5, 256], tile: false, space: 'srgb', kind: 'lut',
  usage: '5-column sky gradient LUT (golden, rose, lavender, peach, dawn; zenith->horizon)',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const img = g.createImageData(w, h);
    const d = img.data;

    for (let x = 0; x < w; x++) {
      const kf = TIME_KEYFRAMES[Math.min(TIME_KEYFRAMES.length - 1, Math.floor((x / w) * TIME_KEYFRAMES.length))];
      const z = hexToRgb(kf.zenith);
      const m = hexToRgb(kf.mid);
      const hz = hexToRgb(kf.horizon);

      for (let y = 0; y < h; y++) {
        const t = y / (h - 1); // 0 = zenith, 1 = horizon
        let rgb;
        if (t < 0.52) {
          const k = smoothstep(0, 0.52, t);
          rgb = mixRgb(z, m, k);
        } else {
          const k = smoothstep(0.52, 1.0, t);
          rgb = mixRgb(m, hz, k);
        }
        const p = (y * w + x) * 4;
        d[p] = rgb[0]; d[p + 1] = rgb[1]; d[p + 2] = rgb[2]; d[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return canvas;
  },
});

// 2. sky.clouds (512 tile, grayscale mask)
register('sky.clouds', {
  size: 512, tile: true, space: 'linear', kind: 'data',
  usage: 'Stretched soft fBm cloud band mask (grayscale, tinted in shader)',
  baseColor: '#b0b0b0',
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const f = domainWarp(w, h, { scaleX: 2, scaleY: 6, octaves: 4, warpAmp: 0.25, seed });
    const img = g.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < f.length; i++) {
      const v = Math.round(smoothstep(0.32, 0.78, f[i]) * 235 + 10);
      const p = i * 4;
      d[p] = v; d[p + 1] = v; d[p + 2] = v; d[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvas;
  },
});

// 3. sky.cloudshadow (512 tile, grayscale range 0.75..1.0)
register('sky.cloudshadow', {
  size: 512, tile: true, space: 'linear', kind: 'data',
  usage: 'Large soft cloud shadow blotches for terrain lighting (0.75..1.0)',
  baseColor: '#e0e0e0',
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const f = fbm(w, h, { scaleX: 3, scaleY: 3, octaves: 3, seed });
    const img = g.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < f.length; i++) {
      const s = 0.75 + smoothstep(0.22, 0.78, f[i]) * 0.25;
      const v = Math.round(s * 255);
      const p = i * 4;
      d[p] = v; d[p + 1] = v; d[p + 2] = v; d[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvas;
  },
});

// 4. sky.sun (512 alpha: sun disc, wide glow, faint horizontal flare)
register('sky.sun', {
  size: 512, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Warm golden sun disc with wide glow and soft horizontal flare',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const cx = w * 0.5, cy = h * 0.5;
    g.clearRect(0, 0, w, h);

    // Wide warm aura
    const aura = g.createRadialGradient(cx, cy, w * 0.04, cx, cy, w * 0.49);
    aura.addColorStop(0.0, rgba(PALETTE.brightest, 1.0));
    aura.addColorStop(0.18, rgba(PALETTE.brightest, 0.92));
    aura.addColorStop(0.32, rgba(PALETTE.sun, 0.56));
    aura.addColorStop(0.65, rgba(PALETTE.peach, 0.18));
    aura.addColorStop(1.0, rgba(PALETTE.peach, 0.0));
    g.fillStyle = aura;
    g.fillRect(0, 0, w, h);

    // Faint warm horizontal flare band
    const flare = g.createLinearGradient(0, cy, w, cy);
    flare.addColorStop(0.0, rgba(PALETTE.sun, 0.0));
    flare.addColorStop(0.5, rgba(PALETTE.brightest, 0.34));
    flare.addColorStop(1.0, rgba(PALETTE.sun, 0.0));
    g.fillStyle = flare;
    g.beginPath();
    g.ellipse(cx, cy, w * 0.48, h * 0.045, 0, 0, Math.PI * 2);
    g.fill();

    dilateAlphaEdges(canvas, 4);
    return canvas;
  },
});

// 5. sky.stars (1024x512 equirect alpha: sparse soft dots for lavender dusk)
register('sky.stars', {
  size: [1024, 512], tile: false, space: 'srgb', kind: 'sprite',
  usage: 'Sparse soft twilight stars (equirectangular, fades in at lavender dusk)',
  baseColor: PALETTE.brightest,
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    g.clearRect(0, 0, w, h);
    const cols = [PALETTE.brightest, PALETTE.paper, PALETTE.crownBlush, PALETTE.marshMist];
    for (let i = 0; i < 160; i++) {
      const x = rand() * w;
      const y = rand() * h * 0.72; // Upper sky hemisphere
      const r = (1.6 + rand() * 3.2) * (w / 1024);
      dab(g, x, y, r * 2.2, r * 2.2, 0, cols[(rand() * cols.length) | 0], 0.35 + rand() * 0.5, false, false);
    }
    dilateAlphaEdges(canvas, 3);
    return canvas;
  },
});

// 6. sky.horizonhaze (4x256 alpha strip)
register('sky.horizonhaze', {
  size: [4, 256], tile: false, space: 'srgb', kind: 'lut',
  usage: 'Warm golden horizon haze alpha strip',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0.0, rgba(PALETTE.peach, 0.0));
    gr.addColorStop(0.55, rgba(PALETTE.sun, 0.35));
    gr.addColorStop(0.82, rgba(PALETTE.brightest, 0.62));
    gr.addColorStop(1.0, rgba(PALETTE.sun, 0.18));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    dilateAlphaEdges(canvas, 2);
    return canvas;
  },
});

// 7. fog.ground (4x256 alpha strip)
register('fog.ground', {
  size: [4, 256], tile: false, space: 'srgb', kind: 'lut',
  usage: 'Ground-hugging golden meadow haze alpha gradient',
  baseColor: PALETTE.cream,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0.0, rgba(PALETTE.cream, 0.0));
    gr.addColorStop(0.50, rgba(PALETTE.paper, 0.25));
    gr.addColorStop(1.0, rgba(PALETTE.sun, 0.68));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    dilateAlphaEdges(canvas, 2);
    return canvas;
  },
});

// 8 & 9. post.vignette & post.restless (512 alpha)
function paintVignette(w, h, edgeHex, maxAlpha) {
  const { canvas, g } = makeCanvas(w, h);
  const cx = w * 0.5, cy = h * 0.5;
  g.clearRect(0, 0, w, h);
  const gr = g.createRadialGradient(cx, cy, w * 0.26, cx, cy, w * 0.72);
  gr.addColorStop(0.0, rgba(edgeHex, 0.0));
  gr.addColorStop(0.62, rgba(edgeHex, maxAlpha * 0.32));
  gr.addColorStop(1.0, rgba(edgeHex, maxAlpha));
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  dilateAlphaEdges(canvas, 2);
  return canvas;
}

register('post.vignette', {
  size: 512, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Warm storybook radial vignette (#4A3B2A at 35%, never black)',
  baseColor: PALETTE.ink,
  build: (w, h) => paintVignette(w, h, PALETTE.ink, 0.35),
});

register('post.restless', {
  size: 512, tile: false, space: 'srgb', kind: 'fx',
  usage: 'Soft warm-gray vignette variant for high restlessness',
  baseColor: PALETTE.cliffDark,
  build: (w, h) => paintVignette(w, h, PALETTE.cliffDark, 0.45),
});

// 10. post.grain (256 tile: +/- 3% film grain)
register('post.grain', {
  size: 256, tile: true, space: 'linear', kind: 'data',
  usage: 'Subtle tileable +/- 3% storybook film grain overlay',
  baseColor: '#808080',
  build(w, h, seed) {
    const { canvas, g } = makeCanvas(w, h);
    const rand = rng(seed);
    const img = g.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < w * h; i++) {
      // 128 +/- 8 (~3% of 255)
      const v = 128 + Math.round((rand() - 0.5) * 16);
      const p = i * 4;
      d[p] = v; d[p + 1] = v; d[p + 2] = v; d[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvas;
  },
});

// 11. post.grade (256x80: five stacked 256x16 color-grade LUT strips, one per keyframe)
register('post.grade', {
  size: [256, 80], tile: false, space: 'srgb', kind: 'lut',
  usage: 'Five 256x16 color-grade 3D LUT strips (rows 0..4 = golden, rose, lavender, peach, dawn)',
  baseColor: PALETTE.sun,
  build(w, h) {
    const { canvas, g } = makeCanvas(w, h);
    const img = g.createImageData(w, h);
    const d = img.data;
    const tealLift = hexToRgb(PALETTE.coolShadow);

    for (let k = 0; k < 5; k++) {
      const kf = TIME_KEYFRAMES[k];
      const hiTint = hexToRgb(kf.sunColor);
      const str = kf.gradeStrength;
      const yOff = k * 16;

      for (let gy = 0; gy < 16; gy++) {
        const gVal = gy / 15;
        for (let x = 0; x < 256; x++) {
          const bSlice = (x / 16) | 0;
          const rVal = (x % 16) / 15;
          const bVal = bSlice / 15;

          const lum = 0.2126 * rVal + 0.7152 * gVal + 0.0722 * bVal;
          // Mild saturation boost
          let r = lum + (rVal - lum) * 1.12;
          let gr = lum + (gVal - lum) * 1.12;
          let b = lum + (bVal - lum) * 1.12;

          // Teal-lifted shadows & golden-keyframe highlights
          const shW = Math.pow(1 - lum, 2.2) * str * 0.26;
          const hiW = Math.pow(lum, 1.8) * str * 0.22;
          r = r * (1 - shW) + (tealLift[0] / 255) * shW;
          gr = gr * (1 - shW) + (tealLift[1] / 255) * shW;
          b = b * (1 - shW) + (tealLift[2] / 255) * shW;

          r = r * (1 - hiW) + (hiTint[0] / 255) * hiW;
          gr = gr * (1 - hiW) + (hiTint[1] / 255) * hiW;
          b = b * (1 - hiW) + (hiTint[2] / 255) * hiW;

          const p = ((yOff + gy) * w + x) * 4;
          d[p] = Math.max(0, Math.min(255, Math.round(r * 255)));
          d[p + 1] = Math.max(0, Math.min(255, Math.round(gr * 255)));
          d[p + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
          d[p + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    return canvas;
  },
});
