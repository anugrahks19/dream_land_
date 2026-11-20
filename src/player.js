/**
 * Dreamback — Pip Controller with Full Solid Object Collision, Standable Platforms,
 * Vine Pendulum, Ladder Climb & Live 3D Cinematic Camera Director (Menu, Intro Beats 1-3, Ending).
 */

import * as THREE from 'three';
import { CONFIG, CLIMBABLES, WIND_CORRIDORS, CAVERN_GATE } from './data.js';
import {
  getHeightAt,
  getBaseHeightAt,
  getNormalAt,
  getTerrainMesh,
  getSolidColliders,
  getStandablePlatforms,
  getVines,
  getBreathPlatforms,
  getGateDoors,
} from './world.js';
import { getWind } from './breath.js';
import { getMat, getSprite, getTokens } from './tex-bridge.js';
import { playJump, playLand, playVineGrab } from './audio.js';
import { getChallengeCameraFX, getChallengeSpeedMult } from './challenges.js';

let pipGroup = null;
let pipVisual = null;
let pipLegs = [];
let pipAntennae = [];
let pipLanternHalo = null;
let pipShadow = null;
let pipBulbMesh = null;
let footprintPool = [];
let footprintIdx = 0;
let footprintDist = 0;

const keys = Object.create(null);
let jumpBufferTimer = 0;
let coyoteTimer = 0;
let vineCooldown = 0;
let pointerLocked = false;
let mouseDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let prevGroundY = 0;
let wasGrounded = true;
let squashY = 1.0;
let walkPhase = 0;
let respawnLock = false;
let lastSafeMovePos = new THREE.Vector3();
let stuckTimer = 0;

const camState = {
  yaw: CONFIG.camera.defaultYaw,
  pitch: CONFIG.camera.defaultPitch,
  distance: CONFIG.camera.distance,
  targetPos: new THREE.Vector3(),
  initialized: false,
  lastMode: null,
};

const raycaster = new THREE.Raycaster();
const tmpVec = new THREE.Vector3();

// =========================================================================
// Build Pip from Textured Primitives (char.pip.*)
// =========================================================================
function buildPipMesh(scene) {
  const pipColors = getTokens().pip;
  const shellMat = getMat('char.pip.shell', new THREE.MeshStandardMaterial({ color: pipColors.shellBase, roughness: 0.52 }));
  const eyeMat = getMat('char.pip.eye', new THREE.MeshStandardMaterial({ color: pipColors.eyeDark, roughness: 0.22 }));
  const leafMat = getMat('char.pip.leaf', new THREE.MeshStandardMaterial({ color: pipColors.leafBase, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide }));
  const bulbMat = getMat('char.pip.bulb', new THREE.MeshStandardMaterial({ color: pipColors.bulbEmissive, emissive: pipColors.bulbEmissive, emissiveIntensity: 1.6 }));
  const limbMat = new THREE.MeshStandardMaterial({ color: '#4A3B2A', roughness: 0.78 });

  pipGroup = new THREE.Group();
  pipVisual = new THREE.Group();
  pipGroup.add(pipVisual);

  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.56, 18, 14), shellMat);
  abdomen.position.set(0, 0.72, -0.56);
  abdomen.scale.set(0.95, 0.9, 1.15);
  abdomen.castShadow = true;

  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), shellMat);
  thorax.position.set(0, 0.78, 0.05);
  thorax.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 14), shellMat);
  head.position.set(0, 0.98, 0.56);
  head.castShadow = true;

  for (const sx of [-0.24, 0.24]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), eyeMat);
    eye.position.set(sx, 1.08, 0.92);
    eye.rotation.y = Math.PI * 0.5;
    pipVisual.add(eye);
  }

  pipAntennae = [];
  for (const sx of [-0.16, 0.16]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.35, 0.68);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.5, 6), limbMat);
    stalk.position.y = 0.24;
    stalk.rotation.z = sx > 0 ? -0.35 : 0.35;
    stalk.rotation.x = 0.35;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), shellMat);
    tip.position.set(sx > 0 ? 0.16 : -0.16, 0.45, 0.14);
    pivot.add(stalk, tip);
    pipVisual.add(pivot);
    pipAntennae.push(pivot);
  }

  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.1), leafMat);
  leaf.position.set(0, 1.16, -0.38);
  leaf.rotation.x = -0.82;
  pipVisual.add(leaf);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.85, 6), limbMat);
  stem.position.set(0, 1.45, -0.25);
  stem.rotation.x = 0.55;
  pipBulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bulbMat);
  pipBulbMesh.position.set(0, 1.72, 0.15);
  pipLanternHalo = new THREE.Sprite(getSprite('fx.halo.warm', '#FFC77A', true));
  pipLanternHalo.position.copy(pipBulbMesh.position);
  pipLanternHalo.scale.set(2.6, 2.6, 1);
  pipVisual.add(stem, pipBulbMesh, pipLanternHalo);

  pipLegs = [];
  const legZ = [-0.32, 0.02, 0.34];
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const lPivot = new THREE.Group();
      lPivot.position.set(side * 0.34, 0.55, legZ[i]);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.58, 6), limbMat);
      leg.position.set(side * 0.12, -0.26, 0);
      leg.rotation.z = side * 0.38;
      lPivot.add(leg);
      pipVisual.add(lPivot);
      pipLegs.push({ pivot: lPivot, phase: i * 1.1 + (side > 0 ? 0 : Math.PI) });
    }
  }

  pipVisual.add(abdomen, thorax, head);

  const shadowMat = getMat('fx.shadow', new THREE.MeshBasicMaterial({ color: '#2C4A47', transparent: true, opacity: 0.42, depthWrite: false }));
  pipShadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), shadowMat);
  pipShadow.rotation.x = -Math.PI / 2;
  pipShadow.position.y = 0.08;
  pipGroup.add(pipShadow);

  scene.add(pipGroup);

  const fpMat = getMat('fx.footprint', new THREE.MeshBasicMaterial({ color: '#F4E9CD', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  footprintPool = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), fpMat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    footprintPool.push({ mesh: m, life: 0 });
  }
}

