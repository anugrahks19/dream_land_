/**
 * Dreamback — Interactions, Fragments, NPCs, Hush Lantern, Caverns Puzzle,
 * Dream Surge, Dream Altar, 20-Second Ending Sequence, Save & Playtest Telemetry.
 */

import * as THREE from 'three';
import {
  CONFIG,
  CALM_SPOTS,
  FRAGMENT_LOCATIONS,
  ALTAR_POS,
  NPCS_CONFIG,
  MUSHROOM_PADS,
  HIDDEN_ECHOES,
  DIALOGUE,
  zoneAt,
} from './data.js';
import {
  getHeightAt,
  getBaseHeightAt,
  getGateDoors,
  getAltarSockets,
  getPuffCreatures,
  registerStandablePlatform,
  registerCylinderCollider,
  resetWorldState,
  triggerEndingFlowerWave,
} from './world.js';
import { setCycleForFragments, triggerFinalExhale } from './breath.js';
import { applyImpulse, triggerTalkWave, teleportPlayer } from './player.js';
import { getMat, getSprite } from './tex-bridge.js';
import {
  playFragmentPickup,
  playChimePulse,
  playHumPulse,
  playCalmSpot,
  playPuzzleSuccess,
  playPuzzleWrong,
  playEndingChord,
} from './audio.js';
import { onLanternPulseChallenges, triggerChallengeByIndex } from './challenges.js';

const interactables = [];
const fragmentObjs = [];
const npcObjs = [];
const mushroomPadObjs = [];
const hiddenEchoObjs = [];
let wispMothSprites = [];
let wayfinderOrbs = [];
let wayfinderBeacon = null;
let mothTrailTimer = 0;
let humRingMesh = null;
let burstParticles = [];
let surgeOrbs = [];
let altarFragmentOrbs = [];
let chimeTimer = 0;
let calmSoundTimer = 0;
let autoSaveTimer = 0;
let currentPrompt = null;
let uiHooks = null;

// Playtest telemetry log (?playtest=1)
const playtestLog = [];
export function logTelemetry(event, detail = {}) {
  playtestLog.push({ t: Number((performance.now() / 1000).toFixed(2)), event, ...detail });
}
window.dumpPlaytest = () => {
  const out = JSON.stringify(playtestLog, null, 2);
  console.log(out);
  return out;
};

// =========================================================================
// Save / Load (localStorage with safe corruption fallback)
// =========================================================================
export function saveGame(state) {
  try {
    const payload = {
      fragments: [...state.fragments],
      echoes: [...(state.echoes || [])],
      puzzleStep: state.puzzle?.nextStep || 0,
      checkpoint: state.checkpoint,
      flags: {
        hasLantern: Boolean(state.flags.hasLantern),
        gateOpen: Boolean(state.flags.gateOpen),
        seenPrompts: state.flags.seenPrompts || {},
      },
      restlessness: Math.round(state.restlessness),
      difficulty: state.difficulty,
    };
    localStorage.setItem(CONFIG.save.key, JSON.stringify(payload));
  } catch { /* ignore */ }
}

export function loadSavedGame() {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.fragments)) throw new Error('Invalid save shape');
    return data;
  } catch {
    try { localStorage.removeItem(CONFIG.save.key); } catch { /* ignore */ }
    return null;
  }
}

export function clearSavedGame() {
  try { localStorage.removeItem(CONFIG.save.key); } catch { /* ignore */ }
}

export function addRestlessness(state, amount, reason = '') {
  if (state.mode !== 'play') return;
  const preset = CONFIG.difficulty.presets[state.difficulty] || CONFIG.difficulty.presets.cozy;
  const scaled = amount > 0 ? amount * preset.restlessMult : amount;
  state.restlessness = Math.max(0, Math.min(CONFIG.restlessness.max, state.restlessness + scaled));

  // Official grace rule: first 60s of gameplay cannot trigger a loss
  if (state.playSeconds < CONFIG.restlessness.graceSeconds && state.restlessness > 95) {
    state.restlessness = 95;
  }
  if (reason && amount > 0) logTelemetry('restlessness_spike', { amount: scaled, reason, total: state.restlessness });
}

// =========================================================================
// Build Visuals for Fragments, NPCs, Mushroom Pads, Wisp-Moths, Hum Ring & Surge Orbs
// =========================================================================
function buildFragments(scene, state) {
  fragmentObjs.length = 0;
  const cryGeo = new THREE.OctahedronGeometry(1.15, 0);

  for (const fc of FRAGMENT_LOCATIONS) {
    const grp = new THREE.Group();
    const y = getBaseHeightAt(fc.x, fc.z) + fc.yOff;
    grp.position.set(fc.x, y, fc.z);

    const mat = new THREE.MeshStandardMaterial({
      color: fc.color,
      emissive: fc.color,
      emissiveIntensity: 0.9,
      flatShading: true,
      roughness: 0.25,
    });
    const mesh = new THREE.Mesh(cryGeo, mat);
    grp.add(mesh);

    const halo = new THREE.Sprite(getSprite('fx.fragment', fc.color, true));
    halo.material = halo.material.clone();
    halo.material.color = new THREE.Color(fc.color);
    halo.scale.set(5.2, 5.2, 1);
    grp.add(halo);

    const collected = state.fragments.includes(fc.id);
    grp.visible = !collected;
    scene.add(grp);

    const obj = { cfg: fc, group: grp, mesh, halo, collected };
    fragmentObjs.push(obj);

    interactables.push({
      id: fc.id,
      getPos: () => grp.position,
      radius: 4.5,
      yRadius: 3.8,
      prompt: `Collect ${fc.name}`,
      isEnabled: () => !obj.collected,
      onInteract: () => collectFragment(obj, state, scene),
    });
  }
}

