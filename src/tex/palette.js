/**
 * Dreamback Texture Kit — Palette, Pip Final Colors & 5 Time-of-Day Keyframes (T0)
 * Strict storybook gamut: darkest #1F2A2E (shadows #2C4A47), brightest #FFF4DC.
 */

export const PALETTE = Object.freeze({
  // Bounds & shadow anchors (no pure black or white)
  darkest: '#1F2A2E',
  brightest: '#FFF4DC',
  coolShadow: '#2C4A47',

  // Shared / storybook village
  sun: '#FFC77A',
  peach: '#FFB88A',
  cream: '#F4E9CD',
  paper: '#FBF1DC',
  ink: '#4A3B2A',
  stone: '#B79A74',
  stoneDark: '#A38860',
  stoneLight: '#C9B28C',
  mortar: '#8C7556',
  roof: '#6B4A2B',
  roofLight: '#7D5A36',
  roofDark: '#5A3E24',
  plank: '#8A6A44',

  // Marshes
  marsh: '#8FBF8F',
  marshDark: '#6E9F6A',
  marshHollow: '#5A8A62',
  marshLight: '#B7D6A0',
  marshMist: '#CFE8DC',
  hubMeadow: '#5E8F4A',
  hubGold: '#D5CC85',

  // Forest
  forestAmber: '#D9A441',
  forestHoney: '#E8C06A',
  forestOlive: '#6B7F3A',
  forestBrown: '#7A5A33',
  forestGoldLight: '#F2D9A0',

  // Caverns
  cavernIndigo: '#3B3F7A',
  cavernMid: '#5560A8',
  cavernFloor: '#2B2F5E',
  cavernTeal: '#4FD1C5',
  cavernRose: '#E27BB1',

  // Crown
  crownPearl: '#F5F0EA',
  crownBlush: '#F6B8C8',
  crownGold: '#F2C879',
  crownCool: '#D9D4E6',

  // Water & paths
  waterLight: '#6FC7BE',
  waterDeep: '#3E9C9C',
  dirt: '#C9A777',
  cliffLight: '#A89880',
  cliffDark: '#8C7C68',
  lichen: '#9DB57A',

  // Characters (Pip, Grandma, Bramble, Pebble, Puff, Giant)
  pipRusset: '#C8643B',
  pipLight: '#E08A5A',
  pipBelly: '#F4E9CD',
  pipLeaf: '#6E9F6A',
  pipBulb: '#FFC77A',
  puffShadow: '#D9C7A3',
  puffMuzzle: '#7A6A5A',
  butterflyGold: '#FFC46B',
});

/**
 * Handoff item #5: Pip's final colors so Workspace A (the game) can match untextured fallbacks.
 */
export const PIP_COLORS = Object.freeze({
  shellBase: '#C8643B',
  shellHighlight: '#E08A5A',
  belly: '#F4E9CD',
  eyeDark: '#2C4A47',
  eyeSpark: '#FFF4DC',
  leafBase: '#6E9F6A',
  leafHighlight: '#B7D6A0',
  bulbEmissive: '#FFC77A',
  bulbCore: '#FFF4DC',
});

/**
 * Five Time-of-Day keyframes (T0 & T6).
 * Order: golden -> rose -> lavender -> peach -> dawn.
 */