// =========================================================================
// Solid Object Collision Solver (Trees, Cottages, Towers, Boulders, Walls, etc.)
// =========================================================================
function resolveSolidCollisions(nextX, nextY, nextZ, playerRadius, breathVal = 0) {
  let x = nextX;
  let z = nextZ;
  const colliders = getSolidColliders();
  const amp = CONFIG.breath.baseAmplitude;

  // 2 solver passes prevent corner tunneling between adjacent trees/walls
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const lift = breathVal * amp * (c.mask ?? 0);
      // Skip if Pip is standing cleanly above the obstacle
      if (nextY >= c.topY + lift - 0.15 || nextY + CONFIG.player.height < c.bottomY + lift) continue;

      if (c.type === 'cylinder') {
        const dx = x - c.x;
        const dz = z - c.z;
        const minDist = c.r + playerRadius;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDist * minDist) {
          const d = Math.sqrt(dSq);
          if (d > 1e-4) {
            const push = minDist - d;
            x += (dx / d) * push;
            z += (dz / d) * push;
          } else {
            x += minDist;
          }
        }
      } else if (c.type === 'box') {
        // Circle-vs-AABB closest-point push-out
        const minX = c.x - c.hx, maxX = c.x + c.hx;
        const minZ = c.z - c.hz, maxZ = c.z + c.hz;
        const clampedX = Math.max(minX, Math.min(maxX, x));
        const clampedZ = Math.max(minZ, Math.min(maxZ, z));
        const dx = x - clampedX;
        const dz = z - clampedZ;
        const dSq = dx * dx + dz * dz;

        if (dSq < playerRadius * playerRadius) {
          if (dSq > 1e-6) {
            const d = Math.sqrt(dSq);
            const push = playerRadius - d;
            x += (dx / d) * push;
            z += (dz / d) * push;
          } else {
            // Center inside AABB: push out along shallowest axis
            const penL = Math.abs(x - minX), penR = Math.abs(maxX - x);
            const penD = Math.abs(z - minZ), penU = Math.abs(maxZ - z);
            const m = Math.min(penL, penR, penD, penU);
            if (m === penL) x = minX - playerRadius;
            else if (m === penR) x = maxX + playerRadius;
            else if (m === penD) z = minZ - playerRadius;
            else z = maxZ + playerRadius;
          }
        }
      }
    }
  }
  return { x, z };
}

