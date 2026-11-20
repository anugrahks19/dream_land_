/**
 * Dreamback — Main Game Loop, Shared State & Lifecycle (Phases 1–9 + M1–M5)
 * Loop order every frame: input -> breath -> terrain -> player -> interactions -> camera -> UI -> render.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG, FRAGMENT_LOCATIONS } from './data.js';
import { initBridge, printUsageReport } from './tex-bridge.js';
import { initBreath, updateBreath, setCycleForFragments } from './breath.js';
import { createWorld, updateWorld } from './world.js';
import { initPlayer, updatePlayer, updateCamera, teleportPlayer } from './player.js';
import {
  initInteractions,
  resetInteractions,
  updateInteractions,
  addRestlessness,
  loadSavedGame,
  saveGame,
  logTelemetry,
} from './interact.js';
import {
  initUI,
  updateUI,
  setLoadProgress,
  hideLoading,
  applyKitSkins,
  showTitle,
  openDialogue,
  advanceDialogue,
  showToast,
  showZoneBanner,
  showLoseCard,
  showEndingCard,
  showCreditsButton,
  fadeOut,
  fadeIn,
} from './ui.js';
import { initAudio, updateAudio } from './audio.js';
import { initChallenges, updateChallenges, resetChallenges } from './challenges.js';

// Single shared game state object (Global Context Block rule)
const state = {
  mode: 'loading', // loading | title | intro | play | paused | lose | ending | ended
  breath: null,
  restlessness: 0,
  fragments: [],
  echoes: [],
  calm: 0, // 0..1 progress brightness
  zoneIndex: 0,
  checkpoint: { x: CONFIG.player.spawnPos.x, z: CONFIG.player.spawnPos.z },
  difficulty: CONFIG.difficulty.default,
  dialogueActive: false,
  inCalmSpot: false,
  playSeconds: 0,
  flags: {
    hasLantern: true, // Open-world: Hush Lantern ready from minute 1 so Pip can roam & survive challenges anywhere!
    showGuide: true,
    gateOpen: false,
    showRescueHint: false,
    seenPrompts: {},
  },
  player: null,
  lantern: { cooldown: 0, pulseTimer: 0 },
  surge: { active: false, remaining: 0 },
  challenge: null,
  puzzle: { nextStep: 0 },
  ending: null,
};

window.__DREAMBACK_STATE__ = state;

async function boot() {
  const canvas = document.getElementById('game');
  if (!canvas) throw new Error('Missing #game canvas');

  // 1. Renderer, Scene, Camera, Strictly 2 Lights (warm golden sun + hemisphere)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CONFIG.zones[0].fogColor, CONFIG.zones[0].fogDensity);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.25, 900);

  // Max 2 lights (PRD & Global Context Block) — Forest Golden-Hour Realism
  const hemiLight = new THREE.HemisphereLight(CONFIG.zones[0].hemiSky, '#3D4832', 0.82);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(CONFIG.zones[0].sunColor, 2.05);
  sunLight.position.set(60, 48, 32);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 230;
  const sCam = 58;
  sunLight.shadow.camera.left = -sCam;
  sunLight.shadow.camera.right = sCam;
  sunLight.shadow.camera.top = sCam;
  sunLight.shadow.camera.bottom = -sCam;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.04;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // WebGL context lost friendly fallback (Phase 7)
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const errEl = document.getElementById('fatal-error');
    if (errEl) {
      errEl.innerHTML = '<h2>WebGL paused</h2><p>The graphics context was reset. Reload to continue from your last Calm Spot.</p><button onclick="location.reload()">Reload</button>';
      errEl.classList.remove('hidden');
    }
  });

  // Global error handler -> friendly toast, never blank screen
  window.addEventListener('error', (ev) => {
    console.warn('[Dreamback] Caught runtime warning:', ev.message);
    showToast('A gentle hiccup occurred — keeping going!');
  });

  // 2. Load saved progress if present
  const saved = loadSavedGame();
  if (saved) {
    state.fragments = saved.fragments || [];
    state.echoes = saved.echoes || [];
    state.calm = Math.min(1, state.fragments.length / 4);
    if (saved.checkpoint) state.checkpoint = saved.checkpoint;
    if (saved.flags) Object.assign(state.flags, saved.flags);
    if (typeof saved.puzzleStep === 'number') state.puzzle.nextStep = saved.puzzleStep;
    if (typeof saved.restlessness === 'number') state.restlessness = Math.min(85, saved.restlessness);
    if (saved.difficulty && CONFIG.difficulty.presets[saved.difficulty]) state.difficulty = saved.difficulty;
  }

  // 3. Init UI & Audio prefs early so loading bar responds
  initAudio();
  initBreath(state);
  setCycleForFragments(state.fragments.length);

  initUI(state, {
    onNewGame() {
      state.fragments = [];
      state.echoes = [];
      state.calm = 0;
      state.restlessness = 0;
      state.zoneIndex = 0;
      state.playSeconds = 0;
      state.dialogueActive = false;
      state.flags.hasLantern = true;
      state.flags.showGuide = true;
      state.flags.gateOpen = false;
      state.flags.showRescueHint = false;
      state.flags.seenPrompts = {};
      state.checkpoint = { x: CONFIG.player.spawnPos.x, z: CONFIG.player.spawnPos.z };
      initBreath(state);
      setCycleForFragments(0);
      resetInteractions(state, scene);
      resetChallenges(state);
      teleportPlayer(state, state.checkpoint.x, state.checkpoint.z);
    },
    onTryAgain() {
      state.restlessness = CONFIG.restlessness.tryAgainReset;
      state.mode = 'play';
      teleportPlayer(state, state.checkpoint.x, state.checkpoint.z);
      saveGame(state);
    },
    onReturnToCalmSpot() {
      teleportPlayer(state, state.checkpoint.x, state.checkpoint.z);
      showToast('Returned safely to your last Calm Spot.');
    },
  });

  // 4. Initialize Texture Kit via tex-bridge (with 6s timeout fallback & ?notex=1 support)
  setLoadProgress(0.05);
  await initBridge((p) => setLoadProgress(0.05 + p * 0.85));

  // 5. Build World, Pip & Interactions using tex-bridge
  createWorld(scene);
  setLoadProgress(0.92);

  initPlayer(scene, canvas, state, {
    async onFallRespawn(done) {
      addRestlessness(state, CONFIG.restlessness.fallSpike, 'fall');
      logTelemetry('fall_respawn', { x: Math.round(state.player.x) });
      await fadeOut(320);
      teleportPlayer(state, state.checkpoint.x, state.checkpoint.z);
      showToast('Gently lifted back to your last Calm Spot.');
      await fadeIn(360);
      done();
    },
  });

  initInteractions(scene, state, {
    openDialogue,
    advanceDialogue,
    showToast,
    showZoneBanner,
    showLoseCard,
    showEndingCard,
    showCreditsButton,
  });

  initChallenges(scene, state, { showToast });

  applyKitSkins();
  printUsageReport();
  setLoadProgress(1.0);

  // Brief soft beat so loading bar shows 100%, then reveal Title Screen
  setTimeout(() => {
    hideLoading();
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('debug') === '1' && qs.get('preview') === 'intro') {
      document.getElementById('start-btn')?.click();
    } else if (qs.get('debug') === '1' && qs.get('preview') === 'play') {
      state.mode = 'play';
      document.getElementById('hud')?.classList.remove('hidden');
    } else if (qs.get('debug') === '1' && qs.get('preview') === 'forest') {
      state.mode = 'play';
      state.flags.hasLantern = true;
      state.fragments = ['frag_marsh'];
      teleportPlayer(state, -96, 2);
      document.getElementById('hud')?.classList.remove('hidden');
    } else {
      state.mode = 'title';
      showTitle(Boolean(saved && saved.fragments.length > 0));
    }
  }, 240);

  // Optional subtle Tiny-Glade warm bloom postprocessing (respects CONFIG.postprocessing.bloom)
  let composer = null;
  let bloomPass = null;
  if (CONFIG.postprocessing.bloom) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.72, 0.84);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    } catch (err) {
      console.warn('[Dreamback] Post-processing bloom unavailable, falling back to direct render:', err);
      composer = null;
    }
  }

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  });

  // 6. Main Game Loop (THREE.Clock, clamped dt <= 0.05)
  // Strict order: input -> breath -> terrain -> player -> interactions -> camera -> UI -> render
  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());

    if (state.mode !== 'paused') {
      updateBreath(dt, state);
      updateWorld(dt, state, scene, sunLight, hemiLight, camera);
      updatePlayer(dt, state);
      updateInteractions(dt, state, scene);
      updateChallenges(dt, state);
      updateCamera(dt, state, camera);
      updateAudio(dt, state);

      // Keep sun shadow frustum centered near active camera / Pip
      const focusX = state.mode === 'play' && state.player ? state.player.x : camera.position.x - 18;
      const focusY = state.mode === 'play' && state.player ? state.player.y : 12;
      const focusZ = state.mode === 'play' && state.player ? state.player.z : 0;
      sunLight.target.position.set(focusX, focusY, focusZ);
      sunLight.position.set(focusX + 44, focusY + 42, focusZ + 26);
    }

    updateUI(dt, state, renderer, camera);
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  tick();
}

boot().catch((err) => {
  console.error('[Dreamback] Fatal boot error:', err);
  const errEl = document.getElementById('fatal-error');
  if (errEl) {
    errEl.innerHTML = `<h2>Could not wake the world</h2><p>${String(err.message || err)}</p><button onclick="location.reload()">Retry</button>`;
    errEl.classList.remove('hidden');
  }
});