function buildNpcs(scene, state) {
  npcObjs.length = 0;

  for (const nc of NPCS_CONFIG) {
    const grp = new THREE.Group();
    const y = getBaseHeightAt(nc.x, nc.z);
    grp.position.set(nc.x, y, nc.z);

    if (nc.id === 'grandma') {
      const bodyMat = getMat('char.grandma.body', new THREE.MeshStandardMaterial({ color: '#8FBF8F' }));
      const shawlMat = getMat('char.grandma.shawl', new THREE.MeshStandardMaterial({ color: '#F4E9CD' }));
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), bodyMat);
      b.position.y = 1.0; b.castShadow = true;
      const shawl = new THREE.Mesh(new THREE.ConeGeometry(1.12, 1.0, 12), shawlMat);
      shawl.position.y = 1.05;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), bodyMat);
      head.position.set(0, 1.9, 0.25);
      grp.add(b, shawl, head);
    } else if (nc.id === 'bramble') {
      const shMat = getMat('char.bramble.shell', new THREE.MeshStandardMaterial({ color: '#6B7F3A', roughness: 0.45 }));
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), shMat);
      shell.scale.set(1.25, 0.85, 1.0); shell.position.y = 1.0; shell.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), shMat);
      head.position.set(1.05, 0.85, 0);
      grp.add(shell, head);
    } else if (nc.id === 'pebble') {
      const pShell = getMat('char.pebble.shell', new THREE.MeshStandardMaterial({ color: '#F4E9CD', emissive: '#FFC77A', emissiveIntensity: 0.35 }));
      const pBody = getMat('char.pebble.body', new THREE.MeshStandardMaterial({ color: '#FFB88A' }));
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 6, 10), pBody);
      body.rotation.z = Math.PI * 0.5; body.position.y = 0.55;
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 12), pShell);
      shell.position.set(-0.25, 1.35, 0); shell.castShadow = true;
      grp.add(body, shell);
    } else {
      // Wisp-Moth guide
      const mBody = getMat('char.moth.body', new THREE.MeshStandardMaterial({ color: '#FFC77A', emissive: '#4FD1C5', emissiveIntensity: 1.0 }));
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mBody);
      orb.position.y = 2.4;
      const halo = new THREE.Sprite(getSprite('fx.halo.cool', '#4FD1C5', true));
      halo.position.y = 2.4; halo.scale.set(3.2, 3.2, 1);
      grp.add(orb, halo);
    }

    // Gentle overhead glow indicator so NPCs are easy to spot
    const bobSprite = new THREE.Sprite(getSprite('fx.sparkle', '#FFF4DC', true));
    bobSprite.position.y = 3.2;
    bobSprite.scale.set(1.2, 1.2, 1);
    grp.add(bobSprite);

    scene.add(grp);
    npcObjs.push({ cfg: nc, group: grp, bobSprite });

    interactables.push({
      id: `npc_${nc.id}`,
      getPos: () => grp.position,
      radius: 5.5,
      prompt: `Talk to ${nc.name}`,
      isEnabled: () => true,
      onInteract: () => {
        triggerTalkWave(state);
        const hasZoneFrag = state.fragments.includes(nc.fragId);
        const lines = DIALOGUE[nc.id][hasZoneFrag ? 'after' : 'before'];
        if (nc.id === 'grandma' && !state.flags.hasLantern) {
          state.flags.hasLantern = true;
          saveGame(state);
          logTelemetry('lantern_received');
        }
        uiHooks?.openDialogue?.(nc.name, nc.portraitIdx, lines);
      },
    });
  }
}

function buildCavernPuzzle(scene, state) {
  mushroomPadObjs.length = 0;
  const stemMat = getMat('nature.mushroom.stem', new THREE.MeshStandardMaterial({ color: '#F4E9CD' }));

  for (const mp of MUSHROOM_PADS) {
    const grp = new THREE.Group();
    const y = getBaseHeightAt(mp.x, mp.z);
    const capH = mp.capHeight || 4.5;
    const stemH = capH - 0.55;
    grp.position.set(mp.x, y, mp.z);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.55, stemH, 10), stemMat);
    stem.position.y = stemH * 0.5;

    const alreadyLit = Boolean(state.flags.gateOpen) || (state.puzzle?.nextStep || 0) > mp.order;
    const capMat = new THREE.MeshStandardMaterial({
      color: mp.color,
      emissive: mp.color,
      emissiveIntensity: alreadyLit ? 1.6 : 0.28,
      roughness: 0.55,
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(mp.radius, mp.radius * 0.84, 0.75, 16), capMat);
    cap.position.y = capH - 0.38;

    const halo = new THREE.Sprite(getSprite('fx.halo.cool', mp.color, true));
    halo.material = halo.material.clone();
    halo.material.color = new THREE.Color(mp.color);
    halo.position.y = capH + 0.9;
    halo.scale.set(4.5, 4.5, 1);
    halo.visible = alreadyLit;

    grp.add(stem, cap, halo);
    scene.add(grp);

    // Solid stem & standable mushroom cap so Pip hops from the breath platforms onto each pad!
    registerCylinderCollider(mp.x, mp.z, 1.35, capH - 0.6, 'mushroom_pad_stem');
    registerStandablePlatform(mp.x, mp.z, mp.radius * 1.9, mp.radius * 1.9, y + capH);

    mushroomPadObjs.push({ cfg: mp, group: grp, capMat, halo, capH, lit: alreadyLit, stepped: false });
  }

  // 6 Wisp-Moths that awaken on Hum and fly the pad 0 -> 1 -> 2 order!
  wispMothSprites = [];
  const mothMat = getSprite('fx.moth', '#4FD1C5', true);
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(mothMat);
    sp.scale.set(2.0, 2.0, 1);
    const sx = 68 + i * 8, sz = (i % 2 === 0 ? -4 : 4);
    sp.position.set(sx, getBaseHeightAt(sx, sz) + 4.5, sz);
    scene.add(sp);
    wispMothSprites.push({ sprite: sp, offset: i / 6 });
  }
}

