/**
 * Dreamback — 5 Dynamic Living-Giant Open-World Survival Challenges
 *  1. Giant Tremor       — Get inside a Calm Spot, Cottage doorway, or Rib Arch!
 *  2. Colossal Sneeze    — Brace behind a Boulder, Tree, Cottage, or Calm Spot!
 *  3. Nightmare Eclipse  — Press H (Hush Lantern) to banish creeping Nightmare Wisps!
 *  4. Dream Meteors      — Dodge glowing impact rings & grab fallen Star Shards!
 *  5. Sleep-Roll Tilt    — Counter-steer the Giant's sideways gravity roll or anchor in a Calm Spot!
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
    warn: 'Old Mother Hush is trembling! Get inside a Calm Spot, Cottage doorway, or Rib Arch!',
    activeHint: 'Stay inside a Calm Spot, Cottage, or Rib Arch!',
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
    warn: 'Dark dream-fog rolling in! Press H to pulse your Hush Lantern & banish Wisps!',
    activeHint: 'Press H (Lantern) to banish creeping Nightmare Wisps!',
    safeLabel: 'LANTERN LIT',
    exposedLabel: 'PRESS H TO BANISH WISPS!',
  },
  {
    id: 'meteors',
    icon: '🌠',
    name: 'DREAM METEOR SHOWER',
    telegraphSec: 4.0,
    activeSec: 14.0,
    warn: 'Falling dreams ahead! Dodge the glowing impact rings & grab fallen Star Shards!',
    activeHint: 'Dodge glowing rings · Collect fallen Star Shards!',
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

let sceneRef = null;
let uiHooks = null;
let nextEventTimer = 26.0;
let lastChallengeIdx = -1;
let quakePulseTimer = 0;
let meteorSpawnTimer = 0;
let speedBoostTimer = 0;

// Reusable 3D VFX pools
let galeStreaks = [];
let nightmareWisps = [];
let meteorSlots = [];
let starShards = [];

const camFX = {
  shakeX: 0,
  shakeY: 0,
  rollZ: 0,
  fogBoost: 1.0,
  fogTint: null, // THREE.Color or null
  fogTintStrength: 0,
};

export function getChallengeCameraFX() {
  return camFX;
}

export function getChallengeSpeedMult() {
  return speedBoostTimer > 0 ? 1.38 : 1.0;
}

function buildChallengeVFX(scene) {
  // 1. Gale wind-streak planes (for Sneeze & Roll)
  galeStreaks = [];
  const streakMat = new THREE.MeshBasicMaterial({
    color: '#FFF4DC',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const streakGeo = new THREE.PlaneGeometry(8.0, 0.22);
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(streakGeo, streakMat);
    m.visible = false;
    scene.add(m);
    galeStreaks.push({ mesh: m, ox: (Math.random() - 0.5) * 44, oy: 1.0 + Math.random() * 7.5, oz: (Math.random() - 0.5) * 32, spd: 28 + Math.random() * 18 });
  }

  // 2. Nightmare Wisps (for Eclipse)
  nightmareWisps = [];
  const wispMat = getSprite('fx.orb', '#A855F7', true);
  wispMat.color = new THREE.Color('#B45CFF');
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(wispMat.clone());
    sp.scale.set(3.2, 3.2, 1);
    sp.visible = false;
    scene.add(sp);
    nightmareWisps.push({ sprite: sp, active: false, hitCd: 0 });
  }

  // 3. Dream Meteor impact rings + falling meteor spheres + collectible Star Shards
  meteorSlots = [];
  const ringGeo = new THREE.RingGeometry(2.8, 3.45, 24);
  const innerGeo = new THREE.CircleGeometry(3.2, 24);
  const metGeo = new THREE.SphereGeometry(0.95, 10, 8);
  for (let i = 0; i < 6; i++) {
    const ringMat = new THREE.MeshBasicMaterial({ color: '#FF7EB6', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const innerMat = new THREE.MeshBasicMaterial({ color: '#FFD984', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.visible = false;
    const met = new THREE.Mesh(metGeo, new THREE.MeshBasicMaterial({ color: '#FFE8A3' }));
    met.visible = false;
    scene.add(ring, inner, met);
    meteorSlots.push({ ring, inner, met, active: false, x: 0, z: 0, timer: 0, dur: 1.8 });
  }

  starShards = [];
  const shardGeo = new THREE.OctahedronGeometry(0.65, 0);
  const shardMat = new THREE.MeshStandardMaterial({ color: '#FFE08A', emissive: '#FFC77A', emissiveIntensity: 1.6, roughness: 0.2 });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(shardGeo, shardMat);
    m.visible = false;
    scene.add(m);
    starShards.push({ mesh: m, active: false, life: 0, x: 0, z: 0 });
  }
}

function clearVFX() {
  galeStreaks.forEach((g) => { g.mesh.visible = false; });
  nightmareWisps.forEach((w) => { w.active = false; w.sprite.visible = false; });
  meteorSlots.forEach((m) => { m.active = false; m.ring.visible = false; m.inner.visible = false; m.met.visible = false; });
  starShards.forEach((s) => { s.active = false; s.mesh.visible = false; });
  camFX.shakeX = 0;
  camFX.shakeY = 0;
  camFX.rollZ = 0;
  camFX.fogBoost = 1.0;
  camFX.fogTint = null;
  camFX.fogTintStrength = 0;
}

export function initChallenges(scene, state, hooks) {
  sceneRef = scene;
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
  quakePulseTimer = 0.6;
  meteorSpawnTimer = 0.4;
  state.challenge = {
    id: def.id,
    def,
    phase: 'telegraph', // telegraph | active
    timer: def.telegraphSec,
    elapsed: 0,
    safe: false,
    rollDir: Math.random() > 0.5 ? 1 : -1,
    banishedCount: 0,
  };
  playChimePulse(0.8);
  uiHooks?.showToast?.(`${def.icon} ${def.name}: ${def.warn}`, 4.5);
}

function isShelteredFromTremor(p, state) {
  if (state.inCalmSpot || p.climbing || p.attachedVine) return true;
  // Under Rib Caverns arches
  if (p.x > 38 && p.x < 172 && Math.abs(p.z) < 28) return true;
  // Near any Cottage or Lookout Tower doorway
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

export function onLanternPulseChallenges(state) {
  const ch = state.challenge;
  if (!ch || ch.id !== 'eclipse' || ch.phase !== 'active' || !state.player) return;
  const p = state.player;
  let banished = 0;
  for (const w of nightmareWisps) {
    if (!w.active) continue;
    const d = Math.hypot(p.x - w.sprite.position.x, p.z - w.sprite.position.z);
    if (d <= CONFIG.lantern.radius + 4) {
      w.active = false;
      w.sprite.visible = false;
      banished++;
      ch.banishedCount++;
    }
  }
  if (banished > 0) {
    addRestlessness(state, -4 * banished, 'banish_wisp');
    playPuzzleSuccess();
    uiHooks?.showToast?.(`Lantern pulse banished ${banished} Nightmare Wisp${banished > 1 ? 's' : ''}!`, 2.4);
  }
}

export function updateChallenges(dt, state) {
  if (speedBoostTimer > 0) speedBoostTimer = Math.max(0, speedBoostTimer - dt);

  // Smoothly decay camera FX when no challenge is active
  if (state.mode !== 'play' || state.dialogueActive || state.surge?.active) {
    camFX.shakeX *= Math.exp(-dt * 8);
    camFX.shakeY *= Math.exp(-dt * 8);
    camFX.rollZ *= Math.exp(-dt * 5);
    camFX.fogBoost += (1.0 - camFX.fogBoost) * Math.min(1, dt * 4);
    camFX.fogTintStrength *= Math.exp(-dt * 4);
    return;
  }

  const p = state.player;
  if (!p) return;
  const b = state.breath.value;
  const t = state.breath.t;

  // Star shards persist briefly even right after meteor shower ends
  for (const s of starShards) {
    if (!s.active) continue;
    s.life -= dt;
    s.mesh.rotation.y += dt * 3.0;
    s.mesh.position.y = getHeightAt(s.x, s.z, b) + 1.1 + Math.sin(t * 5) * 0.25;
    if (Math.hypot(p.x - s.x, p.z - s.z) < 2.4) {
      s.active = false;
      s.mesh.visible = false;
      addRestlessness(state, -6, 'star_shard');
      speedBoostTimer = 3.2;
      playPuzzleSuccess();
      uiHooks?.showToast?.('Star Shard collected! Calm restored & swift stride!', 2.2);
    } else if (s.life <= 0) {
      s.active = false;
      s.mesh.visible = false;
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
      // Spawn 6 Nightmare Wisps in a ring around Pip
      nightmareWisps.forEach((w, i) => {
        const a = (i / nightmareWisps.length) * Math.PI * 2;
        const rad = 18 + (i % 2) * 6;
        const wx = Math.max(CONFIG.world.minX + 4, Math.min(CONFIG.world.maxX - 4, p.x + Math.cos(a) * rad));
        const wz = Math.max(CONFIG.world.minZ + 4, Math.min(CONFIG.world.maxZ - 4, p.z + Math.sin(a) * rad));
        w.sprite.position.set(wx, getHeightAt(wx, wz, b) + 2.2, wz);
        w.sprite.visible = true;
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

  // --- Per-Challenge Mechanics & VFX ---
  if (ch.id === 'tremor') {
    ch.safe = isShelteredFromTremor(p, state);
    const amp = ch.phase === 'telegraph' ? 0.16 : 0.62;
    camFX.shakeX = (Math.sin(t * 37) + Math.cos(t * 23)) * amp;
    camFX.shakeY = Math.sin(t * 43) * amp * 0.75;

    if (ch.phase === 'active' && !ch.safe) {
      addRestlessness(state, 3.0 * dt, 'tremor_exposed');
      quakePulseTimer -= dt;
      if (quakePulseTimer <= 0 && p.grounded) {
        quakePulseTimer = 1.65;
        applyImpulse(state, (Math.random() - 0.5) * 6, 7.2, (Math.random() - 0.5) * 6);
        playJump();
      }
    }
  } else if (ch.id === 'sneeze') {
    ch.safe = isBehindWindCover(p, state);
    const isBlast = ch.phase === 'active';
    camFX.fogTint = new THREE.Color('#F2C879');
    camFX.fogTintStrength = isBlast ? 0.34 : 0.14;
    camFX.shakeX = isBlast ? Math.sin(t * 29) * 0.28 : 0;

    // Animate wind streaks across Pip's view
    const dir = isBlast ? 1 : -0.35;
    for (const g of galeStreaks) {
      g.mesh.visible = true;
      g.mesh.rotation.y = 0;
      g.ox += dir * g.spd * dt;
      if (g.ox > 24) g.ox = -24;
      if (g.ox < -24) g.ox = 24;
      const gx = p.x + g.ox;
      const gz = p.z + g.oz;
      g.mesh.position.set(gx, getHeightAt(gx, gz, b) + g.oy, gz);
    }

    if (!ch.safe) {
      if (ch.phase === 'telegraph') {
        p.vx -= 5.5 * dt; // Deep inhale suction!
      } else {
        p.vx += 28.0 * dt; // Colossal eastward sneeze gale!
        if (p.grounded && Math.random() < dt * 1.4) p.vy = 5.5;
        addRestlessness(state, 2.2 * dt, 'sneeze_exposed');
      }
    }
  } else if (ch.id === 'eclipse') {
    ch.safe = state.lantern.pulseTimer > 0 || state.inCalmSpot;
    // Allow faster Lantern pulsing during Eclipse!
    if (state.lantern.cooldown > 1.6) state.lantern.cooldown = 1.6;
    const targetFog = ch.phase === 'active' ? (state.lantern.pulseTimer > 0 ? 1.25 : 2.55) : 1.75;
    camFX.fogBoost += (targetFog - camFX.fogBoost) * Math.min(1, dt * 3.5);
    camFX.fogTint = new THREE.Color('#1E1842');
    camFX.fogTintStrength = ch.phase === 'active' ? 0.68 : 0.38;

    if (ch.phase === 'active') {
      for (const w of nightmareWisps) {
        if (!w.active) continue;
        if (w.hitCd > 0) w.hitCd -= dt;
        const dx = p.x - w.sprite.position.x;
        const dz = p.z - w.sprite.position.z;
        const d = Math.max(0.1, Math.hypot(dx, dz));
        const spd = 4.6;
        w.sprite.position.x += (dx / d) * spd * dt;
        w.sprite.position.z += (dz / d) * spd * dt;
        w.sprite.position.y = getHeightAt(w.sprite.position.x, w.sprite.position.z, b) + 2.1 + Math.sin(t * 4 + d) * 0.4;

        if (w.hitCd <= 0 && d < 2.2) {
          w.hitCd = 2.0;
          applyImpulse(state, (dx / d) * 9, 6.0, (dz / d) * 9);
          addRestlessness(state, 7, 'eclipse_wisp');
          playPuzzleWrong();
        }
      }
    }
  } else if (ch.id === 'meteors') {
    camFX.fogTint = new THREE.Color('#F6B8C8');
    camFX.fogTintStrength = 0.22;

    if (ch.phase === 'active') {
      meteorSpawnTimer -= dt;
      if (meteorSpawnTimer <= 0) {
        meteorSpawnTimer = 1.45;
        const slot = meteorSlots.find((m) => !m.active);
        if (slot) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() < 0.45 ? 1.5 + Math.random() * 4.5 : 5 + Math.random() * 10;
          slot.x = Math.max(CONFIG.world.minX + 6, Math.min(CONFIG.world.maxX - 6, p.x + Math.cos(ang) * dist));
          slot.z = Math.max(CONFIG.world.minZ + 6, Math.min(CONFIG.world.maxZ - 6, p.z + Math.sin(ang) * dist));
          slot.timer = slot.dur;
          slot.active = true;
          slot.ring.visible = true;
          slot.inner.visible = true;
          slot.met.visible = true;
        }
      }
    }

    let inDangerRing = false;
    for (const m of meteorSlots) {
      if (!m.active) continue;
      m.timer -= dt;
      const frac = Math.max(0, 1 - m.timer / m.dur);
      const gy = getHeightAt(m.x, m.z, b);
      m.ring.position.set(m.x, gy + 0.22, m.z);
      m.inner.position.set(m.x, gy + 0.24, m.z);
      m.inner.scale.setScalar(Math.max(0.05, frac));
      m.met.position.set(m.x + (1 - frac) * 6, gy + 0.8 + (1 - frac) * 32, m.z);

      const dPip = Math.hypot(p.x - m.x, p.z - m.z);
      if (dPip < 3.45) inDangerRing = true;

      if (m.timer <= 0) {
        m.active = false;
        m.ring.visible = false;
        m.inner.visible = false;
        m.met.visible = false;
        camFX.shakeY = 0.4;

        if (dPip < 3.45) {
          const dx = p.x - m.x, dz = p.z - m.z;
          const dl = Math.max(0.1, Math.hypot(dx, dz));
          applyImpulse(state, (dx / dl) * 11, 8.5, (dz / dl) * 11);
          addRestlessness(state, 8, 'meteor_hit');
          playPuzzleWrong();
        } else {
          // Spawn collectible Star Shard at impact site!
          const shard = starShards.find((s) => !s.active);
          if (shard) {
            shard.x = m.x;
            shard.z = m.z;
            shard.life = 7.0;
            shard.active = true;
            shard.mesh.position.set(m.x, gy + 1.1, m.z);
            shard.mesh.visible = true;
          }
        }
      }
    }
    ch.safe = !inDangerRing;
  } else if (ch.id === 'roll') {
    const anchored = state.inCalmSpot || Boolean(p.climbing) || Boolean(p.attachedVine);
    ch.safe = anchored;
    // Reverse roll direction halfway through active phase for dramatic feel!
    const half = ch.phase === 'active' && ch.elapsed > ch.def.activeSec * 0.52 ? -1 : 1;
    const dir = ch.rollDir * half;
    const targetRoll = (ch.phase === 'telegraph' ? 0.05 : 0.14) * dir;
    camFX.rollZ += (targetRoll - camFX.rollZ) * Math.min(1, dt * 3.0);

    // Lateral wind/dust streaks showing gravity pull direction
    for (const g of galeStreaks) {
      g.mesh.visible = true;
      g.oz += dir * 20 * dt;
      if (g.oz > 20) g.oz = -20;
      if (g.oz < -20) g.oz = 20;
      const gx = p.x + g.ox;
      const gz = p.z + g.oz;
      g.mesh.rotation.y = Math.PI * 0.5;
      g.mesh.position.set(gx, getHeightAt(gx, gz, b) + g.oy * 0.5, gz);
    }

    if (ch.phase === 'active' && !anchored) {
      p.vz += dir * 13.5 * dt;
    }
  }
}
