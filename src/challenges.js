/**
 * Dreamback — 5 High-Impact Living-Giant Open-World Survival Challenges
 *  1. Giant Tremor       — Ground shockwave rings, leaping rock debris & glowing green Shelter Beacon!
 *  2. Colossal Sneeze    — 42 volumetric wind ribbons + 32 golden vortex leaves + inhale suction -> hurricane blast!
 *  3. Nightmare Eclipse  — Shadow pillars, multi-layered Nightmare Eyes & golden Lantern Banishment Dome (H)!
 *  4. Dream Meteors      — Skybeam warnings, blazing fire-tail meteors, impact explosions & glowing Star Shards!
 *  5. Sleep-Roll Tilt    — Dramatic ±11.5° horizon roll, glowing gravity-slide wave bands & tumbling moss-pebbles!
 *
 * Press 5, 6, 7, 8, 9 with ?debug=1 to trigger any challenge live on demand.
 */

import * as THREE from 'three';
import { CONFIG, CALM_SPOTS } from './data.js';
import { getHeightAt, getSolidColliders } from './world.js';
import { applyImpulse } from './player.js';
import { addRestlessness } from './interact.js';
import { getSprite } from './tex-bridge.js';
import { playPuzzleSuccess, playPuzzleWrong, playChimePulse, playJump } from './audio.js';

export const CHALLENGES = [
  {
    id: 'tremor',
    icon: '🌋',
    name: 'GIANT TREMOR',
    telegraphSec: 5.0,
    activeSec: 12.0,
    warn: 'Old Mother Hush is trembling! Rush to the green Shelter Beacon (Calm Spot, Cottage, or Rib Arch)!',
    activeHint: 'Stay inside a Calm Spot, Cottage doorway, or Rib Arch!',
    safeLabel: 'SHELTERED',
    exposedLabel: 'EXPOSED — SEEK SHELTER!',
  },
  {
    id: 'sneeze',
    icon: '🌪️',
    name: 'COLOSSAL SNEEZE GALE',
    telegraphSec: 5.0,
    activeSec: 8.5,
    warn: 'Massive sneeze building! Hide behind a Boulder, Tree, Cottage, or Calm Spot!',
    activeHint: 'Hold cover behind a Boulder, Tree, or Calm Spot!',
    safeLabel: 'BEHIND COVER',
    exposedLabel: 'EXPOSED — BLOWING AWAY!',
  },
  {
    id: 'eclipse',
    icon: '🌑',
    name: 'NIGHTMARE ECLIPSE',
    telegraphSec: 4.0,
    activeSec: 14.0,
    warn: 'Dark shadow-fog rolling in! Press H to unleash your Hush Lantern Dome & banish Wisps!',
    activeHint: 'Press H (Lantern Dome) to vaporize creeping Nightmare Wisps!',
    safeLabel: 'LANTERN LIT',
    exposedLabel: 'PRESS H TO BANISH WISPS!',
  },
  {
    id: 'meteors',
    icon: '🌠',
    name: 'DREAM METEOR SHOWER',
    telegraphSec: 4.0,
    activeSec: 14.0,
    warn: 'Falling dreams ahead! Dodge the skybeam impact rings & grab fallen Star Shards!',
    activeHint: 'Dodge glowing rings · Collect fallen Star Shards for speed!',
    safeLabel: 'CLEAR',
    exposedLabel: 'DODGE IMPACT RING!',
  },
  {
    id: 'roll',
    icon: '🌊',
    name: 'SLEEP-ROLL GRAVITY TILT',
    telegraphSec: 4.0,
    activeSec: 12.0,
    warn: 'The Giant is rolling sideways! Counter-steer uphill or anchor in a Calm Spot!',
    activeHint: 'Steer against the roll or anchor in a Calm Spot!',
    safeLabel: 'ANCHORED',
    exposedLabel: 'SLIDING — COUNTER-STEER!',
  },
];

let uiHooks = null;
let nextEventTimer = 26.0;
let lastChallengeIdx = -1;
let quakePulseTimer = 0;
let meteorSpawnTimer = 0;
let speedBoostTimer = 0;
let banishDomeTimer = 0;

// Rich 3D VFX Pools
let tremorShockRings = [];
let tremorDebris = [];
let shelterBeacon = null;

let galeStreaks = [];
let vortexLeaves = [];

let shadowPillars = [];
let nightmareWisps = [];
let banishDome = null;