function buildHiddenEchoes(scene, state) {
  hiddenEchoObjs.length = 0;
  const geo = new THREE.OctahedronGeometry(0.7, 0);
  for (const ec of HIDDEN_ECHOES) {
    const grp = new THREE.Group();
    const y = getBaseHeightAt(ec.x, ec.z) + 2.0;
    grp.position.set(ec.x, y, ec.z);
    const mat = new THREE.MeshStandardMaterial({
      color: ec.color,
      emissive: ec.color,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const halo = new THREE.Sprite(getSprite('fx.sparkle', ec.color, true));
    halo.scale.set(3.8, 3.8, 1);
    grp.add(mesh, halo);
    grp.visible = false;
    scene.add(grp);

    const collected = (state.echoes || []).includes(ec.id);
    const obj = { cfg: ec, group: grp, mesh, collected, revealTimer: 0 };
    hiddenEchoObjs.push(obj);

    interactables.push({
      id: ec.id,
      getPos: () => grp.position,
      radius: 4.5,
      yRadius: 4.0,
      prompt: 'Listen to Hidden Dreamfire Echo',
      isEnabled: () => !obj.collected && obj.revealTimer > 0,
      onInteract: () => {
        if (obj.collected) return;
        obj.collected = true;
        obj.group.visible = false;
        if (!state.echoes) state.echoes = [];
        if (!state.echoes.includes(ec.id)) state.echoes.push(ec.id);
        addRestlessness(state, -10, 'hidden_echo');
        playFragmentPickup();
        spawnBurst(scene, obj.group.position, ec.color);
        saveGame(state);
        uiHooks?.showToast?.(`${ec.lore} (${state.echoes.length}/${HIDDEN_ECHOES.length} Echoes)`, 5.2);
      },
    });
  }
}

function buildHumRingAndSurge(scene) {
  // Expanding Hush Lantern hum pulse ring
  const ringMat = getMat('fx.ring', new THREE.MeshBasicMaterial({
    color: '#FFC77A',
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }));
  humRingMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat);
  humRingMesh.rotation.x = -Math.PI / 2;
  humRingMesh.visible = false;
  scene.add(humRingMesh);

  // Dream Surge orbs (pre-allocated, shown during 45s Crown Surge)
  surgeOrbs = [];
  const orbMat = getSprite('fx.orb', '#F6B8C8', true);
  for (let i = 0; i < CONFIG.surge.orbCount; i++) {
    const sp = new THREE.Sprite(orbMat);
    sp.scale.set(CONFIG.surge.orbRadius * 2.4, CONFIG.surge.orbRadius * 2.4, 1);
    sp.visible = false;
    scene.add(sp);
    surgeOrbs.push({ sprite: sp, angle: (i / CONFIG.surge.orbCount) * Math.PI * 2, radius: 18 + (i % 3) * 10, hitCooldown: 0 });
  }

  // Altar interactable
  interactables.push({
    id: 'dream_altar',
    getPos: () => new THREE.Vector3(ALTAR_POS.x, getHeightAt(ALTAR_POS.x, ALTAR_POS.z), ALTAR_POS.z),
    radius: 6.2,
    prompt: 'Place all 4 Dream Fragments at the Altar',
    isEnabled: () => true,
    onInteract: (state) => {
      if (state.fragments.length < 4) {
        uiHooks?.showToast?.(`Gather all 4 Dream Fragments first (${state.fragments.length}/4 collected).`);
        return;
      }
      startEndingSequence(state, scene);
    },
  });
}

// =========================================================================
// Actions: Collect Fragment, Hum Pulse, Dream Surge, Ending Sequence
// =========================================================================
function spawnBurst(scene, pos, color) {
  const mat = getSprite('fx.sparkle', color, true);
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    sp.scale.set(1.5, 1.5, 1);
    scene.add(sp);
    const a = (i / 14) * Math.PI * 2;
    burstParticles.push({
      sprite: sp,
      vx: Math.cos(a) * (4 + Math.random() * 5),
      vy: 4 + Math.random() * 6,
      vz: Math.sin(a) * (4 + Math.random() * 5),
      life: 1.3,
    });
  }
}

function collectFragment(obj, state, scene) {
  if (obj.collected) return;
  obj.collected = true;
  obj.group.visible = false;
  if (!state.fragments.includes(obj.cfg.id)) {
    state.fragments.push(obj.cfg.id);
  }
  state.calm = Math.min(1, state.fragments.length / 4);
  addRestlessness(state, -CONFIG.restlessness.fragmentDrop, 'fragment_pickup');
  setCycleForFragments(state.fragments.length);
  playFragmentPickup();
  spawnBurst(scene, obj.group.position, obj.cfg.color);
  logTelemetry('fragment_collected', { id: obj.cfg.id, count: state.fragments.length });

  // Light up corresponding Dream Altar socket
  const sockets = getAltarSockets();
  if (sockets[obj.cfg.index]) sockets[obj.cfg.index].mat.emissiveIntensity = 1.2;

  saveGame(state);
  const verses = {
    frag_marsh: 'Memory of Still Water — The colony’s lanterns kindle warm gold, and the Giant’s breath slows to 28s.',
    frag_forest: 'Memory of Summer Wind — The canopy gales calm into golden breeze; breath slows to 32s.',
    frag_cavern: 'Memory of Deep Song — The rib arches echo with peace; breath slows to 36s.',
    frag_crown: 'Memory of Dawn — The Dream Surge stirs! Ride the exhale gusts to the Dream Altar!',
  };
  uiHooks?.showToast?.(verses[obj.cfg.id] || `Gathered ${obj.cfg.name} (${state.fragments.length}/4)!`, 5.0);

  // Fragment 4 triggers the 45-second Dream Surge!
  if (obj.cfg.id === 'frag_crown') {
    startDreamSurge(state);
  }
}

