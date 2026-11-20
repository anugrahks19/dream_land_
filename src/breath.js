/**
 * Dreamback — The Breathing Cycle (Phase 3 — Core System, NEVER cut)
 * Uses a continuous phase accumulator so changing cycleLength (24->28->32->36s) never causes a pop.
 */

import { CONFIG } from './data.js';

let targetCycleLength = CONFIG.breath.cycleLengths[0];
let currentCycleLength = CONFIG.breath.cycleLengths[0];
let speedMult = 1.0;
let finalExhaleMode = false;
let finalExhaleProgress = 0;

export function initBreath(state) {
  targetCycleLength = CONFIG.breath.cycleLengths[0];
  currentCycleLength = targetCycleLength;
  speedMult = 1.0;
  finalExhaleMode = false;
  finalExhaleProgress = 0;

  state.breath = {
    phase: 0, // Continuous 0..1 repeating accumulator
    t: 0,
    value: 0, // 0..1 smooth cosine wave: 0 = full exhale, 1 = full inhale
    prevValue: 0,
    inhaling: true,
    exhaleFactor: 0, // 0..1 peaks smoothly during exhale
    cycleLength: currentCycleLength,
    targetCycleLength,
    amplitude: CONFIG.breath.baseAmplitude,
    windX: 0,
    windZ: 0,
  };
}

export function setCycleForFragments(count) {
  const arr = CONFIG.breath.cycleLengths;
  const idx = Math.max(0, Math.min(arr.length - 1, count));
  targetCycleLength = arr[idx];
}

export function triggerFinalExhale() {
  finalExhaleMode = true;
  finalExhaleProgress = 0;
}

export function updateBreath(dt, state) {
  const b = state.breath;
  b.prevValue = b.value;
  b.t += dt;

  if (finalExhaleMode) {
    // One long, deep, happy exhale during the ending sequence
    finalExhaleProgress = Math.min(1, finalExhaleProgress + dt / 9.0);
    const ease = 1 - Math.pow(1 - finalExhaleProgress, 2.2);
    b.value = b.value * (1 - ease * 0.08);
    b.inhaling = false;
    b.exhaleFactor = Math.sin(finalExhaleProgress * Math.PI) * 0.6;
    b.windX = b.exhaleFactor * 2.0;
    b.windZ = 0;
    return;
  }

  // Ease cycleLength smoothly over ~4s without popping phase
  const easeRate = 1 - Math.exp(-dt / (CONFIG.breath.cycleEaseSeconds * 0.4));
  currentCycleLength += (targetCycleLength - currentCycleLength) * easeRate;
  b.cycleLength = currentCycleLength;
  b.targetCycleLength = targetCycleLength;

  // Smooth restlessness breathing speedup (>= 50 restlessness -> 1.12x)
  const wantMult = state.restlessness >= CONFIG.breath.restlessThreshold ? CONFIG.breath.restlessSpeedMult : 1.0;
  speedMult += (wantMult - speedMult) * (1 - Math.exp(-dt * 2.5));

  const effectiveCycle = currentCycleLength / speedMult;
  b.phase = (b.phase + dt / effectiveCycle) % 1.0;

  // breath = 0.5 - 0.5 * cos(2*PI*phase) -> 0..1..0
  const angle = b.phase * Math.PI * 2;
  b.value = 0.5 - 0.5 * Math.cos(angle);
  b.inhaling = b.phase < 0.5;

  // Exhale wind peaks cleanly in the middle of exhale (phase 0.5..1.0)
  const rawExhale = b.inhaling ? 0 : Math.sin((b.phase - 0.5) * 2 * Math.PI);
  b.exhaleFactor = Math.max(0, rawExhale);

  const gustNoise = 0.8 + 0.2 * Math.sin(b.t * 0.9) + 0.1 * Math.cos(b.t * 1.7);
  b.windX = b.exhaleFactor * CONFIG.breath.windMagnitude * gustNoise;
  b.windZ = b.exhaleFactor * 0.75 * Math.sin(b.t * 0.55);
}

export function getBreath(state) {
  return state?.breath?.value ?? 0;
}

export function getBreathPhase(state) {
  return state?.breath?.phase ?? 0;
}

export function getWind(x, z, state) {
  const b = state.breath;
  const swirl = 0.88 + 0.12 * Math.sin(x * 0.04 + b.t * 1.1) * Math.cos(z * 0.05);
  return { x: b.windX * swirl, z: b.windZ * swirl };
}
