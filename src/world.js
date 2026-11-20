/**
 * Dreamback — Realistic Cozy Tiny-Glade Open World + Full Collision Registry
 *
 * Uses real CC0 Poly Haven PBR textures (stone castle bricks, terracotta clay roof tiles,
 * mossy grass, woodland leaf litter, tree bark, lime plaster, cobblestone, dark rock, marble, wood planks)
 * AND real CC0 Poly Haven glTF 3D props (boulder_01, Lantern_01, Barrel_01, dead_tree_trunk),
 * harmonized with our golden-hour Tiny Glade lighting & procedural storybook kit.
 *
 * EVERY solid object registers a real cylinder/box collider so Pip NEVER walks through trees,
 * cottages, towers, boulders, barrels, walls, signposts, or crystal pillars!
 */

import * as THREE from 'three';
import {
  CONFIG,
  CALM_SPOTS,
  CLIMBABLES,
  VINES_CONFIG,
  WIND_CORRIDORS,
  BREATH_PLATFORMS,
  CAVERN_GATE,
  TUTORIAL_MARKERS,
  ALTAR_POS,
  zoneAt,
} from './data.js';
import {
  getMat,
  getTex,
  getSprite,
  getRealPbrMat,
  getRealPbrTex,
  cloneModel,
  isTexturesEnabled,
} from './tex-bridge.js';
import {
  createBotanicalTextures,
  createForestTreeBuilder,
  buildRealisticGrassField,
  buildRealisticFerns,
  buildRealisticReeds,
  buildNaturalRoadAndCourtyard,
  buildVolumetricGodRays,
} from './forest-realism.js';
import { getChallengeCameraFX } from './challenges.js';

// =========================================================================
// Analytic Terrain Heightfield (Zero-Jitter Sync Between Mesh & Physics)
// =========================================================================
function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
}

function fbm2(x, z) {
  return (
    vnoise(x * 0.018, z * 0.018) * 0.56 +
    vnoise(x * 0.042 + 11.3, z * 0.042 - 7.1) * 0.29 +
    vnoise(x * 0.095 - 5.7, z * 0.095 + 19.2) * 0.15
  );
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function getBaseHeightAt(x, z) {
  const tX = Math.max(0, Math.min(1, (x - CONFIG.world.tailX) / CONFIG.world.width));
  let h = tX * 26.0 + Math.sin(tX * Math.PI) * 5.0;

  const flank = Math.min(1, Math.abs(z) / 162);
  h -= flank * flank * 11.5;

  const n = (fbm2(x, z) - 0.5) * 11.0;
  const spawnCalm = smoothstep(16, 56, Math.hypot(x - CONFIG.player.spawnPos.x, z - CONFIG.player.spawnPos.z));
  const crownFlat = 1 - smoothstep(198, 222, x) * 0.72;
  const cavernPathFlat = 1 - (smoothstep(40, 60, x) * (1 - smoothstep(155, 175, x)) * smoothstep(26, 8, Math.abs(z)) * 0.6);

  h += n * (0.28 + 0.72 * spawnCalm) * crownFlat * cavernPathFlat;
  // Steep Crown cliff terraces so Pip climbs the mossy walls at x=178 and x=204
  h += smoothstep(177.5, 180.5, x) * 6.8 + smoothstep(203.5, 206.5, x) * 6.2;

  // Scenic Spine Forest wind-ravine beneath Vines 2-3 (encourages exhale vine swinging)
  const ravX = smoothstep(-78, -68, x) * (1 - smoothstep(-54, -44, x));
  const ravZ = 1 - smoothstep(12, 24, Math.abs(z));
  h -= ravX * ravZ * 4.2;

  // Shallow Marshes lily pond basin around (-205, -24)
  const pondDist = Math.hypot(x + 205, z + 24);
  h -= smoothstep(16, 4, pondDist) * 2.0;

  return h;
}

export function getBreathMask(x, z) {
  const zInfo = zoneAt(x);
  const zoneAmp = zInfo.zone.amplitudeScale + (zInfo.nextZone.amplitudeScale - zInfo.zone.amplitudeScale) * zInfo.blend;
  const spineBoost = 1.0 - Math.min(0.65, (Math.abs(z) / 165) * 0.65);
  const startDamp = smoothstep(8, 35, Math.hypot(x - CONFIG.player.spawnPos.x, z));
  return zoneAmp * spineBoost * (0.35 + 0.65 * startDamp);
}

let currentBreathVal = 0;
export function getHeightAt(x, z, breathVal = currentBreathVal) {
  return getBaseHeightAt(x, z) + breathVal * CONFIG.breath.baseAmplitude * getBreathMask(x, z);
}

export function getNormalAt(x, z, breathVal = currentBreathVal) {
  const eps = 0.8;
  const hL = getHeightAt(x - eps, z, breathVal);
  const hR = getHeightAt(x + eps, z, breathVal);
  const hD = getHeightAt(x, z - eps, breathVal);
  const hU = getHeightAt(x, z + eps, breathVal);
  return new THREE.Vector3(hL - hR, 2 * eps, hD - hU).normalize();
}

// =========================================================================
// World Registries (Colliders, Standable Platforms, Animated Props)
// =========================================================================
let terrainMesh = null;
let terrainBaseY = null;
let terrainMask = null;
let normalFrameCounter = 0;

let skyMesh = null;
let skyUniforms = null;
let sunSprite = null;
let starDome = null;

// REAL COLLISION REGISTRIES (checked every frame in player.js!)
// solidColliders: { type: 'cylinder', x, z, r, topY, label } | { type: 'box', x, z, hx, hz, topY, label }
const solidColliders = [];
// standablePlatforms: { x, z, hx, hz, topY, dynamicFn } — Pip can jump onto rocks, bridges, altar, ledges!
const standablePlatforms = [];

let swayMeshGroups = [];
let breathSyncedProps = [];
let windStreamMeshes = [];
let vineObjects = [];
let breathPlatformObjs = [];
let gateDoors = null;
let altarSocketMeshes = [];
let giantEyelidGroup = null;
let puffCreatures = [];
let butterflySprites = [];
let smokePuffs = [];
let godRayMeshes = [];
let volumetricGodRays = null;
let forestGrassField = null;
let forestTreeBuilder = null;
let botanicalTextures = null;
let fernAnchors = [];
let grassExclusions = [];
let fireflyPoints = null;
let leafParticles = null;
let waterMesh = null;
let windowMatLit = null;
let windowMatDark = null;
let cottageWindowMeshes = [];
let endingFlowersMesh = null;
let endingFlowerData = [];
let endingWaveProgress = -1;

const tmpMat4 = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();

export function registerCylinderCollider(x, z, r, height = 20, label = '') {
  const base = getBaseHeightAt(x, z);
  const mask = getBreathMask(x, z);
  solidColliders.push({ type: 'cylinder', x, z, r, bottomY: base - 2, topY: base + height, mask, label });
}

export function registerBoxCollider(x, z, width, depth, height = 20, label = '') {
  const base = getBaseHeightAt(x, z);
  const mask = getBreathMask(x, z);
  solidColliders.push({ type: 'box', x, z, hx: width * 0.5, hz: depth * 0.5, bottomY: base - 2, topY: base + height, mask, label });
}

export function registerStandablePlatform(x, z, width, depth, topY) {
  const mask = getBreathMask(x, z);
  standablePlatforms.push({ x, z, hx: width * 0.5, hz: depth * 0.5, topY, mask });
}

export function registerBreathProp(obj, x, z) {
  if (!obj) return;
  breathSyncedProps.push({ obj, baseY: obj.position.y, mask: getBreathMask(x, z) });
}

// =========================================================================
// Helper: Build Crossed 3-Blade Realistic Grass Tuft Geometry
// =========================================================================
function createGrassTuftGeometry() {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const planes = 3;
  const w = 1.25, h = 0.95;

  for (let p = 0; p < planes; p++) {
    const a = (p / planes) * Math.PI;
    const ca = Math.cos(a) * w * 0.5;
    const sa = Math.sin(a) * w * 0.5;
    const base = p * 4;
    // Slight organic top lean
    const leanX = Math.cos(a + 0.7) * 0.16;
    const leanZ = Math.sin(a + 0.7) * 0.16;
    positions.push(
      -ca, 0, -sa,
       ca, 0,  sa,
       ca + leanX, h,  sa + leanZ,
      -ca + leanX, h, -sa + leanZ
    );
    for (let k = 0; k < 4; k++) normals.push(0, 1, 0);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// =========================================================================
// Helper: Build Organic Multi-Branch Tree + Lush Layered Foliage Crown
// =========================================================================
function buildRealisticTree(scene, x, z, height, trunkRadius, barkMat, leafMat, tintHex, isHero = false) {
  const baseY = getBaseHeightAt(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, baseY - 0.45, z);

  // Tapered organic main trunk with root flare
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkRadius * 0.52, trunkRadius * 1.35, height, 9, 3), barkMat);
  trunk.position.y = height * 0.5;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  grp.add(trunk);

  // 3 gnarled spreading boughs near top of trunk
  const branchCount = isHero ? 5 : 3;
  for (let b = 0; b < branchCount; b++) {
    const ba = (b / branchCount) * Math.PI * 2 + (x * 0.3);
    const bLen = height * (isHero ? 0.36 : 0.32);
    const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(trunkRadius * 0.22, trunkRadius * 0.46, bLen, 7), barkMat);
    bMesh.position.set(Math.cos(ba) * bLen * 0.36, height * 0.78, Math.sin(ba) * bLen * 0.36);
    bMesh.rotation.z = -Math.cos(ba) * 0.65;
    bMesh.rotation.x = Math.sin(ba) * 0.65;
    bMesh.castShadow = true;
    grp.add(bMesh);
  }

  // Lush layered organic foliage clusters (5 overlapping bumpy leafy clouds)
  const canopyMat = leafMat.clone();
  canopyMat.color = new THREE.Color(tintHex);
  const crownR = trunkRadius * (isHero ? 3.2 : 3.6);
  const puffOffsets = [
    [0, height + crownR * 0.35, 0, 1.15],
    [crownR * 0.65, height - crownR * 0.05, crownR * 0.35, 0.85],
    [-crownR * 0.65, height + crownR * 0.02, crownR * 0.3, 0.82],
    [crownR * 0.15, height + crownR * 0.08, -crownR * 0.68, 0.86],
    [-crownR * 0.25, height - crownR * 0.12, crownR * 0.62, 0.78],
  ];
  for (const [ox, oy, oz, sc] of puffOffsets) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(crownR * sc, 2), canopyMat);
    puff.position.set(ox, oy, oz);
    puff.scale.set(1.15, 0.78, 1.15);
    puff.castShadow = true;
    puff.receiveShadow = true;
    grp.add(puff);
  }

  scene.add(grp);
  // REAL SOLID TRUNK COLLISION! Pip can NEVER pass through this tree!
  registerCylinderCollider(x, z, trunkRadius * 1.18, height, 'tree');
}