function startDreamSurge(state) {
  state.surge = { active: true, remaining: CONFIG.surge.duration };
  uiHooks?.showToast?.('The Dream Surge stirs! Ride the exhale gusts to the Dream Altar!');
  logTelemetry('surge_started');
  const cy = getBaseHeightAt(258, 0) + 2.8;
  surgeOrbs.forEach((o, i) => {
    o.sprite.visible = true;
    o.angle = (i / surgeOrbs.length) * Math.PI * 2;
    o.sprite.position.set(256 + Math.cos(o.angle) * o.radius, cy, Math.sin(o.angle) * o.radius);
  });
}

export function triggerHum(state) {
  if (state.mode !== 'play' || state.dialogueActive) return;
  if (!state.flags.hasLantern) {
    uiHooks?.showToast?.('Talk to Grandma Moss-Ant to receive the Hush Lantern first.');
    return;
  }
  if (state.lantern.cooldown > 0) return;

  state.lantern.cooldown = CONFIG.lantern.cooldown;
  state.lantern.pulseTimer = CONFIG.lantern.pulseDuration;
  addRestlessness(state, -CONFIG.restlessness.humDrop, 'hum');
  playHumPulse();
  logTelemetry('hum_pulse', { x: Math.round(state.player.x) });

  if (humRingMesh) {
    humRingMesh.visible = true;
    humRingMesh.position.set(state.player.x, state.player.y + 0.35, state.player.z);
    humRingMesh.scale.set(1, 1, 1);
  }

  // Wake Wisp-Moths in Rib Caverns to trace the 1->2->3 mushroom pad path!
  if (state.player.x > 25 && state.player.x < 175) {
    mothTrailTimer = 11.0;
    uiHooks?.showToast?.('Wisp-Moths awaken! Follow their glowing path: Teal → Rose → Indigo.');
  }

  // Reveal any hidden Dreamfire Echoes within Lantern radius!
  let revealedAny = false;
  for (const ec of hiddenEchoObjs) {
    if (ec.collected) continue;
    if (Math.hypot(state.player.x - ec.cfg.x, state.player.z - ec.cfg.z) <= CONFIG.lantern.radius + 8) {
      ec.revealTimer = 22.0;
      ec.group.visible = true;
      revealedAny = true;
    }
  }
  if (revealedAny) {
    uiHooks?.showToast?.('Your Hush Lantern reveals a hidden Dreamfire Echo nearby! Press E to listen.');
  }
  // Banish creeping Nightmare Wisps during Nightmare Eclipse challenge!
  onLanternPulseChallenges(state);
}

export function startEndingSequence(state, scene) {
  if (state.mode === 'ending' || state.mode === 'ended') return;
  state.mode = 'ending';
  state.surge.active = false;
  surgeOrbs.forEach((o) => { o.sprite.visible = false; });
  state.calm = 1.0;
  state.restlessness = 0;
  state.ending = { timer: 0, progress: 0, flowerTriggered: false, textShown: false, creditsShown: false };

  // Light all 4 altar sockets & spawn rising fragment orbs
  const sockets = getAltarSockets();
  altarFragmentOrbs = [];
  const ay = getHeightAt(ALTAR_POS.x, ALTAR_POS.z, state.breath.value);
  sockets.forEach((s) => {
    s.mat.emissiveIntensity = 1.8;
    const sp = new THREE.Sprite(getSprite('fx.fragment', s.color, true));
    sp.material = sp.material.clone();
    sp.material.color = new THREE.Color(s.color);
    sp.position.set(ALTAR_POS.x + s.mesh.position.x, ay + 1.8, ALTAR_POS.z + s.mesh.position.z);
    sp.scale.set(4.0, 4.0, 1);
    scene.add(sp);
    altarFragmentOrbs.push(sp);
  });

  triggerFinalExhale();
  playEndingChord();
  logTelemetry('ending_started', { elapsedSec: Math.round(state.playSeconds) });
}

// =========================================================================
// Public Init & Per-Frame Update
// =========================================================================
export function resetInteractions(state, scene) {
  state.lantern = { cooldown: 0, pulseTimer: 0 };
  state.surge = { active: false, remaining: 0 };
  state.puzzle = { nextStep: 0 };
  state.ending = null;
  state.echoes = [];
  mothTrailTimer = 0;
  currentPrompt = null;

  for (const obj of fragmentObjs) {
    obj.collected = false;
    obj.group.visible = true;
  }
  for (const mp of mushroomPadObjs) {
    mp.lit = false;
    mp.stepped = false;
    mp.capMat.emissiveIntensity = 0.28;
    mp.halo.visible = false;
  }
  for (const ec of hiddenEchoObjs) {
    ec.collected = false;
    ec.revealTimer = 0;
    ec.group.visible = false;
  }
  surgeOrbs.forEach((o) => { o.sprite.visible = false; o.hitCooldown = 0; });
  if (scene) {
    altarFragmentOrbs.forEach((sp) => scene.remove(sp));
  }
  altarFragmentOrbs = [];
  if (humRingMesh) humRingMesh.visible = false;
  resetWorldState();
}