export function initPlayer(scene, canvas, state, callbacks = {}) {
  buildPipMesh(scene);

  const sx = state.checkpoint?.x ?? CONFIG.player.spawnPos.x;
  const sz = state.checkpoint?.z ?? CONFIG.player.spawnPos.z;
  const sy = getHeightAt(sx, sz);

  state.player = {
    x: sx, y: sy, z: sz,
    vx: 0, vy: 0, vz: 0,
    yaw: Math.PI * 0.5,
    speed: 0,
    grounded: true,
    sprinting: false,
    climbing: null,
    attachedVine: null,
    talkWaveTimer: 0,
    visualY: sy,
  };
  prevGroundY = sy;
  pipGroup.position.set(sx, sy, sz);
  lastSafeMovePos.set(sx, sy, sz);

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' && !e.repeat) jumpBufferTimer = CONFIG.player.jumpBuffer;
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    mouseDragging = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (state.mode !== 'play') return;
    mouseDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch { /* ignore */ }
    }
  });
  window.addEventListener('mouseup', () => { mouseDragging = false; });
  document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });

  window.addEventListener('mousemove', (e) => {
    if (state.mode !== 'play') return;
    let dx = 0, dy = 0;
    if (pointerLocked) { dx = e.movementX || 0; dy = e.movementY || 0; }
    else if (mouseDragging) { dx = e.clientX - lastMouseX; dy = e.clientY - lastMouseY; lastMouseX = e.clientX; lastMouseY = e.clientY; }
    else return;
    camState.yaw -= dx * CONFIG.camera.mouseSensitivity;
    camState.pitch = Math.max(CONFIG.camera.pitchMin, Math.min(CONFIG.camera.pitchMax, camState.pitch + dy * CONFIG.camera.mouseSensitivity));
  });

  window.addEventListener('wheel', (e) => {
    if (state.mode !== 'play') return;
    camState.distance = Math.max(CONFIG.camera.minDistance, Math.min(CONFIG.camera.maxDistance, camState.distance + e.deltaY * 0.01));
  }, { passive: true });

  state._playerCallbacks = callbacks;
}

export function teleportPlayer(state, x, z, yOverride = null) {
  const p = state.player;
  const y = yOverride !== null ? yOverride : getHeightAt(x, z, state.breath.value) + 0.1;
  p.x = x; p.y = y; p.z = z;
  p.vx = 0; p.vy = 0; p.vz = 0;
  p.climbing = null;
  p.attachedVine = null;
  p.grounded = true;
  p.visualY = y;
  prevGroundY = y;
  pipGroup.position.set(x, y, z);
  lastSafeMovePos.set(x, y, z);
  stuckTimer = 0;
}

export function applyImpulse(state, ix, iy, iz) {
  const p = state.player;
  p.vx += ix;
  p.vy = Math.max(p.vy, iy);
  p.vz += iz;
  p.grounded = false;
}

export function triggerTalkWave(state) {
  if (state.player) state.player.talkWaveTimer = 1.1;
}

