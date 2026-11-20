/**
 * Dreamback — Unified Texture & Real CC0 Asset Bridge (M1 + Poly Haven CC0 PBR & glTF)
 * Loads BOTH:
 *  1) Our 148-texture procedural storybook kit (src/tex/registry.js)
 *  2) Real CC0 Poly Haven PBR Diffuse/Normal/Roughness textures (assets/pbr/*.jpg)
 *  3) Real CC0 Poly Haven 3D glTF models (assets/models/<name>/*.gltf) via GLTFLoader
 * Every external/local asset load is wrapped in try/catch with instant procedural/primitive fallback.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  initTextures,
  tex,
  mat,
  css,
  sprite,
  manifest,
  UI_TOKENS,
  STORY_TOKENS,
  PIP_COLORS,
  TIME_KEYFRAMES,
  PALETTE,
  mapRegionWash,
  mapPaths,
  DEFAULT_WORLD_REGIONS,
} from './tex/registry.js';
import { CONFIG } from './data.js';

const params = new URLSearchParams(window.location.search);
let enabled = CONFIG.textures.enabled && params.get('notex') !== '1';
let ready = false;
const requestedIds = new Set();
const missingIds = new Set();
let catalogIds = new Set();

// Real CC0 Poly Haven PBR texture cache & 3D glTF model cache
const pbrTextures = new Map(); // `${key}_${chan}` -> THREE.Texture
const gltfModels = new Map();  // key -> THREE.Object3D template
const pbrMatCache = new Map();

const PBR_KEYS = ['stone', 'wood', 'grass', 'bark', 'plaster', 'rock', 'cobble', 'marble', 'leaves', 'roof', 'moss', 'cliff', 'meadow'];
const MODEL_FILES = {
  boulder: './assets/models/boulder/boulder_01_1k.gltf',
  lantern: './assets/models/lantern/Lantern_01_1k.gltf',
  barrel: './assets/models/barrel/Barrel_01_1k.gltf',
  log: './assets/models/fern/dead_tree_trunk_1k.gltf',
};

export function isTexturesEnabled() {
  return enabled && ready;
}

function loadImageTexture(loader, url, isColor) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        t.generateMipmaps = true;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function loadGltfModel(loader, url) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              // Warm cozy Tiny-Glade tonal harmony on realistic meshes
              if (child.material.roughness !== undefined) {
                child.material.roughness = Math.max(0.45, child.material.roughness);
              }
            }
          }
        });
        resolve(root);
      },
      undefined,
      () => resolve(null)
    );
  });
}

export async function initBridge(onProgress) {
  catalogIds = new Set(manifest().map((m) => m.id));
  if (!enabled) {
    console.info('[Dreamback TexBridge] Textures disabled (?notex=1). Using flat fallback materials.');
    if (onProgress) onProgress(1);
    return { enabled: false, summary: null };
  }

  const quality = params.get('quality') || CONFIG.textures.quality || 'auto';
  const seed = parseInt(params.get('seed'), 10) || CONFIG.textures.seed || 1337;

  // 1. Load procedural storybook kit (0..55% progress)
  let summary = null;
  try {
    const initPromise = initTextures({
      quality,
      seed,
      qa: false,
      yieldBatch: 12,
      onProgress: (p) => { if (onProgress) onProgress(p.progress * 0.55); },
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Texture kit timeout (${CONFIG.textures.timeoutMs}ms)`)), CONFIG.textures.timeoutMs)
    );
    summary = await Promise.race([initPromise, timeoutPromise]);
    ready = true;
  } catch (err) {
    console.warn('[Dreamback TexBridge] Procedural kit init failed, continuing with fallbacks:', err);
    enabled = false;
    ready = false;
    if (onProgress) onProgress(1);
    return { enabled: false, summary: null, error: err };
  }

  // 2. Load real CC0 Poly Haven PBR textures & 3D glTF models in parallel (55..100% progress)
  try {
    const texLoader = new THREE.TextureLoader();
    const gltfLoader = new GLTFLoader();

    const tasks = [];
    let doneCount = 0;
    const totalTasks = PBR_KEYS.length * 3 + Object.keys(MODEL_FILES).length;
    const bump = () => {
      doneCount++;
      if (onProgress) onProgress(0.55 + (doneCount / totalTasks) * 0.45);
    };

    for (const key of PBR_KEYS) {
      for (const [chan, isColor] of [['diff', true], ['nor', false], ['rough', false]]) {
        const url = `./assets/pbr/${key}_${chan}.jpg`;
        tasks.push(
          loadImageTexture(texLoader, url, isColor).then((t) => {
            if (t) pbrTextures.set(`${key}_${chan}`, t);
            bump();
          })
        );
      }
    }

    for (const [mKey, url] of Object.entries(MODEL_FILES)) {
      tasks.push(
        loadGltfModel(gltfLoader, url).then((sceneRoot) => {
          if (sceneRoot) gltfModels.set(mKey, sceneRoot);
          bump();
        })
      );
    }

    await Promise.race([
      Promise.all(tasks),
      new Promise((resolve) => setTimeout(resolve, 6500)),
    ]);

    console.info(
      `[Dreamback TexBridge] Loaded ${pbrTextures.size} CC0 PBR maps & ${gltfModels.size} CC0 glTF 3D models + ${summary.count} procedural maps.`
    );
  } catch (err) {
    console.warn('[Dreamback TexBridge] Real asset preload partial fallback:', err);
  }

  if (onProgress) onProgress(1);
  return { enabled: true, summary, pbrCount: pbrTextures.size, modelCount: gltfModels.size };
}

function track(id) {
  requestedIds.add(id);
  if (catalogIds.size > 0 && !catalogIds.has(id)) missingIds.add(id);
}

export function getRealPbrTex(key, chan = 'diff') {
  if (!enabled || !ready) return null;
  return pbrTextures.get(`${key}_${chan}`) || null;
}

/**
 * Build a warm, cozy Tiny-Glade-harmonized PBR material combining real Poly Haven CC0
 * Diffuse + Normal + Roughness maps (with automatic fallback to our procedural kit).
 */