export function initInteractions(scene, state, hooks) {
  uiHooks = hooks;
  interactables.length = 0;
  state.lantern = { cooldown: 0, pulseTimer: 0 };
  state.surge = { active: false, remaining: 0 };
  state.puzzle = { nextStep: state.flags.gateOpen ? 3 : Math.min(2, state.puzzle?.nextStep || 0) };

  buildFragments(scene, state);
  buildNpcs(scene, state);
  buildCavernPuzzle(scene, state);
  buildHiddenEchoes(scene, state);
  buildHumRingAndSurge(scene);
  buildWayfinder(scene);

  // Sync already-collected fragments onto altar sockets & gate state
  const sockets = getAltarSockets();
  for (const fc of FRAGMENT_LOCATIONS) {
    if (state.fragments.includes(fc.id) && sockets[fc.index]) {
      sockets[fc.index].mat.emissiveIntensity = 1.2;
    }
  }
  const gate = getGateDoors();
  if (gate) {
    for (let r = 0; r < state.puzzle.nextStep && r < gate.runes.length; r++) {
      gate.runes[r].emissiveIntensity = 1.8;
    }
    if (state.flags.gateOpen) {
      gate.isOpen = true;
      gate.openProgress = 1;
      gate.left.position.z = -10 * 0.25 - 5.6;
      gate.right.position.z = 10 * 0.25 + 5.6;
    }
  }

  // Wire E (interact), H (hum), R (rescue), and optional ?debug=1 keys
  const isDebug = new URLSearchParams(window.location.search).get('debug') === '1';

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyE') {
      if (state.dialogueActive) {
        uiHooks?.advanceDialogue?.();
      } else if (state.mode === 'play' && currentPrompt) {
        currentPrompt.onInteract(state);
      }
    } else if (e.code === 'KeyH') {
      triggerHum(state);
    } else if (e.code === 'KeyR' && state.mode === 'play') {
      teleportPlayer(state, state.checkpoint.x, state.checkpoint.z);
      uiHooks?.showToast?.('Returned to last Calm Spot.');
    } else if (e.code === 'KeyG' && state.mode === 'play') {
      state.flags.showGuide = !state.flags.showGuide;
      uiHooks?.showToast?.(state.flags.showGuide ? 'Optional Firefly Guide: ON' : 'Optional Firefly Guide: OFF (Pure Free Roam)', 2.4);
    } else if (isDebug && state.mode === 'play') {
      if (e.code === 'Digit1') teleportPlayer(state, -255, 0);
      if (e.code === 'Digit2') teleportPlayer(state, -108, 0);
      if (e.code === 'Digit3') teleportPlayer(state, 52, 0);
      if (e.code === 'Digit4') teleportPlayer(state, 224, 0);
      if (e.code === 'Digit5') triggerChallengeByIndex(0, state);
      if (e.code === 'Digit6') triggerChallengeByIndex(1, state);
      if (e.code === 'Digit7') triggerChallengeByIndex(2, state);
      if (e.code === 'Digit8') triggerChallengeByIndex(3, state);
      if (e.code === 'Digit9') triggerChallengeByIndex(4, state);
      if (e.code === 'KeyF') {
        fragmentObjs.forEach((f) => collectFragment(f, state, scene));
      }
      if (e.code === 'KeyK') {
        FRAGMENT_LOCATIONS.forEach((fc) => { if (!state.fragments.includes(fc.id)) state.fragments.push(fc.id); });
        startEndingSequence(state, scene);
      }
    }
  });
}

function buildWayfinder(scene) {
  wayfinderOrbs = [];
  const orbMat = getSprite('fx.firefly', '#FFE08A', true);
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(orbMat.clone());
    sp.material.opacity = 0.85;
    sp.scale.set(1.15, 1.15, 1);
    sp.visible = false;
    scene.add(sp);
    wayfinderOrbs.push(sp);
  }

  // Soft translucent golden sky pillar over the active objective
  const beaconGeo = new THREE.CylinderGeometry(0.45, 1.35, 34, 14, 1, true);
  beaconGeo.translate(0, 17, 0);
  const beaconMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color('#FFD984') },
      uOpacity: { value: 0.42 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float ndv = abs(dot(normalize(vNormal), normalize(vViewDir)));
        float rim = ndv * ndv;
        float vFade = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.12, vUv.y);
        float pulse = 0.84 + 0.16 * sin(uTime * 2.6 - vUv.y * 8.0);
        float alpha = rim * vFade * uOpacity * pulse;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  wayfinderBeacon = new THREE.Mesh(beaconGeo, beaconMat);
  wayfinderBeacon.visible = false;
  scene.add(wayfinderBeacon);
}

export function getActivePrompt() {
  return currentPrompt;
}

const objectiveTargetVec = new THREE.Vector3();

/**
 * Unified, crystal-clear objective + exact 3D target coordinates so compass, HUD,
 * 3D firefly guide trail, and sky beacon ALWAYS agree on where to go next.
 */