// =========================================================================
// Helper: Build Realistic Tiny-Glade Stone & Timber Cottage with Chimney Smoke
// =========================================================================
function buildTinyGladeCottage(scene, x, z, r, rotY, mats) {
  const baseY = getBaseHeightAt(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, baseY - 0.35, z);
  grp.rotation.y = rotY;

  // 1. Weathered Medieval Stone Foundation Plinth (real CC0 castle_brick_01 PBR!)
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.12, r * 0.42, 14), mats.stone);
  plinth.position.y = r * 0.21;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  grp.add(plinth);

  // 2. Warm Lime-Plaster Cottage Walls (real CC0 beige_wall_001 PBR!)
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.98, r * 0.95, 14), mats.plaster);
  walls.position.y = r * 0.85;
  walls.castShadow = true;
  walls.receiveShadow = true;
  grp.add(walls);

  // 3. Exposed Timber Framing Posts & Eave Ring (real CC0 wood PBR!)
  const beamRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, r * 0.06, 6, 16), mats.wood);
  beamRing.rotation.x = Math.PI * 0.5;
  beamRing.position.y = r * 1.3;
  grp.add(beamRing);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 0.96, r * 0.1), mats.wood);
    post.position.set(Math.cos(a) * r * 0.96, r * 0.84, Math.sin(a) * r * 0.96);
    post.rotation.y = -a;
    grp.add(post);
  }

  // 4. Overhanging Terracotta Clay Shingle Roof (real CC0 clay_roof_tiles PBR!)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.36, r * 1.18, 16), mats.roof);
  roof.position.y = r * 1.88;
  roof.rotation.z = 0.03; // Slightly crooked Tiny-Glade charm!
  roof.castShadow = true;
  roof.receiveShadow = true;
  grp.add(roof);

  // 5. Stone Chimney + Animated Cozy Smoke Puffs
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(r * 0.28, r * 0.95, r * 0.28), mats.stone);
  chimney.position.set(r * 0.42, r * 2.0, -r * 0.25);
  chimney.castShadow = true;
  grp.add(chimney);

  const worldChimX = x + Math.cos(rotY) * r * 0.42 - Math.sin(rotY) * (-r * 0.25);
  const worldChimZ = z + Math.sin(rotY) * r * 0.42 + Math.cos(rotY) * (-r * 0.25);
  for (let s = 0; s < 3; s++) {
    const sp = new THREE.Sprite(getSprite('fx.smoke', '#F4E9CD', false));
    sp.position.set(worldChimX, baseY + r * 2.4 + s * 1.6, worldChimZ);
    sp.scale.set(1.8 + s * 0.5, 1.8 + s * 0.5, 1);
    scene.add(sp);
    smokePuffs.push({ sprite: sp, baseX: worldChimX, baseY: baseY + r * 2.35, baseZ: worldChimZ, phase: s * 0.33 + x * 0.1 });
  }

  // 6. Round Cottage Door + Warm Glowing Windows with Timber Frames
  const door = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.35, 14), mats.door);
  door.rotation.x = Math.PI * 0.5;
  door.position.set(0, r * 0.5, r * 0.95);
  grp.add(door);

  for (const ang of [0.85, -0.85, 2.35]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(r * 0.32, r * 0.36, 0.22), windowMatLit);
    win.position.set(Math.sin(ang) * r * 0.94, r * 0.88, Math.cos(ang) * r * 0.94);
    win.rotation.y = ang;
    cottageWindowMeshes.push(win);
    grp.add(win);
  }

  // 7. Real CC0 Lantern_01 hanging by the door (with glowing warm halo!)
  const lanternModel = cloneModel('lantern');
  if (lanternModel) {
    lanternModel.scale.setScalar(r * 0.55);
    lanternModel.position.set(r * 0.52, r * 0.92, r * 0.98);
    grp.add(lanternModel);
  }
  const lHalo = new THREE.Sprite(getSprite('fx.halo.warm', '#FFC77A', true));
  lHalo.position.set(r * 0.52, r * 0.98, r * 1.02);
  lHalo.scale.set(2.4, 2.4, 1);
  grp.add(lHalo);

  scene.add(grp);
  registerBreathProp(grp, x, z);
  // REAL SOLID COTTAGE COLLIDER!
  registerCylinderCollider(x, z, r * 1.15, r * 2.5, 'cottage');
}