export function getRealPbrMat(key, opts = {}) {
  const {
    fallbackId = 'build.stone',
    tint = '#FFF4E4',
    repeatX = 1,
    repeatY = repeatX,
    normalScale = 0.85,
    roughness = 0.92,
    metalness = 0.0,
    flatShading = false,
  } = opts;

  const cacheKey = `${key}_${tint}_${repeatX}_${repeatY}_${normalScale}_${flatShading}`;
  if (pbrMatCache.has(cacheKey)) return pbrMatCache.get(cacheKey);

  const diff = getRealPbrTex(key, 'diff');
  const nor = getRealPbrTex(key, 'nor');
  const rough = getRealPbrTex(key, 'rough');

  if (!diff || !enabled || !ready) {
    const fb = getMat(fallbackId, new THREE.MeshStandardMaterial({ color: tint, roughness, flatShading }));
    pbrMatCache.set(cacheKey, fb);
    return fb;
  }

  const cloneRep = (t) => {
    if (!t) return null;
    if (repeatX === 1 && repeatY === 1) return t;
    const c = t.clone();
    c.repeat.set(repeatX, repeatY);
    c.needsUpdate = true;
    return c;
  };

  const m = new THREE.MeshStandardMaterial({
    map: cloneRep(diff),
    normalMap: cloneRep(nor),
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: cloneRep(rough),
    color: new THREE.Color(tint),
    roughness,
    metalness,
    flatShading,
  });
  pbrMatCache.set(cacheKey, m);
  return m;
}

/**
 * Clone a loaded CC0 Poly Haven 3D glTF model (returns null if unavailable so caller uses primitive fallback).
 */
export function cloneModel(key) {
  const template = gltfModels.get(key);
  if (!template) return null;
  return template.clone(true);
}

export function getTex(id) {
  track(id);
  if (!enabled || !ready) return null;
  try { return tex(id); } catch { return null; }
}

export function getMat(id, fallbackMaterial, over = null) {
  track(id);
  if (!enabled || !ready) return fallbackMaterial;
  try { return mat(id, over); } catch { return fallbackMaterial; }
}

export function getSprite(id, fallbackColor = '#FFC77A', additive = true) {
  track(id);
  if (!enabled || !ready) {
    return new THREE.SpriteMaterial({
      color: fallbackColor,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  }
  try { return sprite(id); } catch {
    return new THREE.SpriteMaterial({ color: fallbackColor, transparent: true, opacity: 0.7 });
  }
}

export function getCss(id) {
  track(id);
  if (!enabled || !ready) return '';
  try { return css(id); } catch { return ''; }
}

export function getTokens() {
  return { ui: UI_TOKENS, story: STORY_TOKENS, pip: PIP_COLORS, keyframes: TIME_KEYFRAMES, palette: PALETTE };
}

export function getMapHelpers() {
  return { mapRegionWash, mapPaths, regions: DEFAULT_WORLD_REGIONS };
}

export function printUsageReport() {
  const unused = Array.from(catalogIds).filter((id) => !requestedIds.has(id));
  const missing = Array.from(missingIds);
  console.info(
    `[Dreamback TexBridge] Assets ready — Procedural used: ${requestedIds.size} (missing: ${missing.length}), CC0 PBR maps: ${pbrTextures.size}, CC0 glTF models: ${gltfModels.size}.`
  );
  return { used: Array.from(requestedIds), missing, unused, pbrCount: pbrTextures.size, modelCount: gltfModels.size };
}