let meteorSlots = [];
let impactBursts = [];
let starShards = [];

let rollWaves = [];
let rollPebbles = [];

const camFX = {
  shakeX: 0,
  shakeY: 0,
  rollZ: 0,
  fogBoost: 1.0,
  fogTint: null,
  fogTintStrength: 0,
};

export function getChallengeCameraFX() {
  return camFX;
}

export function getChallengeSpeedMult() {
  return speedBoostTimer > 0 ? 1.4 : 1.0;
}

function buildChallengeVFX(scene) {
  // 1. TREMOR: Expanding amber shockwave rings + 28 leaping rock/dust chunks + green Shelter Beacon
  tremorShockRings = [];
  const shockGeo = new THREE.RingGeometry(0.85, 1.0, 32);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      shockGeo,
      new THREE.MeshBasicMaterial({ color: '#FFC77A', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    tremorShockRings.push({ mesh: m, life: 0, maxLife: 1.2, x: 0, z: 0 });
  }

  tremorDebris = [];
  const debGeo = new THREE.DodecahedronGeometry(0.42, 0);
  const debMat = new THREE.MeshStandardMaterial({ color: '#9A8468', roughness: 0.9, flatShading: true });
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(debGeo, debMat);
    m.visible = false;
    scene.add(m);
    tremorDebris.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0 });
  }

  const beaconGeo = new THREE.CylinderGeometry(1.1, 2.2, 42, 16, 1, true);
  beaconGeo.translate(0, 21, 0);
  shelterBeacon = new THREE.Mesh(
    beaconGeo,
    new THREE.MeshBasicMaterial({ color: '#8FBF8F', transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  shelterBeacon.visible = false;
  scene.add(shelterBeacon);

  // 2. SNEEZE GALE: 42 high-visibility volumetric wind ribbons + 32 swirling golden vortex leaves
  galeStreaks = [];
  const streakMat = new THREE.MeshBasicMaterial({
    color: '#FFF6DE',
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const streakGeo = new THREE.PlaneGeometry(11.5, 0.38);
  for (let i = 0; i < 42; i++) {
    const m = new THREE.Mesh(streakGeo, streakMat);
    m.visible = false;
    scene.add(m);
    galeStreaks.push({
      mesh: m,
      ox: (Math.random() - 0.5) * 56,
      oy: 0.8 + Math.random() * 10.5,
      oz: (Math.random() - 0.5) * 44,
      spd: 34 + Math.random() * 24,
    });
  }

  vortexLeaves = [];
  const leafMat = new THREE.MeshBasicMaterial({ color: '#FFC77A', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const leafGeo = new THREE.PlaneGeometry(0.75, 0.45);
  for (let i = 0; i < 32; i++) {
    const m = new THREE.Mesh(leafGeo, leafMat);
    m.visible = false;
    scene.add(m);
    vortexLeaves.push({ mesh: m, angle: Math.random() * Math.PI * 2, rad: 4 + Math.random() * 18, yOff: 1 + Math.random() * 9, spd: 3 + Math.random() * 3 });
  }

  // 3. NIGHTMARE ECLIPSE: 10 dark-violet shadow pillars + 6 multi-layered Nightmare Eye Wisps + Golden Banishment Dome
  shadowPillars = [];
  const pilGeo = new THREE.CylinderGeometry(0.45, 1.45, 22, 8, 1, true);
  pilGeo.translate(0, 11, 0);
  const pilMat = new THREE.MeshBasicMaterial({ color: '#3B1868', transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(pilGeo, pilMat);
    m.visible = false;
    scene.add(m);
    shadowPillars.push({ mesh: m, angle: (i / 10) * Math.PI * 2, dist: 14 + (i % 3) * 7 });
  }

  nightmareWisps = [];
  const wispCoreGeo = new THREE.SphereGeometry(0.62, 10, 8);
  const wispCoreMat = new THREE.MeshBasicMaterial({ color: '#24093D' });
  const wispEyeGeo = new THREE.SphereGeometry(0.24, 8, 6);
  const wispEyeMat = new THREE.MeshBasicMaterial({ color: '#FF5CE1' });
  for (let i = 0; i < 6; i++) {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(wispCoreGeo, wispCoreMat);
    const eye = new THREE.Mesh(wispEyeGeo, wispEyeMat);
    eye.position.set(0, 0.1, 0.5);
    const halo = new THREE.Sprite(getSprite('fx.orb', '#C04DFF', true));
    halo.material = halo.material.clone();
    halo.material.color = new THREE.Color('#C04DFF');
    halo.scale.set(4.6, 4.6, 1);
    grp.add(core, eye, halo);
    grp.visible = false;
    scene.add(grp);
    nightmareWisps.push({ group: grp, active: false, hitCd: 0 });
  }

  banishDome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 22, 16),
    new THREE.MeshBasicMaterial({ color: '#FFE08A', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  banishDome.visible = false;
  scene.add(banishDome);

  // 4. DREAM METEORS: Target rings + vertical skybeams + blazing fire-tail meteors + explosion rings + Star Shards
  meteorSlots = [];
  const ringGeo = new THREE.RingGeometry(2.9, 3.65, 28);
  const innerGeo = new THREE.CircleGeometry(3.35, 28);
  const beamGeo = new THREE.CylinderGeometry(0.25, 1.4, 38, 10, 1, true);
  beamGeo.translate(0, 19, 0);
  const metGeo = new THREE.SphereGeometry(1.15, 12, 10);
  const tailGeo = new THREE.ConeGeometry(1.1, 7.5, 10);
  tailGeo.translate(0, 3.75, 0);

  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#FF6EA8', transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    const inner = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({ color: '#FFD984', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    inner.rotation.x = -Math.PI / 2;
    inner.visible = false;
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#FF9EC8', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.visible = false;

    const metGrp = new THREE.Group();
    const core = new THREE.Mesh(metGeo, new THREE.MeshBasicMaterial({ color: '#FFF4C2' }));
    const tail = new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({ color: '#FF7EB6', transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending }));
    tail.rotation.z = -0.18;
    const metHalo = new THREE.Sprite(getSprite('fx.halo.warm', '#FFD984', true));
    metHalo.scale.set(6.5, 6.5, 1);
    metGrp.add(core, tail, metHalo);
    metGrp.visible = false;

    scene.add(ring, inner, beam, metGrp);
    meteorSlots.push({ ring, inner, beam, metGrp, active: false, x: 0, z: 0, timer: 0, dur: 1.8 });
  }

  impactBursts = [];
  const burstGeo = new THREE.RingGeometry(0.7, 1.0, 28);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color: '#FFE08A', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    impactBursts.push({ mesh: m, life: 0, maxLife: 0.75, x: 0, z: 0 });
  }

  starShards = [];
  const shardGeo = new THREE.OctahedronGeometry(0.8, 0);
  const shardMat = new THREE.MeshStandardMaterial({ color: '#FFE8A0', emissive: '#FFC77A', emissiveIntensity: 2.0, roughness: 0.15 });
  for (let i = 0; i < 6; i++) {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(shardGeo, shardMat);
    const halo = new THREE.Sprite(getSprite('fx.sparkle', '#FFE08A', true));
    halo.scale.set(4.2, 4.2, 1);
    grp.add(m, halo);
    grp.visible = false;
    scene.add(grp);
    starShards.push({ group: grp, mesh: m, active: false, life: 0, x: 0, z: 0 });
  }

  // 5. SLEEP-ROLL TILT: 26 glowing cyan-gold gravity-slide wave bands + 20 tumbling moss-pebbles
  rollWaves = [];
  const waveGeo = new THREE.PlaneGeometry(14.0, 0.55);
  const waveMat = new THREE.MeshBasicMaterial({ color: '#8AE8DF', transparent: true, opacity: 0.52, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(waveGeo, waveMat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    rollWaves.push({ mesh: m, ox: (Math.random() - 0.5) * 48, oz: (Math.random() - 0.5) * 44, spd: 22 + Math.random() * 14 });
  }

  rollPebbles = [];
  const pebGeo = new THREE.DodecahedronGeometry(0.38, 0);
  const pebMat = new THREE.MeshStandardMaterial({ color: '#A5C79B', roughness: 0.85, flatShading: true });
  for (let i = 0; i < 20; i++) {
    const m = new THREE.Mesh(pebGeo, pebMat);
    m.visible = false;
    scene.add(m);
    rollPebbles.push({ mesh: m, ox: (Math.random() - 0.5) * 38, oz: (Math.random() - 0.5) * 36, spd: 16 + Math.random() * 10 });
  }
}

function clearVFX() {
  tremorShockRings.forEach((r) => { r.life = 0; r.mesh.visible = false; });
  tremorDebris.forEach((d) => { d.life = 0; d.mesh.visible = false; });
  if (shelterBeacon) shelterBeacon.visible = false;
  galeStreaks.forEach((g) => { g.mesh.visible = false; });
  vortexLeaves.forEach((l) => { l.mesh.visible = false; });
  shadowPillars.forEach((sp) => { sp.mesh.visible = false; });
  nightmareWisps.forEach((w) => { w.active = false; w.group.visible = false; });
  if (banishDome) { banishDome.visible = false; banishDomeTimer = 0; }
  meteorSlots.forEach((m) => { m.active = false; m.ring.visible = false; m.inner.visible = false; m.beam.visible = false; m.metGrp.visible = false; });
  impactBursts.forEach((b) => { b.life = 0; b.mesh.visible = false; });
  starShards.forEach((s) => { s.active = false; s.group.visible = false; });
  rollWaves.forEach((w) => { w.mesh.visible = false; });
  rollPebbles.forEach((p) => { p.mesh.visible = false; });

  camFX.shakeX = 0;
  camFX.shakeY = 0;
  camFX.rollZ = 0;
  camFX.fogBoost = 1.0;
  camFX.fogTint = null;
  camFX.fogTintStrength = 0;
}

export function initChallenges(scene, state, hooks) {
  uiHooks = hooks;
  state.challenge = null;
  nextEventTimer = 26.0;
  lastChallengeIdx = -1;
  speedBoostTimer = 0;
  buildChallengeVFX(scene);
}

export function resetChallenges(state) {
  state.challenge = null;
  nextEventTimer = 26.0;
  speedBoostTimer = 0;
  clearVFX();
}

export function triggerChallengeByIndex(idx, state) {
  const def = CHALLENGES[idx % CHALLENGES.length];
  if (!def || !state.player) return;
  clearVFX();
  lastChallengeIdx = idx % CHALLENGES.length;
  quakePulseTimer = 0.5;
  meteorSpawnTimer = 0.35;
  state.challenge = {
    id: def.id,
    def,
    phase: 'telegraph',
    timer: def.telegraphSec,
    elapsed: 0,
    safe: false,
    rollDir: Math.random() > 0.5 ? 1 : -1,
    banishedCount: 0,
  };
  playChimePulse(0.9);
  uiHooks?.showToast?.(`${def.icon} ${def.name}: ${def.warn}`, 4.6);
}

function isShelteredFromTremor(p, state) {
  if (state.inCalmSpot || p.climbing || p.attachedVine) return true;
  if (p.x > 38 && p.x < 172 && Math.abs(p.z) < 28) return true;
  for (const c of getSolidColliders()) {
    if (c.label === 'cottage' || c.label === 'lookout_tower') {
      if (Math.hypot(p.x - c.x, p.z - c.z) <= c.r + 6.0) return true;
    }
  }
  return false;
}

function isBehindWindCover(p, state) {
  if (state.inCalmSpot || p.climbing || p.attachedVine) return true;
  for (const c of getSolidColliders()) {
    if (c.label === 'cottage' || c.label === 'lookout_tower' || c.label === 'boulder' || c.label === 'tree' || c.label === 'rib_base') {
      const r = c.r || 1.2;
      if (Math.hypot(p.x - c.x, p.z - c.z) <= r + 4.8) return true;
    }
  }
  return false;
}

function findNearestCalmSpot(p) {
  let best = CALM_SPOTS[0];
  let bestD = Infinity;
  for (const cs of CALM_SPOTS) {
    const d = Math.hypot(p.x - cs.x, p.z - cs.z);
    if (d < bestD) { bestD = d; best = cs; }
  }
  return best;
}

function spawnShockRing(x, z) {
  const slot = tremorShockRings.find((r) => r.life <= 0);
  if (!slot) return;
  slot.x = x;
  slot.z = z;
  slot.life = slot.maxLife;
  slot.mesh.visible = true;
}

function spawnImpactBurst(x, z) {
  const slot = impactBursts.find((b) => b.life <= 0);
  if (!slot) return;
  slot.x = x;
  slot.z = z;
  slot.life = slot.maxLife;
  slot.mesh.visible = true;
}

export function onLanternPulseChallenges(state) {
  const ch = state.challenge;
  if (!ch || ch.id !== 'eclipse' || !state.player) return;
  const p = state.player;
  banishDomeTimer = 0.95;
  if (banishDome) {
    banishDome.visible = true;
    banishDome.position.set(p.x, p.y + 1.0, p.z);
    banishDome.scale.setScalar(1.5);
  }
  if (ch.phase !== 'active') return;
  let banished = 0;
  for (const w of nightmareWisps) {
    if (!w.active) continue;
    const d = Math.hypot(p.x - w.group.position.x, p.z - w.group.position.z);
    if (d <= CONFIG.lantern.radius + 6) {
      spawnImpactBurst(w.group.position.x, w.group.position.z);
      w.active = false;
      w.group.visible = false;
      banished++;
      ch.banishedCount++;
    }
  }
  if (banished > 0) {
    addRestlessness(state, -4 * banished, 'banish_wisp');
    playPuzzleSuccess();
    uiHooks?.showToast?.(`Lantern Dome vaporized ${banished} Nightmare Wisp${banished > 1 ? 's' : ''}!`, 2.4);
  }
}

export function updateChallenges(dt, state) {
  if (speedBoostTimer > 0) speedBoostTimer = Math.max(0, speedBoostTimer - dt);

  const p = state.player;
  const b = state.breath ? state.breath.value : 0;
  const t = state.breath ? state.breath.t : 0;

  // Update persistent impact bursts & banish dome even between frames
  for (const ib of impactBursts) {
    if (ib.life <= 0) continue;
    ib.life -= dt;
    const prog = 1 - Math.max(0, ib.life / ib.maxLife);
    ib.mesh.position.set(ib.x, getHeightAt(ib.x, ib.z, b) + 0.3, ib.z);
    ib.mesh.scale.setScalar(1.2 + prog * 9.5);
    ib.mesh.material.opacity = (1 - prog) * 0.9;
    if (ib.life <= 0) ib.mesh.visible = false;
  }
  if (banishDomeTimer > 0 && banishDome && p) {
    banishDomeTimer -= dt;
    const prog = 1 - Math.max(0, banishDomeTimer / 0.95);
    banishDome.position.set(p.x, p.y + 1.0, p.z);
    banishDome.scale.setScalar(2.0 + prog * 28.0);
    banishDome.material.opacity = (1 - prog) * 0.38;
    if (banishDomeTimer <= 0) banishDome.visible = false;
  }

  if (state.mode !== 'play' || state.dialogueActive || state.surge?.active) {
    camFX.shakeX *= Math.exp(-dt * 8);
    camFX.shakeY *= Math.exp(-dt * 8);
    camFX.rollZ *= Math.exp(-dt * 5);
    camFX.fogBoost += (1.0 - camFX.fogBoost) * Math.min(1, dt * 4);
    camFX.fogTintStrength *= Math.exp(-dt * 4);
    return;
  }
  if (!p) return;

  // Collectible Star Shards
  for (const s of starShards) {
    if (!s.active) continue;
    s.life -= dt;
    s.mesh.rotation.y += dt * 3.4;
    s.mesh.rotation.x += dt * 1.8;
    s.group.position.set(s.x, getHeightAt(s.x, s.z, b) + 1.2 + Math.sin(t * 5) * 0.3, s.z);
    if (Math.hypot(p.x - s.x, p.z - s.z) < 2.6) {
      s.active = false;
      s.group.visible = false;
      spawnImpactBurst(s.x, s.z);
      addRestlessness(state, -6, 'star_shard');
      speedBoostTimer = 3.5;
      playPuzzleSuccess();
      uiHooks?.showToast?.('Star Shard collected! Calm restored & swift stride!', 2.4);
    } else if (s.life <= 0) {
      s.active = false;
      s.group.visible = false;
    }
  }

  // Schedule next random challenge in open-world free roam
  if (!state.challenge) {
    camFX.shakeX *= Math.exp(-dt * 8);
    camFX.shakeY *= Math.exp(-dt * 8);
    camFX.rollZ *= Math.exp(-dt * 4);
    camFX.fogBoost += (1.0 - camFX.fogBoost) * Math.min(1, dt * 3);
    camFX.fogTintStrength *= Math.exp(-dt * 3);

    nextEventTimer -= dt;
    if (nextEventTimer <= 0) {
      let nextIdx = Math.floor(Math.random() * CHALLENGES.length);
      if (nextIdx === lastChallengeIdx) nextIdx = (nextIdx + 1) % CHALLENGES.length;
      triggerChallengeByIndex(nextIdx, state);
      nextEventTimer = 36 + Math.random() * 14;
    }
    return;
  }

  const ch = state.challenge;
  ch.timer -= dt;
  ch.elapsed += dt;

  // Transition telegraph -> active
  if (ch.phase === 'telegraph' && ch.timer <= 0) {
    ch.phase = 'active';
    ch.timer = ch.def.activeSec;
    ch.elapsed = 0;

    if (ch.id === 'eclipse') {
      nightmareWisps.forEach((w, i) => {
        const a = (i / nightmareWisps.length) * Math.PI * 2;
        const rad = 18 + (i % 2) * 6;
        const wx = Math.max(CONFIG.world.minX + 6, Math.min(CONFIG.world.maxX - 6, p.x + Math.cos(a) * rad));
        const wz = Math.max(CONFIG.world.minZ + 6, Math.min(CONFIG.world.maxZ - 6, p.z + Math.sin(a) * rad));
        w.group.position.set(wx, getHeightAt(wx, wz, b) + 2.3, wz);
        w.group.visible = true;
        w.active = true;
        w.hitCd = 0;
      });
    }
  }

  // Complete challenge
  if (ch.phase === 'active' && ch.timer <= 0) {
    const survivedSafe = ch.safe || ch.id === 'meteors' || ch.id === 'eclipse';
    clearVFX();
    state.challenge = null;
    nextEventTimer = 34 + Math.random() * 14;
    if (survivedSafe) {
      addRestlessness(state, -8, 'challenge_survived');
      playPuzzleSuccess();
      uiHooks?.showToast?.(`${ch.def.icon} ${ch.def.name} passed! Old Mother Hush settles (-8% restlessness).`, 3.6);
    }
    return;
  }

  // ================= PER-CHALLENGE SPECTACULAR VFX & MECHANICS =================
  if (ch.id === 'tremor') {
    ch.safe = isShelteredFromTremor(p, state);
    const isAct = ch.phase === 'active';
    const amp = isAct ? 0.82 : 0.24;
    camFX.shakeX = (Math.sin(t * 41) + Math.cos(t * 27)) * amp;
    camFX.shakeY = Math.sin(t * 47) * amp * 0.85;
    camFX.fogTint = new THREE.Color('#D4A36A');
    camFX.fogTintStrength = isAct ? 0.28 : 0.12;

    // Glowing green Shelter Beacon over nearest Calm Spot!
    if (shelterBeacon) {
      const cs = findNearestCalmSpot(p);
      shelterBeacon.visible = !ch.safe;
      shelterBeacon.position.set(cs.x, getHeightAt(cs.x, cs.z, b) - 0.5, cs.z);
      shelterBeacon.material.opacity = 0.24 + Math.sin(t * 6) * 0.12;
    }

    // Expanding ground shockwave rings
    for (const r of tremorShockRings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const prog = 1 - Math.max(0, r.life / r.maxLife);
      r.mesh.position.set(r.x, getHeightAt(r.x, r.z, b) + 0.35, r.z);
      r.mesh.scale.setScalar(2.0 + prog * 26.0);
      r.mesh.material.opacity = (1 - prog) * 0.78;
      if (r.life <= 0) r.mesh.visible = false;
    }

    // Leaping rock debris chunks
    for (const d of tremorDebris) {
      if (d.life <= 0 && Math.random() < dt * (isAct ? 14 : 4)) {
        const ang = Math.random() * Math.PI * 2;
        const rad = 3 + Math.random() * 18;
        const dx = p.x + Math.cos(ang) * rad;
        const dz = p.z + Math.sin(ang) * rad;
        d.mesh.position.set(dx, getHeightAt(dx, dz, b) + 0.2, dz);
        d.vx = (Math.random() - 0.5) * 6;
        d.vy = 7 + Math.random() * 9;
        d.vz = (Math.random() - 0.5) * 6;
        d.life = 1.1;
        d.mesh.visible = true;
      }
      if (d.life > 0) {
        d.life -= dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        d.vy -= 22 * dt;
        d.mesh.rotation.x += dt * 7;
        d.mesh.rotation.z += dt * 5;
        if (d.life <= 0) d.mesh.visible = false;
      }
    }

    quakePulseTimer -= dt;
    if (quakePulseTimer <= 0) {
      quakePulseTimer = isAct ? 1.45 : 2.2;
      spawnShockRing(p.x, p.z);
      if (isAct && !ch.safe && p.grounded) {
        applyImpulse(state, (Math.random() - 0.5) * 7, 7.6, (Math.random() - 0.5) * 7);
        playJump();
      }
    }
    if (isAct && !ch.safe) addRestlessness(state, 3.0 * dt, 'tremor_exposed');

  } else if (ch.id === 'sneeze') {
    ch.safe = isBehindWindCover(p, state);
    const isBlast = ch.phase === 'active';
    camFX.fogTint = new THREE.Color('#F2C879');
    camFX.fogTintStrength = isBlast ? 0.42 : 0.18;
    camFX.shakeX = isBlast ? Math.sin(t * 34) * 0.42 : Math.sin(t * 12) * 0.08;

    const dir = isBlast ? 1 : -0.42;
    for (const g of galeStreaks) {
      g.mesh.visible = true;
      g.mesh.rotation.y = 0;
      g.ox += dir * g.spd * dt;
      if (g.ox > 28) g.ox = -28;
      if (g.ox < -28) g.ox = 28;
      const gx = p.x + g.ox;
      const gz = p.z + g.oz;
      g.mesh.position.set(gx, getHeightAt(gx, gz, b) + g.oy, gz);
    }

    for (const l of vortexLeaves) {
      l.mesh.visible = true;
      l.angle += dt * (isBlast ? l.spd * 2.4 : -l.spd);
      const lx = p.x + Math.cos(l.angle) * l.rad + (isBlast ? 4 : -2);
      const lz = p.z + Math.sin(l.angle) * l.rad;
      l.mesh.position.set(lx, getHeightAt(lx, lz, b) + l.yOff + Math.sin(t * 5 + l.angle) * 1.2, lz);
      l.mesh.rotation.set(t * 6, l.angle, t * 4);
    }

    if (!ch.safe) {
      if (ch.phase === 'telegraph') {
        p.vx -= 6.5 * dt;
      } else {
        p.vx += 30.0 * dt;
        if (p.grounded && Math.random() < dt * 1.5) p.vy = 5.8;
        addRestlessness(state, 2.2 * dt, 'sneeze_exposed');
      }
    }

  } else if (ch.id === 'eclipse') {
    ch.safe = state.lantern.pulseTimer > 0 || state.inCalmSpot;
    if (state.lantern.cooldown > 1.5) state.lantern.cooldown = 1.5;
    const targetFog = ch.phase === 'active' ? (state.lantern.pulseTimer > 0 ? 1.2 : 2.85) : 1.9;
    camFX.fogBoost += (targetFog - camFX.fogBoost) * Math.min(1, dt * 3.8);
    camFX.fogTint = new THREE.Color('#191138');
    camFX.fogTintStrength = ch.phase === 'active' ? 0.78 : 0.45;

    // Eerie rotating shadow-tendril pillars around the horizon
    for (const sp of shadowPillars) {
      sp.mesh.visible = true;
      sp.angle += dt * 0.16;
      const sx = p.x + Math.cos(sp.angle) * sp.dist;
      const sz = p.z + Math.sin(sp.angle) * sp.dist;
      sp.mesh.position.set(sx, getHeightAt(sx, sz, b) - 0.5, sz);
      sp.mesh.scale.set(1, 0.8 + Math.sin(t * 3 + sp.angle * 4) * 0.25, 1);
    }

    if (ch.phase === 'active') {
      for (const w of nightmareWisps) {
        if (!w.active) continue;
        if (w.hitCd > 0) w.hitCd -= dt;
        const dx = p.x - w.group.position.x;
        const dz = p.z - w.group.position.z;
        const d = Math.max(0.1, Math.hypot(dx, dz));
        w.group.position.x += (dx / d) * 4.8 * dt;
        w.group.position.z += (dz / d) * 4.8 * dt;
        w.group.position.y = getHeightAt(w.group.position.x, w.group.position.z, b) + 2.2 + Math.sin(t * 5 + d) * 0.45;
        w.group.rotation.y = Math.atan2(dx, dz);

        if (w.hitCd <= 0 && d < 2.3) {
          w.hitCd = 2.0;
          applyImpulse(state, (dx / d) * 10, 6.5, (dz / d) * 10);
          addRestlessness(state, 7, 'eclipse_wisp');
          playPuzzleWrong();
        }
      }
    }

  } else if (ch.id === 'meteors') {
    camFX.fogTint = new THREE.Color('#F29EC0');
    camFX.fogTintStrength = 0.28;

    if (ch.phase === 'active') {
      meteorSpawnTimer -= dt;
      if (meteorSpawnTimer <= 0) {
        meteorSpawnTimer = 1.25;
        const slot = meteorSlots.find((m) => !m.active);
        if (slot) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() < 0.45 ? 1.5 + Math.random() * 4.5 : 5 + Math.random() * 11;
          slot.x = Math.max(CONFIG.world.minX + 6, Math.min(CONFIG.world.maxX - 6, p.x + Math.cos(ang) * dist));
          slot.z = Math.max(CONFIG.world.minZ + 6, Math.min(CONFIG.world.maxZ - 6, p.z + Math.sin(ang) * dist));
          slot.timer = slot.dur;
          slot.active = true;
          slot.ring.visible = true;
          slot.inner.visible = true;
          slot.beam.visible = true;
          slot.metGrp.visible = true;
        }
      }
    }

    let inDangerRing = false;
    for (const m of meteorSlots) {
      if (!m.active) continue;
      m.timer -= dt;
      const frac = Math.max(0, 1 - m.timer / m.dur);
      const gy = getHeightAt(m.x, m.z, b);
      m.ring.position.set(m.x, gy + 0.26, m.z);
      m.inner.position.set(m.x, gy + 0.28, m.z);
      m.inner.scale.setScalar(Math.max(0.06, frac));
      m.beam.position.set(m.x, gy, m.z);
      m.beam.material.opacity = 0.14 + frac * 0.34;
      m.metGrp.position.set(m.x + (1 - frac) * 8, gy + 0.9 + (1 - frac) * 38, m.z);

      const dPip = Math.hypot(p.x - m.x, p.z - m.z);
      if (dPip < 3.65) inDangerRing = true;

      if (m.timer <= 0) {
        m.active = false;
        m.ring.visible = false;
        m.inner.visible = false;
        m.beam.visible = false;
        m.metGrp.visible = false;
        camFX.shakeY = 0.55;
        spawnImpactBurst(m.x, m.z);

        if (dPip < 3.65) {
          const dx = p.x - m.x, dz = p.z - m.z;
          const dl = Math.max(0.1, Math.hypot(dx, dz));
          applyImpulse(state, (dx / dl) * 12, 9.0, (dz / dl) * 12);
          addRestlessness(state, 8, 'meteor_hit');
          playPuzzleWrong();
        } else {
          const shard = starShards.find((s) => !s.active);
          if (shard) {
            shard.x = m.x;
            shard.z = m.z;
            shard.life = 7.5;
            shard.active = true;
            shard.group.position.set(m.x, gy + 1.2, m.z);
            shard.group.visible = true;
          }
        }
      }
    }
    ch.safe = !inDangerRing;

  } else if (ch.id === 'roll') {
    const anchored = state.inCalmSpot || Boolean(p.climbing) || Boolean(p.attachedVine);
    ch.safe = anchored;
    const half = ch.phase === 'active' && ch.elapsed > ch.def.activeSec * 0.52 ? -1 : 1;
    const dir = ch.rollDir * half;
    const targetRoll = (ch.phase === 'telegraph' ? 0.07 : 0.20) * dir; // Unmistakable ±11.5° tilt!
    camFX.rollZ += (targetRoll - camFX.rollZ) * Math.min(1, dt * 3.2);
    camFX.fogTint = new THREE.Color('#7AD4CC');
    camFX.fogTintStrength = ch.phase === 'active' ? 0.26 : 0.12;

    // Glowing gravity-slide wave bands sweeping downhill
    for (const w of rollWaves) {
      w.mesh.visible = true;
      w.oz += dir * w.spd * dt;
      if (w.oz > 24) w.oz = -24;
      if (w.oz < -24) w.oz = 24;
      const wx = p.x + w.ox;
      const wz = p.z + w.oz;
      w.mesh.position.set(wx, getHeightAt(wx, wz, b) + 0.45, wz);
    }

    // Tumbling moss-pebbles rolling sideways across the Giant's back
    for (const pb of rollPebbles) {
      pb.mesh.visible = true;
      pb.oz += dir * pb.spd * dt;
      if (pb.oz > 20) pb.oz = -20;
      if (pb.oz < -20) pb.oz = 20;
      const px = p.x + pb.ox;
      const pz = p.z + pb.oz;
      pb.mesh.position.set(px, getHeightAt(px, pz, b) + 0.4, pz);
      pb.mesh.rotation.x += dir * dt * 10;
    }

    if (ch.phase === 'active' && !anchored) {
      p.vz += dir * 14.5 * dt;
    }
  }
}
