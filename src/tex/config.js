/**
 * Dreamback Texture Kit — Configuration, Quality Tiers & Texel Density Table (T0 + T9)
 */

export const DEFAULT_SEED = 1337;

export const QUALITY_TIERS = Object.freeze({
  high: Object.freeze({
    id: 'high',
    label: 'High',
    tileScale: 1.0,
    spriteScale: 1.0,
    storySize: [1280, 720],
    creditsSize: [720, 2160],
    dabMult: 0.62,
    anisotropy: 4,
    memoryBudgetMb: 96,
    timeBudgetMs: 3000,
  }),
  medium: Object.freeze({
    id: 'medium',
    label: 'Medium',
    tileScale: 0.5,
    spriteScale: 0.5,
    storySize: [960, 540],
    creditsSize: [540, 1620],
    dabMult: 0.48,
    anisotropy: 4,
    memoryBudgetMb: 48,
    timeBudgetMs: 2000,
  }),
  low: Object.freeze({
    id: 'low',
    label: 'Low',
    tileScale: 0.25,
    spriteScale: 0.25,
    storySize: [640, 360],
    creditsSize: [360, 1080],
    dabMult: 0.30,
    anisotropy: 2,
    memoryBudgetMb: 32,
    timeBudgetMs: 1500,
  }),
});

export function resolveQuality(quality = 'high') {
  if (quality === 'auto') {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const mem = typeof navigator !== 'undefined' ? navigator.deviceMemory || 8 : 8;
    if (mem <= 2) return QUALITY_TIERS.low;
    if (mem <= 4 || dpr < 1) return QUALITY_TIERS.medium;
    return QUALITY_TIERS.high;
  }
  return QUALITY_TIERS[quality] || QUALITY_TIERS.high;
}

/**
 * Scale a [w, h] texture dimension by quality tier while keeping power-of-two sizes
 * (or exact aspect-ratio dimensions for non-POT story pages & LUT strips).
 */
export function scaleSize(baseSize, kind, tier) {
  const [bw, bh] = Array.isArray(baseSize) ? baseSize : [baseSize, baseSize];
  if (kind === 'lut') return [bw, bh]; // LUT strips never downscale
  if (kind === 'story') {
    if (bw === 720 && bh === 2160) return [...tier.creditsSize];
    if (bw === 1280 && bh === 720) return [...tier.storySize];
    const s = tier.storySize[0] / 1280;
    return [Math.max(32, Math.round(bw * s)), Math.max(16, Math.round(bh * s))];
  }
  const mult = kind === 'sprite' || kind === 'fx' ? tier.spriteScale : tier.tileScale;
  const minDim = kind === 'ui' ? 32 : 32;
  const sw = bw <= 16 ? bw : Math.max(minDim, Math.round(bw * mult));
  const sh = bh <= 16 ? bh : Math.max(minDim, Math.round(bh * mult));
  return [sw, sh];
}

/**
 * T9 Texel Density Table — World-unit repeat period per texture id or prefix.
 * Workspace A uses these values to sample world-space UVs (rest-pose XZ / repeat).
 */
export const TEXEL_DENSITY = Object.freeze({
  'land.*': 8,
  'land.marsh': 8,
  'land.hub': 8,
  'land.forest': 8,
  'land.cavern': 8,
  'land.cavern.rough': 8,
  'land.crown': 8,
  'land.cliff': 8,
  'land.scales': 40,
  'land.scales.normal': 40,
  'land.macro': 600, // Full 600x200 world extent
  'path.dirt': 6,
  'path.dirt.strip': 6,
  'path.cobble': 4,
  'path.steps': 4,
  'shore.mud': 6,
  'water.pool': 6,
  'water.foam': 4,
  'ground.moss': 6,
  'build.stone': 4,
  'build.stone.normal': 4,
  'build.stone.ruin': 4,
  'build.stone.arch': 4,
  'build.roof': 3,
  'build.roof.moss': 3,
  'build.plaster': 4,
  'build.plank': 2,
  'build.plank.painted': 2,
  'build.log': 2,
  'build.rope': 1,
  'build.barrel': 1.5,
  'build.trim': 2,
  'build.gate': 4,
  'build.rib': 4,
  'nature.bark': 3,
  'nature.bark.pale': 3,
  'nature.canopy': 4,
  'nature.clover': 2,
  'nature.pebble': 1.5,
  'char.puff.wool': 1.5,
  'char.grandma.shawl': 1,
  'sky.clouds': 120,
  'sky.cloudshadow': 90,
});

export function getWorldRepeat(id) {
  if (id in TEXEL_DENSITY) return TEXEL_DENSITY[id];
  const prefix = `${id.split('.')[0]}.*`;
  if (prefix in TEXEL_DENSITY) return TEXEL_DENSITY[prefix];
  return 1;
}