export function getNextObjectiveInfo(state) {
  const b = state.breath ? state.breath.value : 0;
  const p = state.player || { x: -265, z: 0 };
  const remaining = FRAGMENT_LOCATIONS.filter((f) => !state.fragments.includes(f.id));

  if (remaining.length > 0) {
    // Open-world: highlight the NEAREST uncollected Dream Fragment (all missions optional & any order!)
    let nearest = remaining[0];
    let bestD = Infinity;
    for (const f of remaining) {
      const d = Math.hypot(p.x - f.x, p.z - f.z);
      if (d < bestD) { bestD = d; nearest = f; }
    }
    objectiveTargetVec.set(nearest.x, getHeightAt(nearest.x, nearest.z, b) + nearest.yOff, nearest.z);
    return {
      pos: objectiveTargetVec,
      step: `Free Roam · ${state.fragments.length}/4 Dreams`,
      act: 'Open World · Optional Quest',
      text: `Nearest Dream: ${nearest.name}`,
      hint: 'Roam anywhere · Press G to hide guide · Press H to hum',
      color: nearest.color,
    };
  }

  objectiveTargetVec.set(ALTAR_POS.x, getHeightAt(ALTAR_POS.x, ALTAR_POS.z, b) + 1.6, ALTAR_POS.z);
  return {
    pos: objectiveTargetVec,
    step: '4/4 Dreams Gathered',
    act: state.surge?.active ? 'The Crown · Dream Surge' : 'Open World · Optional Finale',
    text: 'Return all 4 Dreams to the Dream Altar (Press E)',
    hint: state.surge?.active ? 'Dodge orbs & reach the glowing Altar' : 'Visit the Crown Altar whenever ready',
    color: '#F2C879',
  };
}

export function getNextObjectivePos(state) {
  return getNextObjectiveInfo(state).pos;
}

export function getCurrentObjective(state) {
  return getNextObjectiveInfo(state);
}

