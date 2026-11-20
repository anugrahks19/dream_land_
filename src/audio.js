/**
 * Dreamback — Cozy Procedural Web Audio Engine (Phases 3, 4, 5, 6, 7)
 * Master compressor/limiter so nothing is ever loud or harsh.
 * Breath noise+drone, layered pentatonic music, per-zone ambient beds, Surge pad, Ending chord, and all soft SFX.
 */

import { CONFIG, zoneAt } from './data.js';

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let breathFilter = null;
let breathGain = null;
let droneOsc = null;
let droneGain = null;
let rumbleGain = null;
let surgeGain = null;
let muted = false;
let volume = 0.72;
let started = false;
let pluckTimer = 0;
let dripTimer = 0;
let footstepTimer = 0;
let chordIdx = 0;

// Warm major-pentatonic notes (F major / D minor cozy golden-hour scale)
const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
const PAD_CHORDS = [
  [174.61, 220.00, 261.63, 329.63], // Fmaj7
  [196.00, 246.94, 293.66, 349.23], // G6/add9 feel
  [220.00, 261.63, 329.63, 392.00], // Am7
  [146.83, 220.00, 261.63, 329.63], // Dm9
];

function loadPrefs() {
  try {
    const raw = localStorage.getItem(CONFIG.save.audioKey);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.muted === 'boolean') muted = p.muted;
      if (typeof p.volume === 'number') volume = Math.max(0, Math.min(1, p.volume));
    }
  } catch { /* ignore */ }
}

function savePrefs() {
  try {
    localStorage.setItem(CONFIG.save.audioKey, JSON.stringify({ muted, volume }));
  } catch { /* ignore */ }
}

export function initAudio() {
  loadPrefs();
}

export function isMuted() {
  return muted;
}

export function getVolume() {
  return volume;
}

export function setMasterVolume(v) {
  volume = Math.max(0, Math.min(1, Number(v) || 0));
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(muted ? 0 : volume * 0.65, ctx.currentTime, 0.06);
  }
  savePrefs();
}

export function toggleMute() {
  muted = !muted;
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(muted ? 0 : volume * 0.65, ctx.currentTime, 0.06);
  }
  savePrefs();
  return muted;
}

function createNoiseBuffer(audioCtx, seconds = 3) {
  const len = audioCtx.sampleRate * seconds;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  // Pink-ish warm filtered noise
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + white * 0.029;
    b1 = 0.985 * b1 + white * 0.032;
    b2 = 0.950 * b2 + white * 0.048;
    data[i] = (b0 + b1 + b2 + white * 0.02) * 1.4;
  }
  return buf;
}

export function resumeAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();

      // Master safety compressor/limiter so nothing is ever harsh
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;

      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : volume * 0.65;
      masterGain.connect(comp);
      comp.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.55;
      musicGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.72;
      sfxGain.connect(masterGain);

      // 1. Living Breath bed (lowpass noise 180..520 Hz + quiet warm drone)
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = createNoiseBuffer(ctx, 4);
      noiseSrc.loop = true;

      breathFilter = ctx.createBiquadFilter();
      breathFilter.type = 'lowpass';
      breathFilter.frequency.value = 240;
      breathFilter.Q.value = 1.4;

      breathGain = ctx.createGain();
      breathGain.gain.value = 0.08;
      noiseSrc.connect(breathFilter);
      breathFilter.connect(breathGain);
      breathGain.connect(musicGain);
      noiseSrc.start();

      droneOsc = ctx.createOscillator();
      droneOsc.type = 'sine';
      droneOsc.frequency.value = 87.31; // Warm low F2
      droneGain = ctx.createGain();
      droneGain.gain.value = 0.045;
      droneOsc.connect(droneGain);
      droneGain.connect(musicGain);
      droneOsc.start();

      // 2. Restlessness soft rumble (lowpass noise 90 Hz)
      const rSrc = ctx.createBufferSource();
      rSrc.buffer = createNoiseBuffer(ctx, 3);
      rSrc.loop = true;
      const rFilt = ctx.createBiquadFilter();
      rFilt.type = 'lowpass';
      rFilt.frequency.value = 95;
      rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.0;
      rSrc.connect(rFilt);
      rFilt.connect(rumbleGain);
      rumbleGain.connect(musicGain);
      rSrc.start();

      // 3. Dream Surge shimmering warm pad
      surgeGain = ctx.createGain();
      surgeGain.gain.value = 0.0;
      surgeGain.connect(musicGain);
      for (const freq of [261.63, 329.63, 392.0]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = 0.05;
        osc.connect(g);
        g.connect(surgeGain);
        osc.start();
      }

      started = true;
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch (err) {
    console.warn('[Dreamback Audio] Web Audio unavailable, staying silent:', err);
  }
}

function softTone(freq, { duration = 0.35, gain = 0.14, type = 'sine', attack = 0.02, slideTo = null, delayEcho = false } = {}) {
  if (!ctx || !started || muted) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(g);
    if (delayEcho) {
      const del = ctx.createDelay(0.5);
      del.delayTime.value = 0.22;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      g.connect(del);
      del.connect(fb);
      fb.connect(del);
      del.connect(sfxGain);
    }
    g.connect(sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  } catch { /* ignore */ }
}

// =========================================================================
// Cozy SFX Library
// =========================================================================
export function playFootstep(zoneIdx = 0) {
  const base = [165, 195, 130, 230][zoneIdx] || 175;
  softTone(base * (0.9 + Math.random() * 0.2), { duration: 0.075, gain: 0.045, type: 'triangle', attack: 0.005, slideTo: base * 0.6 });
}