export function updatePlayer(dt, state) {
  const p = state.player;
  if (!p) return;

  if (pipLanternHalo && pipBulbMesh) {
    // Show glowing lantern during intro Beat 3 ("Pip sets out") or once Grandma grants it
    const showLantern = Boolean(state.flags.hasLantern) || state.mode === 'intro' || state.mode === 'title';
    pipBulbMesh.visible = showLantern;
    pipLanternHalo.visible = showLantern;
    if (showLantern) {
      const humBoost = state.lantern?.pulseTimer > 0 ? 1.9 : 1.0;
      const flicker = 0.92 + 0.14 * Math.sin(state.breath.t * 8.5) * Math.cos(state.breath.t * 5.2);
      const sc = 2.4 * flicker * humBoost;
      pipLanternHalo.scale.set(sc, sc, 1);
    }
  }

  if (state.mode !== 'play' || state.dialogueActive) {
    p.vx *= Math.exp(-dt * 10);
    p.vz *= Math.exp(-dt * 10);
    p.speed = 0;
    const gy = getHeightAt(p.x, p.z, state.breath.value);
    if (p.grounded) { p.y = gy; p.visualY += (gy - p.visualY) * Math.min(1, dt * 10); }
    pipGroup.position.set(p.x, p.visualY, p.z);
    pipGroup.rotation.y = p.yaw;
    animatePip(dt, state);
    return;
  }

  if (jumpBufferTimer > 0) jumpBufferTimer -= dt;
  if (vineCooldown > 0) vineCooldown -= dt;

  let inF = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let inR = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const inLen = Math.hypot(inF, inR);
  if (inLen > 1) { inF /= inLen; inR /= inLen; }

  const forwardX = -Math.sin(camState.yaw);
  const forwardZ = -Math.cos(camState.yaw);
  const rightX = Math.cos(camState.yaw);
  const rightZ = -Math.sin(camState.yaw);

  const wishX = forwardX * inF + rightX * inR;
  const wishZ = forwardZ * inF + rightZ * inR;

  // --- MODE A: Swinging Vine Pendulum ---
  if (p.attachedVine) {
    const v = p.attachedVine;
    const pump = (wishX * 1.4 + state.breath.exhaleFactor * 1.2) * dt;
    v.angVel += (-Math.sin(v.angle) * 2.8 + pump) * dt * 3.2;
    v.angVel *= Math.exp(-dt * 0.45);
    v.angle = Math.max(-1.05, Math.min(1.05, v.angle + v.angVel * dt));
    v.pivot.rotation.z = v.angle;
    v.worldEnd.set(v.anchor.x + Math.sin(v.angle) * v.cfg.length, v.anchor.y - Math.cos(v.angle) * v.cfg.length, v.anchor.z);
    p.x = v.worldEnd.x; p.y = v.worldEnd.y - 0.8; p.z = v.worldEnd.z; p.visualY = p.y; p.grounded = false;

    if (jumpBufferTimer > 0) {
      jumpBufferTimer = 0;
      const tangVx = Math.cos(v.angle) * v.angVel * v.cfg.length;
      p.vx = tangVx + CONFIG.forest.vineLaunchBoost * (inF >= 0 ? 1 : 0.4);
      p.vy = CONFIG.player.jumpVelocity * 0.96;
      p.vz = wishZ * 8.0;
      p.attachedVine = null;
      vineCooldown = CONFIG.forest.vineCooldown;
      squashY = 1.28;
      playJump();
    }
    pipGroup.position.set(p.x, p.visualY, p.z);
    animatePip(dt, state);
    return;
  }

  // --- MODE B: Ladder-Style Climbing ---
  if (p.climbing) {
    const cl = p.climbing;
    p.y += inF * CONFIG.player.climbSpeed * dt;
    p.z = Math.max(cl.z - cl.width * 0.48, Math.min(cl.z + cl.width * 0.48, p.z + inR * 3.5 * dt));
    p.x = cl.x + cl.normalX * 1.15;
    p.vx = 0; p.vy = 0; p.vz = 0; p.visualY = p.y;

    const botY = getHeightAt(cl.x, cl.z, state.breath.value);
    const topY = botY + cl.height;
    if (p.y >= topY - 0.15) {
      p.x = cl.x - cl.normalX * 1.5;
      p.y = topY + 0.35;
      p.vy = 5.0;
      p.climbing = null;
    } else if (p.y <= botY && inF < 0) {
      p.y = botY;
      p.climbing = null;
    } else if (jumpBufferTimer > 0) {
      jumpBufferTimer = 0;
      p.vx = cl.normalX * 8.5;
      p.vy = CONFIG.player.jumpVelocity * 0.85;
      p.climbing = null;
      playJump();
    }
    pipGroup.position.set(p.x, p.visualY, p.z);
    animatePip(dt, state);
    return;
  }

  // --- MODE C: Ground & Air Physics with FULL Solid Collision ---
  p.sprinting = Boolean(keys.ShiftLeft || keys.ShiftRight);
  const maxSpd = (p.sprinting ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed) * getChallengeSpeedMult();
  const accel = p.grounded ? CONFIG.player.accel : CONFIG.player.accel * CONFIG.player.airControl;

  p.vx += (wishX * maxSpd - p.vx) * Math.min(1, accel * dt);
  p.vz += (wishZ * maxSpd - p.vz) * Math.min(1, accel * dt);

  const wind = getWind(p.x, p.z, state);
  let windMult = p.sprinting ? 0.35 : 0.65;
  for (const cor of WIND_CORRIDORS) {
    if (p.x >= cor.xMin && p.x <= cor.xMax && p.z >= cor.zMin && p.z <= cor.zMax) {
      windMult = 1.0;
      p.vx += cor.dirX * state.breath.exhaleFactor * CONFIG.breath.corridorWindBoost * dt;
    }
  }
  p.vx += wind.x * windMult * dt;
  p.vz += wind.z * windMult * dt;

  const hSpd = Math.hypot(p.vx, p.vz);
  if (hSpd > CONFIG.player.sprintSpeed * 1.45) {
    const s = (CONFIG.player.sprintSpeed * 1.45) / hSpd;
    p.vx *= s; p.vz *= s;
  }

  if (p.grounded) coyoteTimer = CONFIG.player.coyoteTime;
  else coyoteTimer = Math.max(0, coyoteTimer - dt);

  if (jumpBufferTimer > 0 && coyoteTimer > 0) {
    p.vy = CONFIG.player.jumpVelocity;
    p.grounded = false;
    coyoteTimer = 0;
    jumpBufferTimer = 0;
    squashY = 1.32;
    playJump();
  }

  p.vy -= CONFIG.player.gravity * dt;

  let nextX = Math.max(CONFIG.world.minX, Math.min(CONFIG.world.maxX, p.x + p.vx * dt));
  let nextZ = Math.max(CONFIG.world.minZ, Math.min(CONFIG.world.maxZ, p.z + p.vz * dt));
  let nextY = p.y + p.vy * dt;

  // Closed Caverns Echo Shrine door (compact doorway only — open-world: Pip can freely roam around into The Crown!)
  const gate = getGateDoors();
  if (gate && !gate.isOpen) {
    if (
      Math.abs(nextX - CAVERN_GATE.x) < 2.0 &&
      Math.abs(nextZ - CAVERN_GATE.z) < CAVERN_GATE.width * 0.55 &&
      nextY < getHeightAt(CAVERN_GATE.x, nextZ, state.breath.value) + CAVERN_GATE.height
    ) {
      nextX = p.x < CAVERN_GATE.x ? CAVERN_GATE.x - 2.05 : CAVERN_GATE.x + 2.05;
      p.vx = 0;
    }
  }

  // FULL SOLID OBJECT COLLISION (every tree, cottage, tower, boulder, barrel, reed wall, rib pillar, crystal, bridge rail!)
  const resolved = resolveSolidCollisions(nextX, nextY, nextZ, CONFIG.player.radius, state.breath.value);
  if (Math.abs(resolved.x - nextX) > 0.001) p.vx *= 0.25;
  if (Math.abs(resolved.z - nextZ) > 0.001) p.vz *= 0.25;
  nextX = resolved.x;
  nextZ = resolved.z;

  // Ground support: terrain + ALL registered standable platforms + active breath platforms!
  const terrY = getHeightAt(nextX, nextZ, state.breath.value);
  let supportY = terrY;

  for (const sp of getStandablePlatforms()) {
    if (Math.abs(nextX - sp.x) <= sp.hx + 0.35 && Math.abs(nextZ - sp.z) <= sp.hz + 0.35) {
      const breathLift = state.breath.value * CONFIG.breath.baseAmplitude * (sp.mask ?? 0.25);
      const py = sp.topY + breathLift;
      if (p.y >= py - 1.5) supportY = Math.max(supportY, py);
    }
  }

  for (const bp of getBreathPlatforms()) {
    if (!bp.active) continue;
    if (Math.abs(nextX - bp.cfg.x) <= bp.cfg.w * 0.52 && Math.abs(nextZ - bp.cfg.z) <= bp.cfg.d * 0.52) {
      const py = bp.mesh.position.y + 0.45;
      if (p.y >= py - 1.5) supportY = Math.max(supportY, py);
    }
  }

  const groundDelta = supportY - prevGroundY;
  if (p.grounded && p.vy <= 0 && nextY <= supportY + 0.65) {
    nextY = supportY;
    p.vy = 0;
    p.grounded = true;
  } else if (nextY <= supportY) {
    if (!wasGrounded && p.vy < -5) { squashY = 0.72; playLand(); }
    nextY = supportY;
    p.vy = 0;
    p.grounded = true;
  } else {
    p.grounded = false;
  }

  if (p.grounded && Math.abs(supportY - terrY) < 0.25) {
    const norm = getNormalAt(nextX, nextZ, state.breath.value);
    const maxCos = Math.cos((CONFIG.world.maxSlopeDeg * Math.PI) / 180);
    if (norm.y < maxCos) {
      nextX += norm.x * 12 * dt;
      nextZ += norm.z * 12 * dt;
    }
  }

  // Ladder-style climb attachment
  if (inF > 0.3) {
    for (const cl of CLIMBABLES) {
      const distX = Math.abs(nextX - (cl.x + cl.normalX * 1.15));
      const distZ = Math.abs(nextZ - cl.z);
      const botY = getHeightAt(cl.x, cl.z, state.breath.value);
      const topY = botY + cl.height;
      if (distX < 1.85 && distZ < cl.width * 0.58 && nextY >= botY - 0.5 && nextY < topY - 0.6) {
        p.climbing = cl;
        break;
      }
    }
  }

  // Vine grab in mid-air
  if (!p.grounded && vineCooldown <= 0 && (keys.Space || keys.KeyE)) {
    for (const v of getVines()) {
      const d = Math.hypot(nextX - v.worldEnd.x, nextY + 0.8 - v.worldEnd.y, nextZ - v.worldEnd.z);
      if (d < CONFIG.forest.vineGrabRadius) {
        p.attachedVine = v;
        v.angVel = Math.max(0.45, p.vx / Math.max(6, v.cfg.length));
        jumpBufferTimer = 0;
        playVineGrab();
        break;
      }
    }
  }

  p.x = nextX; p.y = nextY; p.z = nextZ;
  p.speed = Math.hypot(p.vx, p.vz);
  prevGroundY = supportY;
  wasGrounded = p.grounded;

  const yLerp = p.grounded ? 1 - Math.exp(-dt * 24) : 1.0;
  p.visualY = p.grounded ? p.visualY + (p.y - p.visualY) * yLerp + groundDelta * 0.15 : p.y;
  if (Math.abs(p.visualY - p.y) > 1.2) p.visualY = p.y;

  if (p.speed > 0.8) {
    const targetYaw = Math.atan2(p.vx, p.vz);
    let diff = targetYaw - p.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.yaw += diff * Math.min(1, dt * 11);
  }

  pipGroup.position.set(p.x, p.visualY, p.z);
  pipGroup.rotation.y = p.yaw;

  if (!respawnLock && (p.y < terrY + CONFIG.player.fallRespawnOffset || Math.abs(p.z) > 154.0)) {
    respawnLock = true;
    state._playerCallbacks?.onFallRespawn?.(() => { respawnLock = false; });
  }

  if (pipGroup.position.distanceTo(lastSafeMovePos) > 2.2) {
    lastSafeMovePos.copy(pipGroup.position);
    stuckTimer = 0;
    state.flags.showRescueHint = false;
  } else {
    stuckTimer += dt;
    if (stuckTimer > 20) state.flags.showRescueHint = true;
  }

  // Footprint flowers
  if (p.grounded && p.speed > 3.0) {
    footprintDist += p.speed * dt;
    if (footprintDist > 3.2) {
      footprintDist = 0;
      const fp = footprintPool[footprintIdx % footprintPool.length];
      footprintIdx++;
      fp.mesh.position.set(p.x, p.y + 0.12, p.z);
      fp.mesh.rotation.z = Math.random() * Math.PI * 2;
      fp.mesh.scale.setScalar(0.8);
      fp.mesh.visible = true;
      fp.life = 5.5;
    }
  }
  for (const fp of footprintPool) {
    if (fp.life > 0) {
      fp.life -= dt;
      if (fp.life <= 0) fp.mesh.visible = false;
      else if (fp.life < 1.2) fp.mesh.scale.setScalar(0.8 * (fp.life / 1.2));
    }
  }

  animatePip(dt, state);
}