export function updateInteractions(dt, state, scene) {
  const p = state.player;
  if (!p) return;
  const t = state.breath.t;

  // --- Ending Scripted Sequence (20 seconds) ---
  if (state.mode === 'ending') {
    state.ending.timer += dt;
    state.ending.progress = Math.min(1, state.ending.timer / 16.0);

    // Phase 1 (0..3s): 4 fragments rise & swirl into light burst
    for (let i = 0; i < altarFragmentOrbs.length; i++) {
      const sp = altarFragmentOrbs[i];
      sp.position.y += dt * 4.5;
      const sc = 4.0 + state.ending.timer * 1.4;
      sp.scale.set(sc, sc, 1);
      sp.material.opacity = Math.max(0, 1 - state.ending.timer / 5.5);
    }

    // Phase 2 (2.5s): trigger 3,600-flower wave head -> tail
    if (!state.ending.flowerTriggered && state.ending.timer > 2.4) {
      state.ending.flowerTriggered = true;
      triggerEndingFlowerWave();
    }

    // Phase 3 (11s): show final story lines
    if (!state.ending.textShown && state.ending.timer > 10.5) {
      state.ending.textShown = true;
      uiHooks?.showEndingCard?.();
    }

    // Phase 4 (18s): transition to ended & credits button
    if (!state.ending.creditsShown && state.ending.timer > 17.5) {
      state.ending.creditsShown = true;
      state.mode = 'ended';
      uiHooks?.showCreditsButton?.();
    }
    return;
  }

  if (state.mode !== 'play') return;

  state.playSeconds += dt;

  // 1. Track zone changes & trigger gentle zone banner
  const zIdx = zoneAt(p.x).index;
  if (zIdx !== state.zoneIndex) {
    state.zoneIndex = zIdx;
    const zName = CONFIG.zones[zIdx].name;
    uiHooks?.showZoneBanner?.(zName);
    logTelemetry('zone_enter', { zone: zName });
  }

  // 2. Passive Restlessness + Calm Spot Recovery + Lose Trigger
  let inCalmSpot = false;
  for (const cs of CALM_SPOTS) {
    if (Math.hypot(p.x - cs.x, p.z - cs.z) <= cs.radius) {
      inCalmSpot = true;
      state.checkpoint = { x: cs.x, z: cs.z };
      addRestlessness(state, -CONFIG.restlessness.calmSpotRate * dt);
      calmSoundTimer -= dt;
      if (calmSoundTimer <= 0) {
        calmSoundTimer = 2.4;
        playCalmSpot();
        saveGame(state);
      }
      break;
    }
  }
  state.inCalmSpot = inCalmSpot;

  if (!inCalmSpot && !state.dialogueActive) {
    addRestlessness(state, CONFIG.restlessness.passiveRate * dt);
    // Gentle penalty for sprinting near sleeping creatures or near the Giant's Crown head
    if (p.sprinting) {
      let nearSleeping = p.x > 215;
      if (!nearSleeping) {
        for (const pf of getPuffCreatures()) {
          if (Math.hypot(p.x - pf.homeX, p.z - pf.homeZ) < 10) { nearSleeping = true; break; }
        }
      }
      if (nearSleeping) addRestlessness(state, CONFIG.restlessness.sprintNearSleeping * dt);
    }
  }

  if (state.restlessness >= CONFIG.restlessness.max && state.playSeconds >= CONFIG.restlessness.graceSeconds) {
    state.mode = 'lose';
    logTelemetry('giant_woke');
    uiHooks?.showLoseCard?.();
    return;
  }

  // 3. Periodic Auto-Save
  autoSaveTimer += dt;
  if (autoSaveTimer >= CONFIG.save.autoSaveSec) {
    autoSaveTimer = 0;
    saveGame(state);
  }

  // 4. Hush Lantern cooldown & expanding pulse ring
  if (state.lantern.cooldown > 0) state.lantern.cooldown = Math.max(0, state.lantern.cooldown - dt);
  if (state.lantern.pulseTimer > 0) {
    state.lantern.pulseTimer = Math.max(0, state.lantern.pulseTimer - dt);
    const prog = 1 - state.lantern.pulseTimer / CONFIG.lantern.pulseDuration;
    if (humRingMesh) {
      const sz = 2 + prog * CONFIG.lantern.radius * 2;
      humRingMesh.scale.set(sz, sz, 1);
      humRingMesh.material.opacity = (1 - prog) * 0.8;
      if (state.lantern.pulseTimer <= 0) humRingMesh.visible = false;
    }
  }

  // 5. Animate Fragments & Proximity Chime Guidance (within 24u)
  let nearestFragDist = Infinity;
  for (const f of fragmentObjs) {
    if (f.collected) continue;
    f.group.position.y = getHeightAt(f.cfg.x, f.cfg.z, state.breath.value) + f.cfg.yOff + Math.sin(t * 2.2 + f.cfg.index) * 0.45;
    f.mesh.rotation.y += dt * 1.1;
    const d = Math.hypot(p.x - f.cfg.x, p.z - f.cfg.z);
    if (d < nearestFragDist) nearestFragDist = d;
    const boost = state.lantern.pulseTimer > 0 && d < 55 ? 2.2 : d < CONFIG.lantern.guideRadius ? 1.5 : 1.0;
    f.halo.scale.setScalar(5.0 * boost);
  }
  if (nearestFragDist < CONFIG.lantern.guideRadius) {
    chimeTimer -= dt;
    if (chimeTimer <= 0) {
      const prox = 1 - nearestFragDist / CONFIG.lantern.guideRadius;
      chimeTimer = 2.2 - prox * 1.3;
      playChimePulse(prox);
    }
  }

  // 6. Animate NPCs (gentle breathing ride & sparkle bob)
  for (const n of npcObjs) {
    n.group.position.y = getHeightAt(n.cfg.x, n.cfg.z, state.breath.value);
    n.bobSprite.position.y = 3.2 + Math.sin(t * 2.8) * 0.25;
  }

  // 7. Caverns Wisp-Moth Trail & 3-Pad Mushroom Puzzle
  if (mothTrailTimer > 0) mothTrailTimer -= dt;
  const mothActive = mothTrailTimer > 0;
  for (const m of wispMothSprites) {
    if (mothActive) {
      // Fly smoothly along pad 0 -> pad 1 -> pad 2 to show exact sequence!
      const prog = ((t * 0.22 + m.offset) % 1) * 2.0;
      const i0 = Math.min(1, Math.floor(prog));
      const frac = prog - i0;
      const a = MUSHROOM_PADS[i0], b = MUSHROOM_PADS[i0 + 1];
      const mx = a.x + (b.x - a.x) * frac;
      const mz = a.z + (b.z - a.z) * frac;
      m.sprite.position.set(mx, getHeightAt(mx, mz, state.breath.value) + 4.0 + Math.sin(frac * Math.PI) * 2.5, mz);
      m.sprite.scale.setScalar(2.6);
    } else {
      m.sprite.position.y = getHeightAt(m.sprite.position.x, m.sprite.position.z, state.breath.value) + 4.2 + Math.sin(t * 2 + m.offset * 6) * 0.6;
      m.sprite.scale.setScalar(1.4);
    }
  }

  if (!state.flags.gateOpen) {
    for (const mp of mushroomPadObjs) {
      mp.group.position.y = getHeightAt(mp.cfg.x, mp.cfg.z, state.breath.value);
      const capTopY = mp.group.position.y + mp.capH;
      const onPad = Math.hypot(p.x - mp.cfg.x, p.z - mp.cfg.z) < mp.cfg.radius + 0.5 && p.y >= capTopY - 0.8 && p.y <= capTopY + 2.5;
      if (onPad && !mp.stepped) {
        mp.stepped = true;
        if (mp.cfg.order === state.puzzle.nextStep) {
          mp.lit = true;
          mp.capMat.emissiveIntensity = 1.6;
          mp.halo.visible = true;
          // Light up the matching rune orb above the carved Rib Gate!
          const gateObj = getGateDoors();
          if (gateObj?.runes?.[mp.cfg.order]) gateObj.runes[mp.cfg.order].emissiveIntensity = 1.8;
          state.puzzle.nextStep++;
          playPuzzleSuccess();
          if (state.puzzle.nextStep >= MUSHROOM_PADS.length) {
            state.flags.gateOpen = true;
            if (gateObj) gateObj.isOpen = true;
            saveGame(state);
            uiHooks?.showToast?.('All 3 Resonance Runes lit! The ancient Rib Gate slides open.', 4.5);
            logTelemetry('cavern_puzzle_solved');
          } else {
            saveGame(state);
            uiHooks?.showToast?.(`Resonance Pad ${state.puzzle.nextStep}/3 lit!`, 2.2);
          }
        } else if (!mp.lit) {
          // Gentle reset +8 restlessness
          playPuzzleWrong();
          addRestlessness(state, CONFIG.restlessness.wrongStep, 'wrong_pad');
          state.puzzle.nextStep = 0;
          mushroomPadObjs.forEach((o) => { o.lit = false; o.capMat.emissiveIntensity = 0.28; o.halo.visible = false; });
          const gateObj = getGateDoors();
          gateObj?.runes?.forEach((r) => { r.emissiveIntensity = 0.12; });
          uiHooks?.showToast?.('Wrong melody — press H to watch the Wisp-Moths trace Teal → Rose → Indigo.');
        }
      } else if (!onPad) {
        mp.stepped = false;
      }
    }
  } else {
    for (const mp of mushroomPadObjs) {
      mp.group.position.y = getHeightAt(mp.cfg.x, mp.cfg.z, state.breath.value);
    }
  }

  // 7b. Animate hidden Dreamfire Echoes revealed by Hush Lantern
  for (const ec of hiddenEchoObjs) {
    if (ec.collected) continue;
    if (ec.revealTimer > 0) {
      ec.revealTimer -= dt;
      ec.group.position.y = getHeightAt(ec.cfg.x, ec.cfg.z, state.breath.value) + 2.0 + Math.sin(t * 2.8) * 0.35;
      ec.mesh.rotation.y += dt * 1.8;
      if (ec.revealTimer <= 0) ec.group.visible = false;
    }
  }

  // 8. Crown Dream Surge (45s drifting pink-gold orbs + breath gusts)
  if (state.surge.active) {
    state.surge.remaining -= dt;
    const preset = CONFIG.difficulty.presets[state.difficulty] || CONFIG.difficulty.presets.cozy;
    const orbSpd = CONFIG.surge.orbSpeed * preset.orbSpeedMult;
    const centerX = 256, centerZ = 0;

    for (const o of surgeOrbs) {
      if (o.hitCooldown > 0) o.hitCooldown -= dt;
      o.angle += dt * (orbSpd / Math.max(10, o.radius));
      const r = o.radius + Math.sin(t * 1.4 + o.angle) * 6.5;
      const ox = centerX + Math.cos(o.angle) * r;
      const oz = centerZ + Math.sin(o.angle) * r;
      const oy = getHeightAt(ox, oz, state.breath.value) + 2.2 + Math.sin(t * 2.5 + o.angle) * 0.8;
      o.sprite.position.set(ox, oy, oz);

      if (o.hitCooldown <= 0 && Math.hypot(p.x - ox, p.z - oz) < CONFIG.surge.orbRadius + 0.8 && Math.abs(p.y - oy) < 2.8) {
        o.hitCooldown = 1.6;
        const dx = p.x - ox, dz = p.z - oz;
        const dl = Math.max(0.1, Math.hypot(dx, dz));
        applyImpulse(state, (dx / dl) * CONFIG.surge.bumpImpulse, 7.5, (dz / dl) * CONFIG.surge.bumpImpulse);
        addRestlessness(state, CONFIG.restlessness.orbHit, 'surge_orb');
        playPuzzleWrong();
      }
    }

    if (state.surge.remaining <= 0) {
      addRestlessness(state, 15, 'surge_timeout');
      state.surge.remaining = 30;
      playPuzzleWrong();
      uiHooks?.showToast?.('The Dream Surge swells again! Hurry to the Dream Altar!', 4.2);
    }
  }

  // 9. Update burst particles
  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const bp = burstParticles[i];
    bp.life -= dt;
    bp.sprite.position.x += bp.vx * dt;
    bp.sprite.position.y += bp.vy * dt;
    bp.sprite.position.z += bp.vz * dt;
    bp.vy -= 9 * dt;
    bp.sprite.scale.setScalar(Math.max(0.01, bp.life * 1.4));
    if (bp.life <= 0) {
      scene.remove(bp.sprite);
      burstParticles.splice(i, 1);
    }
  }

  // 9b. Animate Optional 3D Glowing Wayfinder Trail & Sky Beacon (toggleable with G for pure free-roam!)
  const showGuide = state.flags.showGuide !== false;
  const objInfo = getNextObjectiveInfo(state);
  const tgt = objInfo.pos;
  const dxT = tgt.x - p.x;
  const dzT = tgt.z - p.z;
  const distT = Math.hypot(dxT, dzT);

  if (wayfinderBeacon) {
    wayfinderBeacon.visible = showGuide && distT > 5.5;
    wayfinderBeacon.position.set(tgt.x, getHeightAt(tgt.x, tgt.z, state.breath.value) - 0.5, tgt.z);
    wayfinderBeacon.material.uniforms.uTime.value = t;
    wayfinderBeacon.material.uniforms.uColor.value.set(objInfo.color || '#FFD984');
    wayfinderBeacon.material.uniforms.uOpacity.value = Math.min(0.42, Math.max(0.0, (distT - 5.5) / 14.0) * 0.42);
  }

  const trailMax = Math.min(distT - 2.2, 42);
  for (let i = 0; i < wayfinderOrbs.length; i++) {
    const sp = wayfinderOrbs[i];
    if (!showGuide || trailMax <= 3.0) { sp.visible = false; continue; }
    // Flowing phase so fireflies drift smoothly from Pip toward the goal!
    const frac = ((i / wayfinderOrbs.length) + (t * 0.22)) % 1.0;
    const dStep = 3.2 + frac * (trailMax - 3.2);
    const nx = dxT / Math.max(0.01, distT);
    const nz = dzT / Math.max(0.01, distT);
    const sideWobble = Math.sin(t * 2.2 + i * 1.3) * 0.75 * Math.sin(frac * Math.PI);
    const wx = p.x + nx * dStep - nz * sideWobble;
    const wz = p.z + nz * dStep + nx * sideWobble;
    const wy = getHeightAt(wx, wz, state.breath.value) + 1.1 + Math.sin(t * 3.0 + i) * 0.35;
    sp.visible = true;
    sp.position.set(wx, wy, wz);
    const env = Math.sin(frac * Math.PI);
    const sc = (0.75 + env * 0.85) * (state.lantern.pulseTimer > 0 ? 1.55 : 1.0);
    sp.scale.set(sc, sc, 1);
    sp.material.opacity = env * 0.88;
    sp.material.color.set(objInfo.color || '#FFE08A');
  }

  // 10. Nearest interactable lookup (3D horizontal + vertical check so high fragments require climbing!)
  let best = null;
  let bestDist = Infinity;
  for (const it of interactables) {
    if (!it.isEnabled()) continue;
    const pos = it.getPos();
    const dXZ = Math.hypot(p.x - pos.x, p.z - pos.z);
    const dY = Math.abs((p.y + 0.8) - pos.y);
    const maxY = it.yRadius ?? 4.5;
    if (dXZ <= it.radius && dY <= maxY && dXZ < bestDist) {
      bestDist = dXZ;
      best = it;
    }
  }
  currentPrompt = best;
}