export function playJump() {
  softTone(240, { duration: 0.16, gain: 0.08, type: 'sine', attack: 0.01, slideTo: 420 });
}

export function playLand() {
  softTone(145, { duration: 0.11, gain: 0.075, type: 'triangle', attack: 0.006, slideTo: 82 });
}

export function playVineGrab() {
  softTone(310, { duration: 0.14, gain: 0.08, type: 'sine', attack: 0.01, slideTo: 460 });
}

export function playHumPulse() {
  softTone(220, { duration: 0.95, gain: 0.12, type: 'sine', attack: 0.12, slideTo: 246.94, delayEcho: true });
  softTone(329.63, { duration: 0.85, gain: 0.07, type: 'triangle', attack: 0.16, slideTo: 392.0, delayEcho: true });
}

export function playFragmentPickup() {
  const notes = [392.0, 493.88, 587.33, 783.99];
  notes.forEach((f, i) => {
    setTimeout(() => softTone(f, { duration: 0.65, gain: 0.12, type: 'sine', attack: 0.02, delayEcho: true }), i * 95);
  });
}

export function playChimePulse(proximity01) {
  const f = 523.25 + proximity01 * 180;
  softTone(f, { duration: 0.45, gain: 0.03 + proximity01 * 0.05, type: 'sine', attack: 0.03, delayEcho: true });
}

export function playCalmSpot() {
  softTone(293.66, { duration: 0.55, gain: 0.06, type: 'sine', attack: 0.08, delayEcho: true });
}

export function playPuzzleSuccess() {
  softTone(440, { duration: 0.35, gain: 0.11, type: 'sine', delayEcho: true });
  setTimeout(() => softTone(659.25, { duration: 0.5, gain: 0.11, type: 'sine', delayEcho: true }), 110);
}

export function playPuzzleWrong() {
  softTone(196, { duration: 0.28, gain: 0.09, type: 'triangle', slideTo: 155 });
}

export function playDialogueBlip(pitchShift = 1.0) {
  softTone((360 + Math.random() * 55) * pitchShift, { duration: 0.055, gain: 0.035, type: 'sine', attack: 0.005 });
}

export function playEndingChord() {
  const chord = [174.61, 220.0, 261.63, 329.63, 392.0, 523.25];
  chord.forEach((f, i) => {
    setTimeout(() => softTone(f, { duration: 5.5, gain: 0.08, type: 'sine', attack: 0.7, delayEcho: true }), i * 160);
  });
}

// =========================================================================
// Per-Frame Audio Update (Breath modulation, ambient plucks, zone textures)
// =========================================================================
export function updateAudio(dt, state) {
  if (!ctx || !started) return;
  const now = ctx.currentTime;
  const b = state.breath.value;

  // Modulate breath noise filter & warm drone
  breathFilter.frequency.setTargetAtTime(175 + b * 360, now, 0.15);
  breathGain.gain.setTargetAtTime(0.05 + b * 0.095, now, 0.15);
  droneOsc.frequency.setTargetAtTime(82.4 + b * 11 + state.calm * 14, now, 0.2);

  // Soft rumble at restlessness >= 75
  const rAmt = state.restlessness >= CONFIG.restlessness.vignetteThreshold
    ? ((state.restlessness - 75) / 25) * 0.16
    : 0;
  rumbleGain.gain.setTargetAtTime(rAmt, now, 0.25);

  // Surge shimmering pad
  const sAmt = state.surge?.active ? 0.45 : 0;
  surgeGain.gain.setTargetAtTime(sAmt, now, 0.4);

  // Gentle generative music plucks & warm chord pads (cozy Tiny Glade / Indie Meditations vibe)
  if (state.mode === 'play' || state.mode === 'title' || state.mode === 'intro') {
    pluckTimer -= dt;
    if (pluckTimer <= 0) {
      pluckTimer = 1.8 + Math.random() * 2.4 - state.calm * 0.4;
      const chord = PAD_CHORDS[chordIdx % PAD_CHORDS.length];
      if (Math.random() < 0.35) {
        chordIdx++;
        // Soft warm pad swell
        for (const f of chord) {
          softTone(f, { duration: 3.4, gain: 0.025, type: 'sine', attack: 0.6 });
        }
      } else {
        // Delicate pentatonic harp/kalimba pluck
        const note = PENTATONIC[(Math.random() * PENTATONIC.length) | 0];
        softTone(note, { duration: 1.15, gain: 0.045, type: 'sine', attack: 0.015, delayEcho: true });
      }
    }

    // Zone-specific cozy ambient touches (water drips in Caverns, crickets in Marshes)
    dripTimer -= dt;
    if (dripTimer <= 0 && state.player) {
      const z = zoneAt(state.player.x).index;
      dripTimer = 2.6 + Math.random() * 3.5;
      if (z === 2) {
        // Cavern water drip with soft echo
        softTone(820 + Math.random() * 280, { duration: 0.14, gain: 0.03, type: 'sine', slideTo: 1240, delayEcho: true });
      } else if (z === 0) {
        // Gentle marsh cricket chirp
        softTone(1480, { duration: 0.06, gain: 0.012, type: 'sine' });
      }
    }
  }

  // Soft rhythmic footsteps when Pip is grounded & moving
  if (state.mode === 'play' && state.player?.grounded && state.player.speed > 2.2) {
    footstepTimer -= dt * (state.player.sprinting ? 1.45 : 1.0);
    if (footstepTimer <= 0) {
      footstepTimer = 0.32;
      playFootstep(zoneAt(state.player.x).index);
    }
  }
}