function animatePip(dt, state) {
  const p = state.player;
  const t = state.breath.t;

  squashY += (1.0 - squashY) * Math.min(1, dt * 11);
  const invSq = 1 / Math.sqrt(squashY);
  pipVisual.scale.set(invSq, squashY, invSq);

  if (p.grounded && p.speed > 0.6) {
    walkPhase += dt * (p.sprinting ? 18 : 12);
    pipVisual.position.y = Math.abs(Math.sin(walkPhase)) * 0.12;
  } else {
    pipVisual.position.y = Math.sin(t * 2.4) * 0.04;
  }

  for (const l of pipLegs) {
    l.pivot.rotation.x = p.grounded && p.speed > 0.6 ? Math.sin(walkPhase + l.phase) * 0.55 : 0;
  }

  if (p.talkWaveTimer > 0) p.talkWaveTimer -= dt;
  const waveAmp = p.talkWaveTimer > 0 ? 0.45 : 0.12;
  const waveFreq = p.talkWaveTimer > 0 ? 14 : 3.2;
  pipAntennae.forEach((ant, i) => { ant.rotation.x = Math.sin(t * waveFreq + i * 1.4) * waveAmp; });

  pipVisual.position.x = (state.restlessness >= CONFIG.restlessness.vignetteThreshold && state.mode === 'play')
    ? Math.sin(t * 38) * 0.045 : 0;

  if (pipShadow) {
    const gy = getHeightAt(p.x, p.z, state.breath.value);
    const heightAbove = Math.max(0, p.visualY - gy);
    pipShadow.position.y = -heightAbove + 0.1;
    pipShadow.scale.setScalar(Math.max(0.35, 1.0 - heightAbove * 0.08));
  }
}