export const TIME_KEYFRAMES = Object.freeze([
  Object.freeze({
    id: 'golden',
    label: 'Golden Hour',
    zenith: '#7C86C0',
    mid: '#F2A58E',
    horizon: '#FFD9A0',
    sunColor: '#FFC77A',
    sunElevationDeg: 15,
    fogTint: '#F2C49A',
    gradeStrength: 0.35,
  }),
  Object.freeze({
    id: 'rose',
    label: 'Rose Dusk',
    zenith: '#8C7FBF',
    mid: '#F29AA0',
    horizon: '#FFC9A6',
    sunColor: '#FFB88A',
    sunElevationDeg: 12,
    fogTint: '#E9AEAE',
    gradeStrength: 0.42,
  }),
  Object.freeze({
    id: 'lavender',
    label: 'Lavender Blue Hour',
    zenith: '#6E70B0',
    mid: '#C98FB5',
    horizon: '#F2B7B0',
    sunColor: '#F6B8C8',
    sunElevationDeg: 8,
    fogTint: '#B998C2',
    gradeStrength: 0.50,
  }),
  Object.freeze({
    id: 'peach',
    label: 'Peach Glow',
    zenith: '#8E86C4',
    mid: '#F5B39A',
    horizon: '#FFE0B8',
    sunColor: '#FFD194',
    sunElevationDeg: 14,
    fogTint: '#F4C9A8',
    gradeStrength: 0.36,
  }),
  Object.freeze({
    id: 'dawn',
    label: 'Crown Dawn',
    zenith: '#A9A8D6',
    mid: '#F6B8C8',
    horizon: '#FFE7B0',
    sunColor: '#FFE0A6',
    sunElevationDeg: 18,
    fogTint: '#F5D6CE',
    gradeStrength: 0.30,
  }),
]);

export function hexToRgb(hex) {
  const c = String(hex).replace('#', '');
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function mixRgb(a, b, t) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function mixHex(hexA, hexB, t) {
  const [r, g, b] = mixRgb(hexToRgb(hexA), hexToRgb(hexB), t);
  return rgbToHex(r, g, b);
}

export function shiftHexHue(hex, delta) {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 + delta;
  return rgbToHex(r * f, g * (1 + delta * 0.85), b * (1 + delta * 0.65));
}

export function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const DARKEST_RGB = hexToRgb(PALETTE.darkest);
export const BRIGHTEST_RGB = hexToRgb(PALETTE.brightest);
export const COOL_SHADOW_RGB = hexToRgb(PALETTE.coolShadow);
const MIN_LUMA = luma(DARKEST_RGB[0], DARKEST_RGB[1], DARKEST_RGB[2]); // ~39.3
const MAX_LUMA = luma(BRIGHTEST_RGB[0], BRIGHTEST_RGB[1], BRIGHTEST_RGB[2]); // ~244.6

/**
 * Clamp RGB gently into the Dreamback storybook gamut (#1F2A2E .. #FFF4DC).
 * Guarantees zero pure black (#000000) and zero pure white (#FFFFFF).
 */
export function clampGamut(r, g, b, out, off) {
  let cr = r < 0 ? 0 : r > 255 ? 255 : r;
  let cg = g < 0 ? 0 : g > 255 ? 255 : g;
  let cb = b < 0 ? 0 : b > 255 ? 255 : b;

  const L = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
  if (L < MIN_LUMA) {
    const k = Math.min(1, (MIN_LUMA - L) / Math.max(1, MIN_LUMA) * 0.9 + 0.15);
    cr += (DARKEST_RGB[0] - cr) * k;
    cg += (DARKEST_RGB[1] - cg) * k;
    cb += (DARKEST_RGB[2] - cb) * k;
  } else if (L > MAX_LUMA) {
    const k = Math.min(1, (L - MAX_LUMA) / Math.max(1, 255 - MAX_LUMA) * 0.9 + 0.15);
    cr += (BRIGHTEST_RGB[0] - cr) * k;
    cg += (BRIGHTEST_RGB[1] - cg) * k;
    cb += (BRIGHTEST_RGB[2] - cb) * k;
  }

  // Hard guard against pure black or pure white triads
  if (cr < 24 && cg < 34 && cb < 38) {
    cr = Math.max(cr, DARKEST_RGB[0]);
    cg = Math.max(cg, DARKEST_RGB[1]);
    cb = Math.max(cb, DARKEST_RGB[2]);
  }
  if (cr > 250 && cg > 246 && cb > 235) {
    cr = Math.min(cr, BRIGHTEST_RGB[0]);
    cg = Math.min(cg, BRIGHTEST_RGB[1]);
    cb = Math.min(cb, BRIGHTEST_RGB[2]);
  }

  out[off] = cr;
  out[off + 1] = cg;
  out[off + 2] = cb;
}