// =========================================================================
// Terrain Creation with Real CC0 Poly Haven PBR + Multi-Zone Blending
// =========================================================================
function buildTerrain(scene) {
  const { width, depth, segX, segZ } = CONFIG.world;
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const count = pos.count;
  terrainBaseY = new Float32Array(count);
  terrainMask = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const restXZ = new Float32Array(count * 2);

  const c0 = new THREE.Color(), c1 = new THREE.Color(), cOut = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getBaseHeightAt(x, z);
    pos.setY(i, y);
    terrainBaseY[i] = y;
    terrainMask[i] = getBreathMask(x, z);
    restXZ[i * 2] = x;
    restXZ[i * 2 + 1] = z;

    const zi = zoneAt(x);
    c0.set(zi.zone.mainColor);
    c1.set(zi.nextZone.mainColor);
    cOut.copy(c0).lerp(c1, zi.blend);

    const micro = (Math.sin(x * 0.16) * Math.cos(z * 0.16) * 0.03) + (vnoise(x * 0.12, z * 0.12) - 0.5) * 0.06;
    cOut.offsetHSL(0, 0, micro);
    colors[i * 3] = cOut.r;
    colors[i * 3 + 1] = cOut.g;
    colors[i * 3 + 2] = cOut.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aRestXZ', new THREE.BufferAttribute(restXZ, 2));
  geo.computeVertexNormals();

  // Prefer real CC0 Poly Haven PBR textures blended with our cozy procedural palette!
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: false,
  });

  if (isTexturesEnabled()) {
    const tMarsh = getRealPbrTex('meadow', 'diff') || getRealPbrTex('grass', 'diff') || getTex('land.marsh');
    const tForest = getRealPbrTex('leaves', 'diff') || getTex('land.forest');
    const tCavern = getRealPbrTex('rock', 'diff') || getTex('land.cavern');
    const tCrown = getRealPbrTex('marble', 'diff') || getTex('land.crown');
    const tCliff = getRealPbrTex('cliff', 'diff') || getRealPbrTex('stone', 'diff') || getTex('land.cliff');
    const tMacro = getTex('land.macro');
    const tScales = getTex('land.scales');
    const tGrassNor = getRealPbrTex('meadow', 'nor') || getRealPbrTex('grass', 'nor');

    if (tGrassNor) {
      mat.normalMap = tGrassNor;
      mat.normalScale = new THREE.Vector2(0.72, 0.72);
    }

    if (tMarsh && tForest && tCavern && tCrown && tMacro && tScales && tCliff) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTexMarsh = { value: tMarsh };
        shader.uniforms.uTexForest = { value: tForest };
        shader.uniforms.uTexCavern = { value: tCavern };
        shader.uniforms.uTexCrown = { value: tCrown };
        shader.uniforms.uTexMacro = { value: tMacro };
        shader.uniforms.uTexScales = { value: tScales };
        shader.uniforms.uTexCliff = { value: tCliff };

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            attribute vec2 aRestXZ;
            varying vec2 vRestXZ;
            varying float vWorldNy;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vRestXZ = aRestXZ;
            vWorldNy = normalize(mat3(modelMatrix) * objectNormal).y;`
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform sampler2D uTexMarsh;
            uniform sampler2D uTexForest;
            uniform sampler2D uTexCavern;
            uniform sampler2D uTexCrown;
            uniform sampler2D uTexMacro;
            uniform sampler2D uTexScales;
            uniform sampler2D uTexCliff;
            varying vec2 vRestXZ;
            varying float vWorldNy;`
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            vec2 uvTile = vRestXZ / 10.0;
            vec2 uvDetail = vRestXZ / 3.7;
            vec2 uvMacro = clamp((vRestXZ + vec2(300.0, 100.0)) / vec2(600.0, 200.0), 0.002, 0.998);
            vec2 uvScales = vRestXZ / 40.0;

            float x = vRestXZ.x;
            float wMarsh = 1.0 - smoothstep(-152.0, -118.0, x);
            float wForest = smoothstep(-152.0, -118.0, x) * (1.0 - smoothstep(18.0, 52.0, x));
            float wCavern = smoothstep(18.0, 52.0, x) * (1.0 - smoothstep(158.0, 192.0, x));
            float wCrown = smoothstep(158.0, 192.0, x);

            // Real CC0 PBR detail harmonized with warm Tiny-Glade zone tints (never muddy or harsh)
            vec3 cMarsh = mix(texture2D(uTexMarsh, uvTile).rgb, texture2D(uTexMarsh, uvDetail).rgb, 0.35) * vec3(1.05, 1.18, 0.92);
            vec3 cForest = mix(texture2D(uTexForest, uvTile).rgb, texture2D(uTexForest, uvDetail).rgb, 0.35) * vec3(1.42, 1.16, 0.72);
            vec3 cCavern = texture2D(uTexCavern, uvTile).rgb * vec3(0.75, 0.85, 1.48);
            vec3 cCrown = texture2D(uTexCrown, uvTile).rgb * vec3(1.06, 0.98, 0.96);
            vec3 zoneTex = cMarsh * wMarsh + cForest * wForest + cCavern * wCavern + cCrown * wCrown;

            float cliffMask = smoothstep(0.84, 0.60, vWorldNy);
            vec3 cCliff = texture2D(uTexCliff, vRestXZ / 7.5).rgb * vec3(1.12, 1.05, 0.95);
            zoneTex = mix(zoneTex, cCliff, cliffMask * 0.82);

            vec3 macro = texture2D(uTexMacro, uvMacro).rgb;
            vec3 scales = texture2D(uTexScales, uvScales).rgb;
            vec3 blended = mix(diffuseColor.rgb, zoneTex, 0.64);
            blended *= mix(vec3(1.0), macro * 1.24, 0.32);
            blended = mix(blended, blended * (scales * 1.62), 0.14);
            diffuseColor.rgb = blended;`
          );
      };
      mat.customProgramCacheKey = () => 'dreamback_terrain_pbr_v2';
    }
  }

  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
}

// =========================================================================
// Atmospheric Golden-Hour Sky Dome + Volumetric Sun Disc + Stars
// =========================================================================
function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(560, 32, 20);
  const tLut = getTex('sky.lut');
  const tClouds = getTex('sky.clouds');

  skyUniforms = {
    uTopColor: { value: new THREE.Color(CONFIG.zones[0].skyTop) },
    uMidColor: { value: new THREE.Color(CONFIG.zones[0].skyMid) },
    uHorizonColor: { value: new THREE.Color(CONFIG.zones[0].skyHorizon) },
    uCalm: { value: 0.0 },
    uTime: { value: 0.0 },
    uHasLut: { value: tLut ? 1.0 : 0.0 },
    uLut: { value: tLut },
    uHasClouds: { value: tClouds ? 1.0 : 0.0 },
    uClouds: { value: tClouds },
  };

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform float uCalm;
      uniform float uTime;
      uniform float uHasLut;
      uniform sampler2D uLut;
      uniform float uHasClouds;
      uniform sampler2D uClouds;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.92 + 0.14, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.44, h));
        col = mix(col, uTopColor, smoothstep(0.36, 1.0, h));

        if (uHasLut > 0.5) {
          vec3 lutCol = texture2D(uLut, vec2(clamp(uCalm * 0.96 + 0.02, 0.02, 0.98), 1.0 - h)).rgb;
          col = mix(col, lutCol, 0.45);
        }

        // Soft Mie sun-glow scattering on the eastern Crown horizon (NaN-safe pow!)
        vec3 sunDir = normalize(vec3(0.92, 0.24 + uCalm * 0.08, -0.22));
        float sunAmt = max(0.0001, dot(vDir, sunDir));
        col += vec3(1.0, 0.84, 0.56) * pow(sunAmt, 10.0) * 0.42;
        col += vec3(1.0, 0.95, 0.82) * pow(sunAmt, 96.0) * 0.65;

        if (uHasClouds > 0.5 && vDir.y > 0.01) {
          vec2 cuv = vDir.xz / (vDir.y + 0.34) * 0.26 + vec2(uTime * 0.0035, 0.0);
          float cm = texture2D(uClouds, cuv).r;
          float cloudFade = smoothstep(0.01, 0.24, vDir.y) * smoothstep(0.95, 0.35, vDir.y);
          vec3 cloudCol = mix(uHorizonColor, vec3(1.0, 0.96, 0.87), 0.62) + vec3(1.0, 0.78, 0.5) * pow(sunAmt, 4.0) * 0.25;
          col = mix(col, cloudCol, cm * cloudFade * 0.44);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  if (isTexturesEnabled()) {
    const sunMat = getSprite('sky.sun', '#FFC77A', true);
    sunMat.fog = false;
    sunSprite = new THREE.Sprite(sunMat);
    sunSprite.scale.set(140, 140, 1);
  } else {
    sunSprite = new THREE.Mesh(new THREE.SphereGeometry(24, 16, 12), new THREE.MeshBasicMaterial({ color: '#FFF4DC', fog: false }));
  }
  scene.add(sunSprite);

  const tStars = getTex('sky.stars');
  if (tStars) {
    const starMat = new THREE.MeshBasicMaterial({
      map: tStars, side: THREE.BackSide, transparent: true, opacity: 0.14, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    });
    starDome = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), starMat);
    scene.add(starDome);
  }
}

// =========================================================================
// Zone Builders (With Full Real Collisions & CC0 PBR/glTF Assets)
// =========================================================================
function buildMarshes(scene) {
  const mats = {
    stone: getRealPbrMat('stone', { fallbackId: 'build.stone', tint: '#E5D3B8', repeatX: 2, repeatY: 2, normalScale: 0.9 }),
    plaster: getRealPbrMat('plaster', { fallbackId: 'build.plaster', tint: '#FBF1DC', repeatX: 2, repeatY: 1, normalScale: 0.45 }),
    roof: getRealPbrMat('roof', { fallbackId: 'build.roof', tint: '#D48A62', repeatX: 3, repeatY: 2, normalScale: 0.95 }),
    wood: getRealPbrMat('wood', { fallbackId: 'build.plank', tint: '#A88258', repeatX: 2, repeatY: 1, normalScale: 0.65 }),
    cobble: getRealPbrMat('cobble', { fallbackId: 'path.cobble', tint: '#DFCEB4', repeatX: 4, repeatY: 4, normalScale: 0.85 }),
    door: getMat('build.door', new THREE.MeshStandardMaterial({ color: '#6B4A2B' })),
  };
  windowMatLit = getMat('build.window', new THREE.MeshStandardMaterial({ color: '#FFC77A', emissive: '#FFC77A', emissiveIntensity: 1.35 }));
  windowMatDark = getMat('build.window.dark', new THREE.MeshStandardMaterial({ color: '#2C4A47' }));
  const plankSignMat = getMat('build.plank.painted', new THREE.MeshStandardMaterial({ color: '#DFCEB2' }));

  // 7 Tiny-Glade Cozy Stone & Timber Cottages across Tail Marshes & Expanded Outer Valleys
  const huts = [
    { x: -272, z: -15, r: 4.3, rot: 0.45 },
    { x: -255, z: -20, r: 3.6, rot: -0.28 },
    { x: -274, z: 13, r: 4.0, rot: 1.35 },
    { x: -250, z: 18, r: 3.5, rot: -1.15 },
    // Expanded outer open-world hamlets (also serve as Tremor/Sneeze shelters!)
    { x: -206, z: 86, r: 4.1, rot: 0.85 },
    { x: -182, z: 102, r: 3.6, rot: -0.6 },
    { x: -318, z: -38, r: 4.2, rot: 0.3 },
  ];
  for (const h of huts) {
    buildTinyGladeCottage(scene, h.x, h.z, h.r, h.rot, mats);
    grassExclusions.push({ x: h.x, z: h.z, r: h.r * 1.35 });
    fernAnchors.push({ x: h.x, z: h.z, r: h.r * 1.25, count: 4 });
  }

  // Iconic Tiny-Glade Stone Lookout Tower with Balcony & Archway
  const tx = -152, tz = -15;
  const ty = getBaseHeightAt(tx, tz);
  const towerGrp = new THREE.Group();
  towerGrp.position.set(tx, ty - 0.5, tz);

  const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.0, 4.0, 14), mats.stone);
  towerBase.position.y = 2.0; towerBase.castShadow = true; towerBase.receiveShadow = true;
  const towerShaft = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.3, 12.0, 14), mats.stone);
  towerShaft.position.y = 9.5; towerShaft.castShadow = true; towerShaft.receiveShadow = true;
  const towerEave = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 3.5, 1.4, 14), mats.wood);
  towerEave.position.y = 15.6;
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 6.2, 16), mats.roof);
  towerRoof.position.y = 19.3; towerRoof.castShadow = true;
  const towerWin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.35), windowMatLit);
  towerWin.position.set(0, 11.2, 3.6);
  cottageWindowMeshes.push(towerWin);

  towerGrp.add(towerBase, towerShaft, towerEave, towerRoof, towerWin);
  scene.add(towerGrp);
  registerBreathProp(towerGrp, tx, tz);
  registerCylinderCollider(tx, tz, 4.8, 22, 'lookout_tower');
  grassExclusions.push({ x: tx, z: tz, r: 5.5 });
  fernAnchors.push({ x: tx, z: tz, r: 5.0, count: 5 });

  // Terrain-Conforming Cobblestone Courtyard + Winding Flagstone Wayfinding Road!
  buildNaturalRoadAndCourtyard(scene, mats.cobble, mats.stone, getBaseHeightAt);

  // Cozy Weathered Mossy Tree Stumps & Firewood Timber Stacks (replaces industrial red drums!)
  const stumpBarkMat = getRealPbrMat('bark', { fallbackId: 'nature.bark', tint: '#9C7E5E', repeatX: 2, repeatY: 1 });
  for (const [bx, bz, sc] of [[-266, -10, 1.05], [-264.2, -9.2, 0.85], [-253, 12.5, 1.0], [-156, -11, 1.15]]) {
    const by = getBaseHeightAt(bx, bz);
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * sc, 0.72 * sc, 0.95 * sc, 10), stumpBarkMat);
    stump.position.set(bx, by + 0.42 * sc, bz);
    stump.castShadow = true; stump.receiveShadow = true;
    const topCap = new THREE.Mesh(new THREE.CircleGeometry(0.54 * sc, 10), mats.wood);
    topCap.rotation.x = -Math.PI / 2;
    topCap.position.set(bx, by + 0.90 * sc, bz);
    scene.add(stump, topCap);
    registerBreathProp(stump, bx, bz);
    registerBreathProp(topCap, bx, bz);
    fernAnchors.push({ x: bx, z: bz, r: 1.0, count: 2 });
  }

  // Real CC0 Boulders scattered naturally across main & expanded outer valleys (solid cover for Sneeze Gales!)
  for (const [rx, rz, sc] of [
    [-236, -20, 2.2], [-212, 6, 1.9], [-182, -14, 2.4], [-144, 18, 2.6], [-118, -18, 2.3], [32, 16, 2.8],
    [-312, 54, 2.8], [-228, 108, 2.5], [-146, -88, 2.7], [-68, -98, 2.9], [-42, 96, 2.6], [108, 86, 3.0], [254, -76, 2.8],
  ]) {
    const ry = getBaseHeightAt(rx, rz);
    const bModel = cloneModel('boulder');
    if (bModel) {
      bModel.scale.setScalar(sc * 1.4);
      bModel.position.set(rx, ry - 0.65, rz);
      bModel.rotation.y = rx * 0.5;
      scene.add(bModel);
      registerBreathProp(bModel, rx, rz);
    } else {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 1), mats.stone);
      m.position.set(rx, ry + sc * 0.45, rz);
      scene.add(m);
      registerBreathProp(m, rx, rz);
    }
    registerCylinderCollider(rx, rz, sc * 0.92, sc * 1.15, 'boulder');
    registerStandablePlatform(rx, rz, sc * 1.4, sc * 1.4, ry + sc * 0.95);
    fernAnchors.push({ x: rx, z: rz, r: sc * 1.15, count: 4 });
  }

  // Cozy Wooden Bridge crossing from Marshes into Spine Forest (x = -142..-126, z = 0)
  const brX = -134, brZ = 0;
  const brY = getBaseHeightAt(brX, brZ) + 0.55;
  const bridgeGrp = new THREE.Group();
  bridgeGrp.position.set(brX, brY, brZ);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 5.2), mats.wood);
  bridge.receiveShadow = true;
  bridge.castShadow = true;
  bridgeGrp.add(bridge);
  registerStandablePlatform(brX, brZ, 16, 5.2, brY + 0.32);
  // Bridge wooden side rails (solid!) + real CC0 lanterns on posts
  for (const rz of [-2.4, 2.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(16, 1.1, 0.35), mats.wood);
    rail.position.set(0, 0.7, rz);
    bridgeGrp.add(rail);
    registerBoxCollider(brX, brZ + rz, 16, 0.45, 2.2, 'bridge_rail');
  }
  for (const lx of [-7.5, 7.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 8), mats.wood);
    post.position.set(lx, 1.4, 2.4);
    bridgeGrp.add(post);
    const lan = cloneModel('lantern');
    if (lan) { lan.scale.setScalar(1.3); lan.position.set(lx, 2.6, 2.4); bridgeGrp.add(lan); }
    const halo = new THREE.Sprite(getSprite('fx.halo.warm', '#FFC77A', true));
    halo.position.set(lx, 2.8, 2.4); halo.scale.set(3.0, 3.0, 1); bridgeGrp.add(halo);
  }
  scene.add(bridgeGrp);
  registerBreathProp(bridgeGrp, brX, brZ);

  // Shallow Reflective Marshes Lily Pool + Real Floating Lily Pads
  const poolX = -205, poolZ = -24;
  const poolY = getBaseHeightAt(poolX, poolZ) + 0.65;
  const waterMat = getMat('water.pool', new THREE.MeshStandardMaterial({ color: '#6FC7BE', transparent: true, opacity: 0.86, roughness: 0.16, metalness: 0.12 }));
  if (waterMat.map) waterMat.map.repeat.set(4, 4);
  waterMesh = new THREE.Mesh(new THREE.CircleGeometry(15.0, 28), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(poolX, poolY, poolZ);
  scene.add(waterMesh);

  // Floating lily pads on pond
  const lilyMat = new THREE.MeshStandardMaterial({ color: '#6E9F6A', roughness: 0.65 });
  for (let i = 0; i < 12; i++) {
    const a = i * 1.7;
    const rad = 3 + (i % 4) * 2.8;
    const padM = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 12, 1, false, 0, Math.PI * 1.82), lilyMat);
    padM.position.set(poolX + Math.cos(a) * rad, poolY + 0.06, poolZ + Math.sin(a) * rad);
    padM.rotation.y = a;
    scene.add(padM);
    registerBreathProp(padM, poolX, poolZ);
  }

  // Solid 3D Arched Reeds & Velvet Cattails forming a closed-perimeter maze around Fragment 1 at (-178, 22)
  const reedPositions = [];

  const mazeWalls = [
    // West outer wall (entrance opening at z = 11..16)
    [-196, 18], [-196, 22.5], [-196, 27], [-196, 31.5], [-196, 36],
    // South outer wall
    [-192, 9], [-187.5, 9], [-183, 9], [-178.5, 9], [-174, 9], [-169.5, 9],
    // North outer wall
    [-192, 36], [-187.5, 36], [-183, 36], [-178.5, 36], [-174, 36], [-169.5, 36],
    // East outer wall
    [-166, 13], [-166, 17.5], [-166, 22], [-166, 26.5], [-166, 31], [-166, 35.5],
    // Inner S-baffles guiding Pip around the reed corridors to (-178, 22)
    [-187, 14], [-187, 18.5], [-187, 23],
    [-176, 31], [-176, 26.5], [-176, 13.5],
  ];
  for (const [mx, mz] of mazeWalls) {
    // No grass/reed collisions — Pip glides smoothly through reeds & meadows!
    for (let k = 0; k < 5; k++) {
      reedPositions.push({
        x: mx + (hash2(mx + k, mz) - 0.5) * 3.0,
        z: mz + (hash2(mx, mz + k * 7) - 0.5) * 3.0,
        s: 0.95 + hash2(k, mx) * 0.45,
        rot: hash2(mz, k) * Math.PI * 2,
      });
    }
  }
  // Natural reeds clustered near the Lily Pond shore & marsh hollows (never scattered randomly on dry paths)
  for (let i = 0; i < 88; i++) {
    const a = hash2(i, 11) * Math.PI * 2;
    const rad = 14.2 + hash2(i, 29) * 14.0;
    const rx = poolX + Math.cos(a) * rad;
    const rz = poolZ + Math.sin(a) * rad;
    reedPositions.push({ x: rx, z: rz, s: 0.72 + hash2(i, 41) * 0.5, rot: hash2(i, 53) * Math.PI * 2 });
  }
  const reedSway = buildRealisticReeds(scene, reedPositions, getBaseHeightAt);
  swayMeshGroups.push(...reedSway);

  // 3 Wooden Tutorial Signposts (with solid post colliders)
  for (const tm of TUTORIAL_MARKERS) {
    const sg = new THREE.Group();
    sg.position.set(tm.x, getBaseHeightAt(tm.x, tm.z), tm.z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.5, 6), mats.wood);
    post.position.y = 1.25;
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 0.22), plankSignMat);
    board.position.y = 2.25;
    board.rotation.y = 0.25;
    sg.add(post, board);
    scene.add(sg);
    registerBreathProp(sg, tm.x, tm.z);
  }

  // Lush Realistic Multi-Branch Evergreen Pines & Broadleaf Oaks framing Tail Marshes Village!
  const marshPinePal = ['#749460', '#5E7E4E', '#8EA86C', '#4E6B42'];
  const marshOakPal = ['#93B16E', '#7C9C5A', '#AFC078', '#6B8A4E'];
  const marshTrees = [
    [-284, -4, 15.5, 0.72, 'pine'], [-278, -28, 17.0, 0.78, 'pine'], [-266, -34, 14.0, 0.75, 'oak'],
    [-244, -30, 14.5, 0.80, 'oak'], [-234, 27, 13.5, 0.76, 'oak'],  [-256, 32, 16.5, 0.74, 'pine'],
    [-226, -34, 18.0, 0.82, 'pine'], [-212, 26, 15.0, 0.74, 'pine'], [-196, -38, 17.5, 0.80, 'pine'],
    [-186, -26, 14.0, 0.78, 'oak'], [-176, -12, 15.5, 0.74, 'pine'], [-166, -28, 18.5, 0.84, 'pine'],
    [-158, 12, 14.5, 0.74, 'oak'],  [-148, -32, 19.0, 0.85, 'pine'], [-142, 26, 16.5, 0.76, 'pine'],
    [-220, -6, 13.0, 0.72, 'oak'],  [-202, 4, 15.0, 0.70, 'pine'],   [-162, 2, 12.5, 0.68, 'oak'],
  ];
  for (const [tx2, tz2, th, tr, sp] of marshTrees) {
    forestTreeBuilder.addTree(tx2, tz2, th, tr, sp, sp === 'pine' ? marshPinePal : marshOakPal);
    fernAnchors.push({ x: tx2, z: tz2, r: tr * 1.5, count: 3 });
  }

  // Grazing fluffy Puffs (char.puff.wool + char.puff.face)
  const woolMat = getMat('char.puff.wool', new THREE.MeshStandardMaterial({ color: '#F4E9CD', roughness: 0.94 }));
  const faceMat = getMat('char.puff.face', new THREE.MeshStandardMaterial({ color: '#7A6A5A', roughness: 0.86 }));
  for (const [px, pz] of [[-238, -14], [-216, 16], [-162, -4], [-132, 14]]) {
    const puff = new THREE.Group();
    puff.position.set(px, getBaseHeightAt(px, pz) + 0.9, pz);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 12), woolMat);
    body.scale.set(1.2, 0.92, 0.95); body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 10), faceMat);
    head.position.set(1.05, 0.25, 0);
    puff.add(body, head);
    scene.add(puff);
    puffCreatures.push({ group: puff, homeX: px, homeZ: pz, phase: px * 0.3 });
  }
}

function buildForest(scene) {
  const vineMat = getMat('build.rope', new THREE.MeshStandardMaterial({ color: '#6B7F3A' }));
  const woodMat = getRealPbrMat('wood', { fallbackId: 'build.plank', tint: '#B89264', repeatX: 2, repeatY: 2 });
  const forestPinePal = ['#68824B', '#546E3E', '#839856', '#7A8644'];
  const forestOakPal = ['#D6A246', '#E4BE64', '#A69A42', '#C58538'];

  // 92 Dense Photorealistic EZTree-Style Pines & Golden Autumn Oaks across Spine Forest & Expanded Valleys!
  for (let i = 0; i < 92; i++) {
    const x = -132 + hash2(i, 71) * 168;
    const z = -134 + hash2(i, 89) * 268;
    // Keep central flagstone road & vine runway cleanly navigable
    if (Math.abs(z) < 11.5 && x > -110 && x < 12) continue;
    const h = 13.5 + hash2(i, 101) * 12.5;
    const r = 0.65 + hash2(i, 113) * 0.48;
    const isPine = i % 3 !== 0;
    forestTreeBuilder.addTree(x, z, h, r, isPine ? 'pine' : 'oak', isPine ? forestPinePal : forestOakPal);
    if (i % 2 === 0) fernAnchors.push({ x, z, r: r * 1.6, count: 3 });
  }

  // Hero Ancient Golden Honeytree holding Fragment 2 at (14, -2)
  forestTreeBuilder.addTree(14, -2, 14.5, 1.9, 'oak', ['#E8BE62', '#D9A441', '#F0CC7A', '#C8923A'], true);
  const heroY = getBaseHeightAt(14, -2);
  const treeTop = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 4.2, 0.9, 14), woodMat);
  treeTop.position.set(14, heroY + 11.4, -2);
  treeTop.receiveShadow = true;
  scene.add(treeTop);
  registerBreathProp(treeTop, 14, -2);
  registerStandablePlatform(14, -2, 9.6, 9.6, heroY + 11.88);

  // Real CC0 fallen dead tree logs in Spine Forest (with solid box colliders & standable tops!)
  for (const [lx, lz, rot] of [[-96, 12, 0.4], [-44, -14, -0.5], [-12, 16, 0.25]]) {
    const ly = getBaseHeightAt(lx, lz);
    const logM = cloneModel('log');
    if (logM) {
      logM.scale.setScalar(2.4);
      logM.position.set(lx, ly - 0.1, lz);
      logM.rotation.y = rot;
      scene.add(logM);
      registerBreathProp(logM, lx, lz);
      registerCylinderCollider(lx, lz, 1.5, 2.0, 'fallen_log');
      registerStandablePlatform(lx, lz, 3.2, 3.2, ly + 1.5);
      fernAnchors.push({ x: lx, z: lz, r: 2.0, count: 4 });
    }
  }

  // Visible Wind-Stream Ribbons inside WIND_CORRIDORS so exhale gusts are unmistakable!
  windStreamMeshes = [];
  const windMat = new THREE.MeshBasicMaterial({
    color: '#FFF4DC',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const windGeo = new THREE.PlaneGeometry(7.5, 0.28);
  for (const cor of WIND_CORRIDORS) {
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(windGeo, windMat.clone());
      const wx = cor.xMin + hash2(i, 701) * (cor.xMax - cor.xMin);
      const wz = cor.zMin + 2 + hash2(i, 709) * (cor.zMax - cor.zMin - 4);
      const wyOff = 1.6 + hash2(i, 719) * 5.2;
      m.position.set(wx, getBaseHeightAt(wx, wz) + wyOff, wz);
      scene.add(m);
      windStreamMeshes.push({ mesh: m, cor, x: wx, z: wz, yOff: wyOff, speed: 12 + hash2(i, 727) * 10, phase: i * 0.7 });
    }
  }

  // Custom Soft-Fresnel Volumetric Sun-Shaft God-Rays streaming between tree canopies!
  volumetricGodRays = buildVolumetricGodRays(scene, getBaseHeightAt);
  godRayMeshes = [];

  // Breath-Synced Swinging Vines (glow green on exhale!) + elevated rest pads
  vineObjects = [];
  if (!CONFIG.forest.simpleMode) {
    for (const v of VINES_CONFIG) {
      const baseY = getBaseHeightAt(v.x, v.z);
      const baseAnchorY = baseY + v.anchorYOff;
      const anchor = new THREE.Vector3(v.x, baseAnchorY, v.z);
      const pivot = new THREE.Group();
      pivot.position.copy(anchor);

      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, v.length, 7), vineMat);
      rope.position.y = -v.length * 0.5;
      pivot.add(rope);

      const handleMat = new THREE.MeshStandardMaterial({ color: '#D9A441', emissive: '#8FBF8F', emissiveIntensity: 0.35 });
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.76, 12, 8), handleMat);
      handle.position.y = -v.length;
      pivot.add(handle);

      scene.add(pivot);
      vineObjects.push({
        cfg: v, anchor, baseAnchorY, mask: getBreathMask(v.x, v.z), pivot, handle, handleMat,
        angle: 0, angVel: 0,
        worldEnd: new THREE.Vector3(v.x, anchor.y - v.length, v.z),
      });
    }
  } else {
    VINES_CONFIG.forEach((v, i) => {
      BREATH_PLATFORMS.push({ id: `bp_forest_${i}`, zone: 'forest', x: v.x, z: v.z, yOff: 2.6 + (i % 3) * 1.1, w: 5.5, d: 5.5, mode: 'exhale' });
    });
  }

  // Drifting golden autumn leaves
  const leafCount = 110;
  const leafPos = new Float32Array(leafCount * 3);
  for (let i = 0; i < leafCount; i++) {
    leafPos[i * 3] = -115 + hash2(i, 3) * 135;
    leafPos[i * 3 + 1] = 16 + hash2(i, 7) * 16;
    leafPos[i * 3 + 2] = -28 + hash2(i, 13) * 56;
  }
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
  const leafPtsMat = new THREE.PointsMaterial({ map: getTex('fx.leaf'), color: '#E8B86A', size: 0.65, transparent: true, depthWrite: false, opacity: 0.75 });
  leafParticles = new THREE.Points(leafGeo, leafPtsMat);
  scene.add(leafParticles);
}

function buildCaverns(scene) {
  const ribMat = getRealPbrMat('marble', { fallbackId: 'build.rib', tint: '#CFC8E2', repeatX: 2, repeatY: 6, normalScale: 0.65 });
  const gateMat = getMat('build.gate', new THREE.MeshStandardMaterial({ color: '#3B3F7A', emissive: '#4FD1C5', emissiveIntensity: 0.65, flatShading: true }));
  const rockWallMat = getRealPbrMat('cliff', { fallbackId: 'build.stone.ruin', tint: '#6B74A8', repeatX: 3, repeatY: 2, normalScale: 1.2 });
  const mushCapMat = getMat('nature.mushroom.cap', new THREE.MeshStandardMaterial({ color: '#4FD1C5', emissive: '#4FD1C5', emissiveIntensity: 0.58 }));
  const mushStemMat = getMat('nature.mushroom.stem', new THREE.MeshStandardMaterial({ color: '#F4E9CD' }));
  const crystalTealMat = getMat('nature.crystal', new THREE.MeshStandardMaterial({ color: '#4FD1C5', emissive: '#4FD1C5', emissiveIntensity: 0.75, flatShading: true }));
  const crystalPinkMat = getMat('nature.crystal.pink', new THREE.MeshStandardMaterial({ color: '#E27BB1', emissive: '#E27BB1', emissiveIntensity: 0.75, flatShading: true }));

  // Cathedral Giant Rib Arches (solid base pillars so Pip collides with rib bases!)
  for (let i = 0; i < 8; i++) {
    const rx = 44 + i * 17.5;
    const ry = getBaseHeightAt(rx, 0);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(29, 2.4, 12, 28, Math.PI), ribMat);
    arch.position.set(rx, ry - 4, 0);
    arch.rotation.y = Math.PI * 0.5;
    arch.scale.set(1.0, 0.92 + (i % 2) * 0.08, 1.0);
    scene.add(arch);
    registerBreathProp(arch, rx, 0);
    registerCylinderCollider(rx, -29, 2.8, 12, 'rib_base');
    registerCylinderCollider(rx, 29, 2.8, 12, 'rib_base');
  }

  // Ambient glowing cavern mushrooms (InstancedMesh + solid colliders on big stems)
  const mCount = 54;
  const stemGeo = new THREE.CylinderGeometry(0.45, 0.68, 2.0, 8); stemGeo.translate(0, 1.0, 0);
  const capGeo = new THREE.SphereGeometry(1.45, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55); capGeo.translate(0, 1.9, 0);
  const stemInst = new THREE.InstancedMesh(stemGeo, mushStemMat, mCount);
  const capInst = new THREE.InstancedMesh(capGeo, mushCapMat, mCount);

  for (let i = 0; i < mCount; i++) {
    const mx = 42 + hash2(i, 211) * 124;
    const mz = (hash2(i, 223) > 0.5 ? 1 : -1) * (15 + hash2(i, 229) * 30);
    const my = getBaseHeightAt(mx, mz);
    const sc = 0.7 + hash2(i, 233) * 1.15;
    tmpPos.set(mx, my - 0.2, mz); tmpQuat.identity(); tmpScale.set(sc, sc, sc);
    tmpMat4.compose(tmpPos, tmpQuat, tmpScale);
    stemInst.setMatrixAt(i, tmpMat4);
    capInst.setMatrixAt(i, tmpMat4);
  }
  stemInst.instanceMatrix.needsUpdate = true;
  capInst.instanceMatrix.needsUpdate = true;
  scene.add(stemInst, capInst);

  // Solid Glowing Crystal Formations (central cavern + expanded outer crystal grottos!)
  const cryGeo = new THREE.OctahedronGeometry(1.9, 0);
  for (let i = 0; i < 30; i++) {
    const outer = i >= 18;
    const cx = outer ? 46 + (i - 18) * 10.5 : 48 + i * 6.8;
    const cz = outer
      ? (i % 2 === 0 ? -1 : 1) * (54 + (i % 4) * 16)
      : (i % 2 === 0 ? -1 : 1) * (20 + (i % 3) * 5);
    const c = new THREE.Mesh(cryGeo, i % 2 === 0 ? crystalTealMat : crystalPinkMat);
    c.position.set(cx, getBaseHeightAt(cx, cz) + 1.5, cz);
    c.scale.set(0.85, 2.3, 0.85);
    c.rotation.set(0.2, i * 0.7, i % 2 === 0 ? 0.22 : -0.22);
    scene.add(c);
    registerBreathProp(c, cx, cz);
    registerCylinderCollider(cx, cz, 1.5, 5.5, 'crystal');
  }

  // Carved Stone Gate blocking Fragment 3 + 3 glowing puzzle-progress rune orbs on the gate arch!
  const gx = CAVERN_GATE.x, gz = CAVERN_GATE.z;
  const gy = getBaseHeightAt(gx, gz);
  const gateGroup = new THREE.Group();
  gateGroup.position.set(gx, gy, gz);

  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(2.0, CAVERN_GATE.height, CAVERN_GATE.width * 0.5), gateMat);
  leftDoor.position.set(0, CAVERN_GATE.height * 0.5, -CAVERN_GATE.width * 0.25);
  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(2.0, CAVERN_GATE.height, CAVERN_GATE.width * 0.5), gateMat);
  rightDoor.position.set(0, CAVERN_GATE.height * 0.5, CAVERN_GATE.width * 0.25);

  // Compact flanking Echo Shrine pillars (open-world: players can freely roam around into The Crown anytime!)
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 14, 10), rockWallMat);
  wallL.position.set(0, 7.0, -CAVERN_GATE.width * 0.5 - 5);
  const wallR = new THREE.Mesh(new THREE.BoxGeometry(3.2, 14, 10), rockWallMat);
  wallR.position.set(0, 7.0, CAVERN_GATE.width * 0.5 + 5);

  registerBoxCollider(gx, -CAVERN_GATE.width * 0.5 - 5, 3.4, 10, 15, 'cavern_wall');
  registerBoxCollider(gx, CAVERN_GATE.width * 0.5 + 5, 3.4, 10, 15, 'cavern_wall');

  // 3 Gate Rune indicators that light up as each mushroom pad is stepped on!
  const runeColors = ['#4FD1C5', '#E27BB1', '#8894F2'];
  const gateRunes = [];
  for (let r = 0; r < 3; r++) {
    const rMat = new THREE.MeshStandardMaterial({ color: runeColors[r], emissive: runeColors[r], emissiveIntensity: 0.12 });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), rMat);
    orb.position.set(-1.3, CAVERN_GATE.height + 1.2, (r - 1) * 3.0);
    gateGroup.add(orb);
    gateRunes.push(rMat);
  }

  gateGroup.add(leftDoor, rightDoor, wallL, wallR);
  scene.add(gateGroup);
  registerBreathProp(gateGroup, gx, gz);
  gateDoors = { group: gateGroup, left: leftDoor, right: rightDoor, runes: gateRunes, openProgress: 0, isOpen: false };
}

function buildCrown(scene) {
  const altarMat = getRealPbrMat('marble', { fallbackId: 'build.altar', tint: '#FFF4EC', repeatX: 2, repeatY: 2, normalScale: 0.5 });
  const lidMat = getMat('char.giant.eyelid', new THREE.MeshStandardMaterial({ color: '#F6B8C8', roughness: 0.66 }));
  const lashMat = getMat('char.giant.lash', new THREE.MeshStandardMaterial({ color: '#2C4A47', transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
  const cloudMat = getMat('nature.cloudpuff', new THREE.MeshBasicMaterial({ color: '#FFF4DC', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));

  // Dream Altar stone circle at (274, 0) with standable dais top!
  const ay = getBaseHeightAt(ALTAR_POS.x, ALTAR_POS.z);
  const altarGroup = new THREE.Group();
  altarGroup.position.set(ALTAR_POS.x, ay, ALTAR_POS.z);

  const dais = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.6, 1.0, 24), altarMat);
  dais.position.y = 0.5; dais.receiveShadow = true;
  altarGroup.add(dais);
  registerStandablePlatform(ALTAR_POS.x, ALTAR_POS.z, 11.4, 11.4, ay + 1.02);

  const zoneColors = ['#8FBF8F', '#D9A441', '#4FD1C5', '#F6B8C8'];
  altarSocketMeshes = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const sMat = new THREE.MeshStandardMaterial({ color: zoneColors[i], emissive: zoneColors[i], emissiveIntensity: 0.18, roughness: 0.45 });
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.55, 14), sMat);
    sock.position.set(Math.cos(a) * 3.5, 1.2, Math.sin(a) * 3.5);
    altarGroup.add(sock);
    altarSocketMeshes.push({ mesh: sock, mat: sMat, color: zoneColors[i] });
  }
  scene.add(altarGroup);
  registerBreathProp(altarGroup, ALTAR_POS.x, ALTAR_POS.z);

  // Colossal Sleeping Giant Closed Eyelid beyond the Crown edge
  giantEyelidGroup = new THREE.Group();
  giantEyelidGroup.position.set(308, ay - 3, 0);
  const lidMesh = new THREE.Mesh(new THREE.SphereGeometry(28, 26, 16, 0, Math.PI, 0, Math.PI * 0.55), lidMat);
  lidMesh.rotation.z = -Math.PI * 0.12;
  lidMesh.rotation.y = -Math.PI * 0.5;
  lidMesh.scale.set(1.1, 0.72, 1.38);
  giantEyelidGroup.add(lidMesh);

  for (let l = -4; l <= 4; l++) {
    const lash = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 12), lashMat);
    lash.position.set(-15, -4 + Math.abs(l) * 0.5, l * 5.4);
    lash.rotation.set(0, -Math.PI * 0.5, 0.65);
    giantEyelidGroup.add(lash);
  }
  scene.add(giantEyelidGroup);

  // Floating sunlit cloud ring around Crown summit
  const cloudGeo = new THREE.PlaneGeometry(26, 17);
  const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, 28);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rad = 58 + (i % 3) * 18;
    const cx = 248 + Math.cos(a) * rad * 0.85, cz = Math.sin(a) * rad;
    const cy = ay - 8 + (i % 4) * 5;
    tmpPos.set(cx, cy, cz);
    tmpEuler.set(0, -a + Math.PI * 0.5, 0);
    tmpQuat.setFromEuler(tmpEuler);
    const sc = 0.85 + (i % 3) * 0.35;
    tmpScale.set(sc, sc, sc);
    tmpMat4.compose(tmpPos, tmpQuat, tmpScale);
    cloudInst.setMatrixAt(i, tmpMat4);
  }
  cloudInst.instanceMatrix.needsUpdate = true;
  scene.add(cloudInst);
}

function buildSharedFoliageAndPlatforms(scene) {
  // Breath-synced platforms
  breathPlatformObjs = [];
  const stepMatBase = getRealPbrMat('stone', { fallbackId: 'path.steps', tint: '#E2D4BC', repeatX: 1, repeatY: 1 });
  for (const bp of BREATH_PLATFORMS) {
    const mat = stepMatBase.clone();
    mat.transparent = true;
    mat.opacity = 1.0;
    mat.emissive = new THREE.Color(bp.mode === 'exhale' ? '#8FBF8F' : '#4FD1C5');
    mat.emissiveIntensity = 0.38;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bp.w, 0.9, bp.d), mat);
    const y = getBaseHeightAt(bp.x, bp.z) + bp.yOff;
    mesh.position.set(bp.x, y, bp.z);
    scene.add(mesh);
    breathPlatformObjs.push({ cfg: bp, mesh, mat, baseY: y, active: true });
  }

  // Climbable mossy stone walls (using freshly downloaded CC0 moss PBR!)
  const climbMat = getRealPbrMat('moss', { fallbackId: 'ground.moss', tint: '#B8D4AE', repeatX: 1, repeatY: 2, normalScale: 1.15 });
  for (const cl of CLIMBABLES) {
    const baseY = getBaseHeightAt(cl.x, cl.z);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, cl.height, cl.width), climbMat);
    wall.position.set(cl.x, baseY + cl.height * 0.5, cl.z);
    wall.receiveShadow = true; wall.castShadow = true;
    scene.add(wall);
    registerBreathProp(wall, cl.x, cl.z);
    registerBoxCollider(cl.x, cl.z, 1.4, cl.width, cl.height - 0.3, 'climb_wall');
    registerStandablePlatform(cl.x, cl.z, 2.2, cl.width, baseY + cl.height + 0.05);
  }

  // Calm Spot glowing moss rings
  const calmDiscMat = getMat('fx.calm', new THREE.MeshBasicMaterial({ color: '#8FBF8F', transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const cs of CALM_SPOTS) {
    const y = getBaseHeightAt(cs.x, cs.z);
    const ring = new THREE.Mesh(new THREE.CircleGeometry(cs.radius, 24), calmDiscMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cs.x, y + 0.36, cs.z);
    scene.add(ring);
    cs.mesh = ring;
  }

  // GPU-INSTANCED 26,000-BLADE CURVED SHADER GRASS MEADOW (wind gusts, subsurface glow, player trampling!)
  forestGrassField = buildRealisticGrassField(scene, getBaseHeightAt, getBreathMask, grassExclusions);

  // 220+ INSTANCED 3D WOODLAND SWORD-FERN ROSETTES around trees, boulders & cottages!
  const fernSway = buildRealisticFerns(scene, botanicalTextures.fernFrondTex, getBaseHeightAt, fernAnchors);
  swayMeshGroups.push(fernSway);

  // 560 Painted Wildflower Blooms across expanded Marshes, Valleys & Crown meadows!
  const flMat = getMat('nature.flowers.bloom', new THREE.MeshStandardMaterial({ color: '#FFF4DC', transparent: true, alphaTest: 0.16, side: THREE.DoubleSide, roughness: 0.8 }));
  const flGeo = new THREE.PlaneGeometry(0.95, 0.95); flGeo.translate(0, 0.55, 0);
  const flCount = 560;
  const flInst = new THREE.InstancedMesh(flGeo, flMat, flCount);
  const flCols = [new THREE.Color('#FFF4DC'), new THREE.Color('#FFC77A'), new THREE.Color('#F6B8C8'), new THREE.Color('#E8C06A')];
  for (let i = 0; i < flCount; i++) {
    const inCrown = i > 390;
    const x = inCrown ? 185 + hash2(i, 601) * 175 : -365 + hash2(i, 607) * 245;
    const z = -132 + hash2(i, 613) * 264;
    const sc = 0.7 + hash2(i, 619) * 0.65;
    tmpPos.set(x, getBaseHeightAt(x, z) - 0.05, z);
    tmpEuler.set(0, hash2(i, 631) * Math.PI, 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(sc, sc, sc);
    tmpMat4.compose(tmpPos, tmpQuat, tmpScale);
    flInst.setMatrixAt(i, tmpMat4);
    flInst.setColorAt(i, flCols[i % flCols.length]);
  }
  flInst.instanceMatrix.needsUpdate = true;
  if (flInst.instanceColor) flInst.instanceColor.needsUpdate = true;
  scene.add(flInst);

  // Drifting golden fireflies & warm sun-dust motes across expanded world
  const ffCount = 175;
  const ffPos = new Float32Array(ffCount * 3);
  for (let i = 0; i < ffCount; i++) {
    const x = -365 + hash2(i, 401) * 730;
    const z = -138 + hash2(i, 409) * 276;
    ffPos[i * 3] = x;
    ffPos[i * 3 + 1] = getBaseHeightAt(x, z) + 2.2 + hash2(i, 419) * 5.5;
    ffPos[i * 3 + 2] = z;
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  fireflyPoints = new THREE.Points(ffGeo, new THREE.PointsMaterial({
    map: getTex('fx.firefly'), color: '#FFC77A', size: 1.8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9,
  }));
  scene.add(fireflyPoints);

  // 26 Individual 3D Flapping Butterflies scattered across the expanded open world (1 atlas cell per butterfly!)
  butterflySprites = [];
  const baseBflyTex = getTex('fx.butterfly');
  const wingGeo = new THREE.PlaneGeometry(0.65, 0.72);
  wingGeo.translate(0.325, 0, 0); // Hinge on inner body edge so wings flap naturally!
  const bflyMats = [];
  for (let c = 0; c < 4; c++) {
    let mat;
    if (baseBflyTex) {
      const cellTex = baseBflyTex.clone();
      cellTex.repeat.set(0.25, 1);
      cellTex.offset.set(c * 0.25, 0);
      cellTex.needsUpdate = true;
      mat = new THREE.MeshBasicMaterial({ map: cellTex, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide });
    } else {
      const cols = ['#FFC46B', '#D9A441', '#4FD1C5', '#F6B8C8'];
      mat = new THREE.MeshBasicMaterial({ color: cols[c], side: THREE.DoubleSide });
    }
    bflyMats.push(mat);
  }
  for (let i = 0; i < 26; i++) {
    const grp = new THREE.Group();
    const m = bflyMats[i % 4];
    const wingR = new THREE.Mesh(wingGeo, m);
    const wingL = new THREE.Mesh(wingGeo, m);
    wingL.scale.x = -1; // Mirror left wing
    grp.add(wingR, wingL);

    const bx = -320 + hash2(i, 811) * 640;
    const bz = -115 + hash2(i, 823) * 230;
    const sc = 0.75 + hash2(i, 829) * 0.55;
    grp.scale.setScalar(sc);
    grp.position.set(bx, getBaseHeightAt(bx, bz) + 2.8, bz);
    scene.add(grp);
    butterflySprites.push({
      group: grp,
      wingL,
      wingR,
      baseX: bx,
      baseZ: bz,
      radX: 7 + hash2(i, 839) * 14,
      radZ: 6 + hash2(i, 853) * 14,
      spd: 0.45 + hash2(i, 857) * 0.55,
      flapSpd: 11 + hash2(i, 863) * 6,
      phase: hash2(i, 877) * Math.PI * 2,
    });
  }

  // Ending 3,600-Flower Wave InstancedMesh
  const fCount = 3600;
  const fMat = getMat('nature.flowers.bloom', new THREE.MeshBasicMaterial({ color: '#FFF4DC', transparent: true, alphaTest: 0.15, side: THREE.DoubleSide }));
  const fGeo = new THREE.PlaneGeometry(1.75, 1.75); fGeo.translate(0, 0.85, 0);
  endingFlowersMesh = new THREE.InstancedMesh(fGeo, fMat, fCount);
  endingFlowersMesh.visible = false;
  endingFlowerData = [];
  const bloomCols = [new THREE.Color('#F4E9CD'), new THREE.Color('#FFC77A'), new THREE.Color('#4FD1C5'), new THREE.Color('#F6B8C8')];
  for (let i = 0; i < fCount; i++) {
    const x = -285 + hash2(i, 503) * 570;
    const z = -72 + hash2(i, 509) * 144;
    const y = getBaseHeightAt(x, z);
    const zi = zoneAt(x).index;
    endingFlowerData.push({ x, y, z, rot: hash2(i, 521) * Math.PI, s: 0.75 + hash2(i, 523) * 0.9 });
    tmpScale.set(0, 0, 0); tmpPos.set(x, y, z);
    tmpMat4.compose(tmpPos, tmpQuat.identity(), tmpScale);
    endingFlowersMesh.setMatrixAt(i, tmpMat4);
    endingFlowersMesh.setColorAt(i, bloomCols[zi]);
  }
  endingFlowersMesh.instanceMatrix.needsUpdate = true;
  if (endingFlowersMesh.instanceColor) endingFlowersMesh.instanceColor.needsUpdate = true;
  scene.add(endingFlowersMesh);
}

// =========================================================================
// Public World API
// =========================================================================
export function createWorld(scene) {
  solidColliders.length = 0;
  standablePlatforms.length = 0;
  swayMeshGroups.length = 0;
  breathSyncedProps.length = 0;
  windStreamMeshes.length = 0;
  smokePuffs.length = 0;
  cottageWindowMeshes.length = 0;
  fernAnchors = [];
  grassExclusions = [];

  botanicalTextures = createBotanicalTextures();
  const sharedBarkMat = getRealPbrMat('bark', { fallbackId: 'nature.bark', tint: '#B2926F', repeatX: 1, repeatY: 4, normalScale: 1.0 });
  forestTreeBuilder = createForestTreeBuilder(scene, sharedBarkMat, botanicalTextures, getBaseHeightAt, registerCylinderCollider);

  buildTerrain(scene);
  buildSky(scene);
  buildMarshes(scene);
  buildForest(scene);
  buildCaverns(scene);
  buildCrown(scene);
  buildSharedFoliageAndPlatforms(scene);
  forestTreeBuilder.finalize();

  console.info(
    `[Dreamback World] Registered ${solidColliders.length} solid colliders, ${standablePlatforms.length} standable platforms & ${forestGrassField?.count || 0} GPU grass blades.`
  );
  return { terrainMesh, solidColliders, standablePlatforms, vineObjects, breathPlatformObjs, gateDoors, altarSocketMeshes };
}

export function getTerrainMesh() { return terrainMesh; }
export function getSolidColliders() { return solidColliders; }
export function getStandablePlatforms() { return standablePlatforms; }
export function getVines() { return vineObjects; }
export function getBreathPlatforms() { return breathPlatformObjs; }
export function getGateDoors() { return gateDoors; }
export function getAltarSockets() { return altarSocketMeshes; }
export function getPuffCreatures() { return puffCreatures; }

export function resetWorldState() {
  if (gateDoors) {
    gateDoors.isOpen = false;
    gateDoors.openProgress = 0;
    gateDoors.left.position.z = -CAVERN_GATE.width * 0.25;
    gateDoors.right.position.z = CAVERN_GATE.width * 0.25;
    gateDoors.runes.forEach((r) => { r.emissiveIntensity = 0.12; });
  }
  for (const s of altarSocketMeshes) s.mat.emissiveIntensity = 0.18;
  endingWaveProgress = -1;
  if (endingFlowersMesh) endingFlowersMesh.visible = false;
}

export function triggerEndingFlowerWave() {
  endingWaveProgress = 0;
  if (endingFlowersMesh) endingFlowersMesh.visible = true;
}

export function updateWorld(dt, state, scene, sunLight, hemiLight, camera) {
  const b = state.breath.value;
  currentBreathVal = b;
  const amp = CONFIG.breath.baseAmplitude;
  const time = state.breath.t;

  // 1. Live terrain breathing heave
  if (terrainMesh) {
    const pos = terrainMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainBaseY[i] + b * amp * terrainMask[i]);
    }
    pos.needsUpdate = true;
    normalFrameCounter++;
    if (normalFrameCounter % 3 === 0) terrainMesh.geometry.computeVertexNormals();
  }

  // 2. Sky dome, golden-hour light & fog blend based on camera/Pip zone
  const sampleX = state.mode === 'play' && state.player ? state.player.x : camera.position.x;
  const zi = zoneAt(sampleX);
  const calm = state.calm || 0;

  if (skyMesh) {
    skyMesh.position.copy(camera.position);
    skyUniforms.uTime.value = time;
    skyUniforms.uCalm.value = calm;

    const topA = new THREE.Color(zi.zone.skyTop).lerp(new THREE.Color(zi.nextZone.skyTop), zi.blend);
    const midA = new THREE.Color(zi.zone.skyMid).lerp(new THREE.Color(zi.nextZone.skyMid), zi.blend);
    const horA = new THREE.Color(zi.zone.skyHorizon).lerp(new THREE.Color(zi.nextZone.skyHorizon), zi.blend);
    topA.lerp(new THREE.Color('#A9A8D6'), calm * 0.45);
    midA.lerp(new THREE.Color('#F6B8C8'), calm * 0.45);
    horA.lerp(new THREE.Color('#FFE7B0'), calm * 0.45);

    skyUniforms.uTopColor.value.copy(topA);
    skyUniforms.uMidColor.value.copy(midA);
    skyUniforms.uHorizonColor.value.copy(horA);
  }
  if (sunSprite) sunSprite.position.set(camera.position.x + 310, camera.position.y + 78 + calm * 24, camera.position.z - 68);
  if (starDome) {
    starDome.position.copy(camera.position);
    starDome.material.opacity = zi.index === 2 ? 0.34 : Math.max(0.04, 0.16 - calm * 0.12);
  }

  if (scene.fog) {
    const chFX = getChallengeCameraFX();
    const fogCol = new THREE.Color(zi.zone.fogColor).lerp(new THREE.Color(zi.nextZone.fogColor), zi.blend);
    fogCol.lerp(new THREE.Color('#FFE7C8'), calm * 0.25);
    if (state.restlessness >= CONFIG.restlessness.vignetteThreshold) {
      fogCol.lerp(new THREE.Color('#9E958C'), ((state.restlessness - 75) / 25) * 0.4);
    }
    if (chFX.fogTint && chFX.fogTintStrength > 0.01) {
      fogCol.lerp(chFX.fogTint, chFX.fogTintStrength);
    }
    scene.fog.color.copy(fogCol);
    const baseD = zi.zone.fogDensity + (zi.nextZone.fogDensity - zi.zone.fogDensity) * zi.blend;
    const endingClear = state.mode === 'ending' || state.mode === 'ended' ? 0.08 : 1.0;
    scene.fog.density = baseD * (0.72 + 0.58 * b) * (1 - calm * 0.2) * endingClear * (chFX.fogBoost || 1.0);
  }

  if (sunLight && hemiLight) {
    sunLight.color.set(zi.zone.sunColor).lerp(new THREE.Color(zi.nextZone.sunColor), zi.blend);
    sunLight.intensity = 1.55 + calm * 0.35;
    hemiLight.color.set(zi.zone.hemiSky).lerp(new THREE.Color(zi.nextZone.hemiSky), zi.blend);
    hemiLight.groundColor.set(zi.zone.hemiGround).lerp(new THREE.Color(zi.nextZone.hemiGround), zi.blend);
    hemiLight.intensity = (zi.index === 2 ? 1.15 : 0.98) + calm * 0.2;
  }

  // 3. Cottage windows warm glow (lit on title/intro or once Lantern/Fragment is earned)
  const lit = state.mode !== 'play' || state.flags.hasLantern || state.fragments.length >= 1;
  for (const wMesh of cottageWindowMeshes) wMesh.material = lit ? windowMatLit : windowMatDark;

  // 4. Water scroll & chimney smoke puffs
  if (waterMesh) {
    if (waterMesh.material.map) {
      waterMesh.material.map.offset.x = (time * 0.024) % 1;
      waterMesh.material.map.offset.y = (time * 0.014) % 1;
    }
    waterMesh.position.y = getHeightAt(-205, -24, b) + 0.65;
  }
  for (const sp of smokePuffs) {
    const cycle = (time * 0.16 + sp.phase) % 1;
    sp.sprite.position.set(sp.baseX + Math.sin(time + sp.phase * 6) * 0.6 + cycle * 2.2, sp.baseY + cycle * 6.5, sp.baseZ);
    const sc = 1.1 + cycle * 2.2;
    sp.sprite.scale.set(sc, sc, 1);
    sp.sprite.material.opacity = Math.sin(cycle * Math.PI) * 0.45;
  }

  // 5. Calm spots, breath-synced static props, swaying dense grass & reeds
  for (const bp of breathSyncedProps) {
    bp.obj.position.y = bp.baseY + b * amp * bp.mask;
  }
  for (const cs of CALM_SPOTS) if (cs.mesh) cs.mesh.position.y = getHeightAt(cs.x, cs.z, b) + 0.36;
  const windPush = state.breath.exhaleFactor;
  for (const grp of swayMeshGroups) {
    const { mesh, items, baseAmp } = grp;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const y = getHeightAt(it.x, it.z, b) - 0.12;
      const swayZ = Math.sin(time * 2.1 + it.x * 0.22 + it.z * 0.15) * 0.08 - windPush * baseAmp * 1.5;
      tmpPos.set(it.x, y, it.z);
      tmpEuler.set(0, it.rot, swayZ);
      tmpQuat.setFromEuler(tmpEuler);
      tmpScale.set(it.s, it.s, it.s);
      tmpMat4.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // 5b. Live GPU Grass Field & Volumetric Sun Shafts update (wind gusts, breath heave, player bending, fog match!)
  if (forestGrassField) {
    const u = forestGrassField.uniforms;
    u.uTime.value = time;
    u.uBreath.value = b;
    u.uBreathAmp.value = amp;
    u.uWind.value = 0.22 + windPush * 0.95;
    if (state.player) u.uPlayerPos.value.set(state.player.x, state.player.y, state.player.z);
    if (scene.fog) {
      u.uFogColor.value.copy(scene.fog.color);
      u.uFogDensity.value = scene.fog.density;
    }
  }
  if (volumetricGodRays) {
    volumetricGodRays.uniforms.uTime.value = time;
  }

  // 6. Vines, wind-corridor ribbons, breath platforms, gate, giant eyelid, Puffs, butterflies, god-rays
  for (const ws of windStreamMeshes) {
    ws.x += (ws.speed * (0.35 + windPush * 2.2)) * dt;
    if (ws.x > ws.cor.xMax) ws.x = ws.cor.xMin;
    ws.mesh.position.set(ws.x, getHeightAt(ws.x, ws.z, b) + ws.yOff + Math.sin(time * 3 + ws.phase) * 0.35, ws.z);
    ws.mesh.material.opacity = 0.08 + windPush * 0.44;
    ws.mesh.scale.x = 0.7 + windPush * 0.9;
  }

  for (const v of vineObjects) {
    v.anchor.y = v.baseAnchorY + b * amp * v.mask;
    v.pivot.position.y = v.anchor.y;
    if (state.player?.attachedVine !== v) {
      const targetAngle = Math.sin(time * 1.25 + v.cfg.phaseOff * 6.28) * 0.22 + windPush * 0.42;
      v.angle += (targetAngle - v.angle) * Math.min(1, dt * 3.5);
    }
    v.pivot.rotation.z = v.angle;
    v.worldEnd.set(v.anchor.x + Math.sin(v.angle) * v.cfg.length, v.anchor.y - Math.cos(v.angle) * v.cfg.length, v.anchor.z);
    v.handleMat.emissiveIntensity = windPush > 0.25 ? 0.92 : 0.2;
  }

  for (const bp of breathPlatformObjs) {
    const isActive = bp.cfg.mode === 'exhale' ? !state.breath.inhaling : state.breath.inhaling;
    bp.active = isActive;
    bp.mesh.position.y = getHeightAt(bp.cfg.x, bp.cfg.z, b) + bp.cfg.yOff;
    bp.mat.opacity += ((isActive ? 0.96 : 0.22) - bp.mat.opacity) * Math.min(1, dt * 6);
    bp.mat.emissiveIntensity = isActive ? 0.45 : 0.05;
  }

  if (gateDoors && gateDoors.isOpen && gateDoors.openProgress < 1) {
    gateDoors.openProgress = Math.min(1, gateDoors.openProgress + dt * 0.55);
    const slide = gateDoors.openProgress * 5.6;
    gateDoors.left.position.z = -CAVERN_GATE.width * 0.25 - slide;
    gateDoors.right.position.z = CAVERN_GATE.width * 0.25 + slide;
  }

  if (giantEyelidGroup) {
    const restlessAmt = Math.max(0, (state.restlessness - 50) / 50);
    const flutter = restlessAmt > 0 ? Math.sin(time * (6 + restlessAmt * 12)) * restlessAmt * 0.08 : 0;
    giantEyelidGroup.position.y = getBaseHeightAt(285, 0) - 3 + b * 2.2 + restlessAmt * 1.6;
    giantEyelidGroup.rotation.z = restlessAmt * 0.14 + flutter;
  }

  for (const gr of godRayMeshes) {
    gr.mesh.material.opacity = 0.16 + Math.sin(time * 0.7 + gr.phase) * 0.06 + windPush * 0.05;
  }
  for (const pf of puffCreatures) {
    pf.group.position.y = getHeightAt(pf.homeX, pf.homeZ, b) + 0.95 + Math.abs(Math.sin(time * 1.4 + pf.phase)) * 0.14;
    pf.group.rotation.y = Math.sin(time * 0.5 + pf.phase) * 0.45;
  }
  for (const bf of butterflySprites) {
    const tPh = time * bf.spd + bf.phase;
    const bx = bf.baseX + Math.sin(tPh) * bf.radX;
    const bz = bf.baseZ + Math.sin(tPh * 1.7 + 0.8) * bf.radZ;
    const dx = bx - bf.group.position.x;
    const dz = bz - bf.group.position.z;
    const by = getHeightAt(bx, bz, b) + 2.4 + Math.sin(time * 2.8 + bf.phase) * 0.95;
    bf.group.position.set(bx, by, bz);
    if (Math.hypot(dx, dz) > 0.001) bf.group.rotation.y = Math.atan2(dx, dz);
    const flap = Math.sin(time * bf.flapSpd + bf.phase) * 0.95;
    bf.wingR.rotation.z = flap;
    bf.wingL.rotation.z = -flap;
  }
  if (fireflyPoints) {
    const pos = fireflyPoints.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + Math.sin(time * 1.6 + i) * dt * 0.35);
    pos.needsUpdate = true;
  }
  if (leafParticles) {
    const pos = leafParticles.geometry.attributes.position;
    const speed = 2.5 + windPush * 16.0;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + speed * dt;
      if (x > 25) x = -115;
      pos.setX(i, x);
      pos.setY(i, pos.getY(i) + Math.sin(time * 2.2 + i) * dt * 0.9);
    }
    pos.needsUpdate = true;
  }

  // 7. Ending 3,600-Flower Wave sweeping Crown -> Tail
  if (endingWaveProgress >= 0 && endingWaveProgress < 1.25 && endingFlowersMesh) {
    endingWaveProgress += dt * 0.11;
    const waveX = 300 - endingWaveProgress * 620;
    for (let i = 0; i < endingFlowerData.length; i++) {
      const f = endingFlowerData[i];
      const grow = smoothstep(waveX - 28, waveX + 28, f.x);
      if (grow > 0.01) {
        const sc = f.s * grow;
        tmpPos.set(f.x, getHeightAt(f.x, f.z, b) - 0.05, f.z);
        tmpEuler.set(0, f.rot, 0);
        tmpQuat.setFromEuler(tmpEuler);
        tmpScale.set(sc, sc, sc);
        tmpMat4.compose(tmpPos, tmpQuat, tmpScale);
        endingFlowersMesh.setMatrixAt(i, tmpMat4);
      }
    }
    endingFlowersMesh.instanceMatrix.needsUpdate = true;
  }
}