// =========================================================================
// Live 3D Cinematic Camera Director (Animated Title, Live 3D Intro Beats 1-3, Play, Lose, Ending!)
// =========================================================================
export function updateCamera(dt, state, camera) {
  const p = state.player;
  if (!p) return;
  const t = state.breath.t;

  // 1. ANIMATED TITLE / MENU DIORAMA CAMERA — Sweeping golden-hour vista over Tiny Glade colony & stone tower!
  if (state.mode === 'loading' || state.mode === 'title') {
    const cx = -286 + Math.sin(t * 0.08) * 12;
    const cz = 29 + Math.cos(t * 0.08) * 8;
    const cy = getBaseHeightAt(cx, cz) + 15.2 + Math.sin(t * 0.22) * 1.1;
    if (camState.lastMode !== 'title' && camState.lastMode !== 'loading') {
      camera.position.set(cx, cy, cz);
    } else {
      camera.position.lerp(tmpVec.set(cx, cy, cz), Math.min(1, dt * 3.0 + 0.06));
    }
    camState.lastMode = state.mode;
    camera.lookAt(-222, getBaseHeightAt(-222, -4) + 5.2, -4);
    return;
  }

  // 2. LIVE 3D CINEMATIC STORYTELLING INTRO BEATS (1, 2, 3 — zero flat cartoon cards!)
  if (state.mode === 'intro') {
    camState.lastMode = 'intro';
    const beat = state.introBeat || 0;
    const bt = state.introBeatTime || 0;
    if (beat === 0) {
      // Beat 1: Sweeping low dolly across sunlit Tail Marshes colony & stone tower
      const cx = -278 + bt * 10;
      const cz = 34 - bt * 2.5;
      const cy = getBaseHeightAt(cx, cz) + 17;
      camera.position.set(cx, cy, cz);
      camera.lookAt(-205 + bt * 6, getBaseHeightAt(-205, -6) + 5, -6);
    } else if (beat === 1) {
      // Beat 2: Atmospheric glide through golden Spine Forest canopy & Rib Caverns arches
      const cx = -65 + bt * 24;
      const cz = 30 - bt * 2.2;
      const cy = getBaseHeightAt(cx, cz) + 21;
      camera.position.set(cx, cy, cz);
      camera.lookAt(cx + 55, getBaseHeightAt(cx + 55, 0) + 10, 0);
    } else {
      // Beat 3: Heroic close-up of Pip on the mossy sunlit ridge facing the distant Crown!
      const py = getHeightAt(p.x, p.z, state.breath.value);
      const cx = p.x - 6.5 - bt * 0.7;
      const cz = p.z + 5.8 - bt * 0.4;
      camera.position.set(cx, py + 3.4 + bt * 0.25, cz);
      camera.lookAt(p.x + 18, py + 2.4, p.z - 2);
    }
    return;
  }

  // 3. GENTLE LOSE DRIFT
  if (state.mode === 'lose') {
    camState.lastMode = 'lose';
    const cx = p.x - 16 + Math.sin(t * 0.2) * 8;
    const cz = p.z + 22;
    camera.position.lerp(tmpVec.set(cx, p.visualY + 14, cz), Math.min(1, dt * 2));
    camera.lookAt(p.x, p.visualY + 2, p.z);
    return;
  }

  // 4. ENDING & CREDITS SOARING PULLBACK + DAWN ORBIT
  if (state.mode === 'ending' || state.mode === 'ended') {
    camState.lastMode = state.mode;
    const ep = Math.min(1, state.ending?.progress || 0);
    const ease = ep * ep * (3 - 2 * ep);
    const fromPos = new THREE.Vector3(p.x - 16, p.y + 10, p.z + 18);
    const orbit = state.mode === 'ended' ? (t * 0.06) : 0;
    const toPos = new THREE.Vector3(20 + Math.sin(orbit) * 65, 205, 255 + Math.cos(orbit) * 35);
    camera.position.lerpVectors(fromPos, toPos, ease);
    camera.fov = 60 + ease * 12;
    camera.far = 950 + ease * 950;
    camera.updateProjectionMatrix();
    camera.lookAt(THREE.MathUtils.lerp(p.x + 12, 0, ease), THREE.MathUtils.lerp(p.y + 2, 16, ease), 0);
    return;
  }

  // 5. PLAY MODE: Smooth Terrain-Collision-Safe Third-Person Follow Camera
  const enteringPlay = !camState.initialized || camState.lastMode !== 'play';
  if (enteringPlay) {
    camState.targetPos.set(p.x, p.visualY + 2.2, p.z);
    camState.initialized = true;
    camState.lastMode = 'play';
  }
  const fXZ = 1 - Math.exp(-CONFIG.camera.followLerp * dt);
  const fY = 1 - Math.exp(-CONFIG.camera.yFollowLerp * dt);
  camState.targetPos.x += (p.x - camState.targetPos.x) * fXZ;
  camState.targetPos.z += (p.z - camState.targetPos.z) * fXZ;
  camState.targetPos.y += (p.visualY + 2.2 - camState.targetPos.y) * fY;

  const horizDist = Math.cos(camState.pitch) * camState.distance;
  const desired = new THREE.Vector3(
    camState.targetPos.x + Math.sin(camState.yaw) * horizDist,
    camState.targetPos.y + Math.sin(camState.pitch) * camState.distance + 1.5,
    camState.targetPos.z + Math.cos(camState.yaw) * horizDist
  );

  const terrain = getTerrainMesh();
  if (terrain) {
    const dir = tmpVec.copy(desired).sub(camState.targetPos);
    const maxLen = dir.length();
    if (maxLen > 0.5) {
      raycaster.set(camState.targetPos, dir.normalize());
      raycaster.far = maxLen;
      const hits = raycaster.intersectObject(terrain, false);
      if (hits.length > 0 && hits[0].distance < maxLen - 0.8) {
        desired.copy(camState.targetPos).addScaledVector(dir, Math.max(3.5, hits[0].distance - 0.8));
      }
    }
  }

  const groundAtCam = getHeightAt(desired.x, desired.z, state.breath.value);
  if (desired.y < groundAtCam + 1.8) desired.y = groundAtCam + 1.8;

  // Solid structure collision prevention (cottages, tower, cavern walls, rib pillars) so camera never clips inside buildings
  const camDir = tmpVec.copy(desired).sub(camState.targetPos);
  const camDist = camDir.length();
  if (camDist > 1.0) {
    const colliders = getSolidColliders();
    const bAmp = state.breath.value * CONFIG.breath.baseAmplitude;
    let bestT = 1.0;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.label !== 'cottage' && c.label !== 'lookout_tower' && c.label !== 'cavern_wall' && c.label !== 'rib_base') continue;
      const lift = bAmp * (c.mask ?? 0);
      // Sample 4 points along camera ray for fast, allocation-free obstacle pullback
      for (let s = 1; s <= 4; s++) {
        const frac = s * 0.25;
        if (frac >= bestT) break;
        const sx = camState.targetPos.x + camDir.x * frac;
        const sy = camState.targetPos.y + camDir.y * frac;
        const sz = camState.targetPos.z + camDir.z * frac;
        if (sy > c.topY + lift || sy < c.bottomY + lift) continue;
        if (c.type === 'cylinder') {
          if (Math.hypot(sx - c.x, sz - c.z) < c.r + 0.65) { bestT = Math.max(0.28, frac - 0.14); break; }
        } else if (c.type === 'box') {
          if (Math.abs(sx - c.x) < c.hx + 0.65 && Math.abs(sz - c.z) < c.hz + 0.65) { bestT = Math.max(0.28, frac - 0.14); break; }
        }
      }
    }
    if (bestT < 1.0) desired.copy(camState.targetPos).addScaledVector(camDir, bestT);
  }

  if (state.restlessness >= CONFIG.restlessness.swayThreshold) {
    const sway = ((state.restlessness - 50) / 50) * 0.45;
    desired.x += Math.sin(t * 2.1) * sway;
    desired.y += Math.cos(t * 1.7) * sway * 0.6;
  }

  // Living-Giant Challenge camera shake & sleep-roll horizon tilt
  const chFX = getChallengeCameraFX();
  desired.x += chFX.shakeX;
  desired.y += chFX.shakeY;

  if (enteringPlay) {
    camera.position.copy(desired);
  } else {
    camera.position.lerp(desired, 1 - Math.exp(-12 * dt));
    const camGround = getHeightAt(camera.position.x, camera.position.z, state.breath.value);
    if (camera.position.y < camGround + 1.5) camera.position.y = camGround + 1.5;
  }
  camera.lookAt(camState.targetPos);
  if (Math.abs(chFX.rollZ) > 0.0005) {
    camera.rotateZ(chFX.rollZ);
  }
}
