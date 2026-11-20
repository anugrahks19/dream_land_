/**
 * Dreamback — Storybook UI, HUD, Menus, Intro Beats, Dialogue, World Map & Photo Mode
 * Styled via UI_TOKENS and css() data URLs from src/tex-bridge.js (M4).
 */

import * as THREE from 'three';
import { CONFIG, INTRO_BEATS, FRAGMENT_LOCATIONS, ALTAR_POS, CALM_SPOTS, zoneAt } from './data.js';
import { getCss, getTokens, getMapHelpers } from './tex-bridge.js';
import { getActivePrompt, getNextObjectivePos, getCurrentObjective, saveGame, clearSavedGame } from './interact.js';
import { playDialogueBlip, toggleMute, isMuted, setMasterVolume, getVolume, resumeAudio } from './audio.js';

let els = {};
let stateRef = null;
let callbacksRef = null;

// Typewriter dialogue state
let dlgLines = [];
let dlgIdx = 0;
let dlgChar = 0;
let dlgTimer = 0;

// Intro beat state
let introIdx = 0;
let introTimer = 0;
const INTRO_BEAT_SEC = 5.0;

// Toast & Zone banner timers
let toastTimer = 0;
let bannerTimer = 0;
let hintTimer = 0;
let fpsAcc = 0, fpsFrames = 0, fpsDisplay = 60;
let mapOpen = false;
let photoMode = false;
let debugOpen = false;

export function setLoadProgress(p) {
  const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
  if (els.loadBar) els.loadBar.style.width = `${pct}%`;
  if (els.loadPct) els.loadPct.textContent = `${pct}%`;
}

export function hideLoading() {
  if (els.loading) els.loading.classList.add('hidden');
}

export function fadeOut(ms = 420) {
  return new Promise((resolve) => {
    if (!els.fade) return resolve();
    els.fade.style.transitionDuration = `${ms}ms`;
    els.fade.classList.add('active');
    setTimeout(resolve, ms);
  });
}

export function fadeIn(ms = 420) {
  return new Promise((resolve) => {
    if (!els.fade) return resolve();
    els.fade.style.transitionDuration = `${ms}ms`;
    els.fade.classList.remove('active');
    setTimeout(resolve, ms);
  });
}

export function showToast(msg, seconds = 3.8) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  toastTimer = seconds;
}

export function showZoneBanner(zoneName) {
  if (!els.zoneBanner) return;
  els.zoneBanner.textContent = zoneName;
  els.zoneBanner.classList.add('show');
  bannerTimer = 3.2;
}

// =========================================================================
// Apply Kit Skins (ui.tokens, ui.paper, story.* via tex-bridge css())
// =========================================================================
export function applyKitSkins() {
  const { ui } = getTokens();
  const root = document.documentElement;
  for (const [k, v] of Object.entries(ui)) {
    root.style.setProperty(k, v);
  }

  // Keep full-screen modals translucent over live 3D cinematic cameras; skin paper cards & portraits cleanly
  const setBg = (el, id) => {
    if (!el) return;
    const url = getCss(id);
    if (url) el.style.backgroundImage = `url("${url}")`;
  };

  setBg(els.dialogueBox, 'ui.paper');
  setBg(els.pauseCard, 'ui.paper.dark');

  const portraitUrl = getCss('ui.portrait');
  if (els.dialoguePortrait && portraitUrl) {
    els.dialoguePortrait.style.backgroundImage = `url("${portraitUrl}")`;
  }
}

// =========================================================================
// Title Screen, 3-Beat Ken Burns Intro, Dialogue, Pause, Lose, Ending, Map
// =========================================================================
export function showTitle(hasSave) {
  if (els.title) els.title.classList.remove('hidden');
  if (els.continueBtn) els.continueBtn.hidden = !hasSave;
  if (els.hud) els.hud.classList.add('hidden');
}

function startIntro(skipToPlay = false) {
  resumeAudio();
  if (els.title) els.title.classList.add('hidden');
  if (skipToPlay) {
    enterPlayMode();
    return;
  }
  stateRef.mode = 'intro';
  introIdx = 0;
  introTimer = 0;
  if (els.intro) els.intro.classList.remove('hidden');
  renderIntroBeat();
}

function renderIntroBeat() {
  const beat = INTRO_BEATS[introIdx];
  if (!beat) {
    if (els.intro) els.intro.classList.add('hidden');
    enterPlayMode();
    return;
  }
  // Drive the LIVE 3D Three.js cinematic camera for each storytelling beat!
  stateRef.introBeat = introIdx;
  stateRef.introBeatTime = 0;

  if (els.introChapter) els.introChapter.textContent = ['Chapter I', 'Chapter II', 'Chapter III'][introIdx] || '';
  if (els.introTitle) els.introTitle.textContent = beat.title;
  if (els.introText) els.introText.textContent = beat.text;
  els.introDots?.forEach((d, i) => d.classList.toggle('active', i === introIdx));
}

function enterPlayMode() {
  stateRef.mode = 'play';
  if (els.intro) els.intro.classList.add('hidden');
  if (els.title) els.title.classList.add('hidden');
  if (els.hud) els.hud.classList.remove('hidden');
  if (els.controlsHint) {
    els.controlsHint.classList.add('show');
    hintTimer = 9.0;
  }
  showZoneBanner(CONFIG.zones[stateRef.zoneIndex]?.name || 'Tail Marshes');
}

export function openDialogue(speaker, portraitIdx, lines) {
  if (!lines || !lines.length) return;
  stateRef.dialogueActive = true;
  dlgLines = lines;
  dlgIdx = 0;
  dlgChar = 0;
  dlgTimer = 0;

  if (els.dialogueName) els.dialogueName.textContent = speaker;
  if (els.dialoguePortrait) {
    els.dialoguePortrait.style.backgroundPosition = `${(portraitIdx / 3) * 100}% 0%`;
  }
  if (els.dialogueText) els.dialogueText.textContent = '';
  if (els.dialogueBox) els.dialogueBox.classList.remove('hidden');
}

export function advanceDialogue() {
  if (!stateRef.dialogueActive) return;
  const full = dlgLines[dlgIdx] || '';
  if (dlgChar < full.length) {
    dlgChar = full.length;
    if (els.dialogueText) els.dialogueText.textContent = full;
    return;
  }
  dlgIdx++;
  if (dlgIdx >= dlgLines.length) {
    stateRef.dialogueActive = false;
    if (els.dialogueBox) els.dialogueBox.classList.add('hidden');
  } else {
    dlgChar = 0;
    if (els.dialogueText) els.dialogueText.textContent = '';
  }
}

export function showLoseCard() {
  if (document.pointerLockElement) document.exitPointerLock?.();
  if (els.loseScreen) els.loseScreen.classList.remove('hidden');
}

export function showEndingCard() {
  if (document.pointerLockElement) document.exitPointerLock?.();
  if (els.hud) els.hud.classList.add('hidden');
  if (els.endingScreen) els.endingScreen.classList.remove('hidden');
}

export function showCreditsButton() {
  if (els.toCreditsBtn) els.toCreditsBtn.classList.remove('hidden');
}

function togglePause() {
  if (stateRef.mode === 'play' && !stateRef.dialogueActive) {
    stateRef.mode = 'paused';
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (els.pauseScreen) els.pauseScreen.classList.remove('hidden');
  } else if (stateRef.mode === 'paused') {
    stateRef.mode = 'play';
    if (els.pauseScreen) els.pauseScreen.classList.add('hidden');
  }
}

function renderWorldMap() {
  const c = els.mapCanvas;
  if (!c) return;
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);

  // Parchment base
  g.fillStyle = '#FBF1DC';
  g.fillRect(0, 0, w, h);

  const { mapRegionWash, mapPaths, regions } = getMapHelpers();
  mapRegionWash(regions, g, w, h);
  mapPaths(
    [[[40, 100], [165, 100], [315, 96], [450, 100], [574, 100]]],
    g, w, h
  );

  const toMap = (wx, wz) => [((wx + 300) / 600) * w, ((wz + 100) / 200) * h];

  // Calm Spots
  for (const cs of CALM_SPOTS) {
    const [mx, my] = toMap(cs.x, cs.z);
    g.fillStyle = 'rgba(143,191,143,0.7)';
    g.beginPath(); g.arc(mx, my, 4.5, 0, Math.PI * 2); g.fill();
  }

  // Fragments
  for (const fc of FRAGMENT_LOCATIONS) {
    const [mx, my] = toMap(fc.x, fc.z);
    const got = stateRef.fragments.includes(fc.id);
    g.fillStyle = got ? fc.color : '#FFF4DC';
    g.strokeStyle = '#4A3B2A';
    g.lineWidth = 2;
    g.beginPath(); g.arc(mx, my, got ? 6.5 : 5.5, 0, Math.PI * 2); g.fill(); g.stroke();
  }

  // Dream Altar
  const [ax, ay] = toMap(ALTAR_POS.x, ALTAR_POS.z);
  g.strokeStyle = '#F2C879';
  g.lineWidth = 3;
  g.beginPath(); g.arc(ax, ay, 8, 0, Math.PI * 2); g.stroke();

  // Pip's live location
  if (stateRef.player) {
    const [px, py] = toMap(stateRef.player.x, stateRef.player.z);
    g.fillStyle = '#C8643B';
    g.strokeStyle = '#FFF4DC';
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.fill(); g.stroke();
  }

  // Zone labels
  g.fillStyle = '#4A3B2A';
  g.font = '700 13px Fredoka, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('Tail Marshes', w * 0.14, h * 0.14);
  g.fillText('Spine Forest', w * 0.42, h * 0.14);
  g.fillText('Rib Caverns', w * 0.68, h * 0.14);
  g.fillText('The Crown', w * 0.90, h * 0.14);
}

// =========================================================================
// Init UI & Bind Controls
// =========================================================================
export function initUI(state, callbacks) {
  stateRef = state;
  callbacksRef = callbacks;

  els = {
    loading: document.getElementById('loading'),
    loadBar: document.getElementById('loading-bar'),
    loadPct: document.getElementById('loading-pct'),
    title: document.getElementById('title'),
    titleBg: document.getElementById('title-bg'),
    startBtn: document.getElementById('start-btn'),
    continueBtn: document.getElementById('continue-btn'),
    diffSelect: document.getElementById('diff-select'),
    intro: document.getElementById('intro'),
    introChapter: document.getElementById('intro-chapter'),
    introTitle: document.getElementById('intro-title'),
    introText: document.getElementById('intro-text'),
    introDots: document.querySelectorAll('.intro-dot'),
    introNextBtn: document.getElementById('intro-next-btn'),
    introSkipBtn: document.getElementById('intro-skip-btn'),
    hud: document.getElementById('hud'),
    objAct: document.getElementById('obj-act'),
    objStep: document.getElementById('obj-step'),
    objText: document.getElementById('obj-text'),
    objDirArrow: document.getElementById('obj-dir-arrow'),
    objDirText: document.getElementById('obj-dir-text'),
    eyelidFill: document.getElementById('eyelid-fill'),
    restlessVal: document.getElementById('restless-val'),
    fragDots: document.querySelectorAll('.frag-dot'),
    breathArc: document.getElementById('breath-arc'),
    breathLabel: document.getElementById('breath-label'),
    lanternPill: document.getElementById('lantern-pill'),
    surgePill: document.getElementById('surge-pill'),
    challengeBanner: document.getElementById('challenge-banner'),
    chTitle: document.getElementById('ch-title'),
    chTimer: document.getElementById('ch-timer'),
    chHint: document.getElementById('ch-hint'),
    chStatus: document.getElementById('ch-status'),
    promptBox: document.getElementById('prompt-box'),
    rescueHint: document.getElementById('rescue-hint'),
    controlsHint: document.getElementById('controls-hint'),
    compassArrow: document.getElementById('compass-arrow'),
    compassDist: document.getElementById('compass-dist'),
    zoneBanner: document.getElementById('zone-banner'),
    toast: document.getElementById('toast'),
    vignette: document.getElementById('vignette'),
    fade: document.getElementById('fade'),
    dialogueBox: document.getElementById('dialogue-box'),
    dialogueName: document.getElementById('dialogue-name'),
    dialoguePortrait: document.getElementById('dialogue-portrait'),
    dialogueText: document.getElementById('dialogue-text'),
    pauseScreen: document.getElementById('pause-screen'),
    pauseCard: document.getElementById('pause-card'),
    resumeBtn: document.getElementById('resume-btn'),
    calmRespawnBtn: document.getElementById('calm-respawn-btn'),
    muteBtn: document.getElementById('mute-btn'),
    volSlider: document.getElementById('vol-slider'),
    restartBtn: document.getElementById('restart-btn'),
    loseScreen: document.getElementById('lose-screen'),
    tryAgainBtn: document.getElementById('try-again-btn'),
    loseRestartBtn: document.getElementById('lose-restart-btn'),
    endingScreen: document.getElementById('ending-screen'),
    endingBg: document.getElementById('ending-bg'),
    toCreditsBtn: document.getElementById('to-credits-btn'),
    creditsScreen: document.getElementById('credits-screen'),
    creditsBg: document.getElementById('credits-bg'),
    creditsList: document.getElementById('credits-list'),
    playAgainBtn: document.getElementById('play-again-btn'),
    mapOverlay: document.getElementById('map-overlay'),
    mapCanvas: document.getElementById('map-canvas'),
    debugBox: document.getElementById('debug-box'),
    playtestTimer: document.getElementById('playtest-timer'),
  };

  // Populate Credits from CONFIG.credits
  if (els.creditsList) {
    els.creditsList.innerHTML = CONFIG.credits
      .map((c) => `<li><strong>${c.role}</strong><span>${c.name}</span></li>`)
      .join('');
  }

  // Volume & Mute initial state
  if (els.volSlider) {
    els.volSlider.value = String(Math.round(getVolume() * 100));
    els.volSlider.addEventListener('input', (e) => setMasterVolume(Number(e.target.value) / 100));
  }
  const syncMuteLabel = () => { if (els.muteBtn) els.muteBtn.textContent = isMuted() ? 'Unmute Audio (M)' : 'Mute Audio (M)'; };
  syncMuteLabel();

  els.muteBtn?.addEventListener('click', () => { toggleMute(); syncMuteLabel(); });
  if (els.diffSelect) {
    els.diffSelect.value = state.difficulty;
    els.diffSelect.addEventListener('change', (e) => { stateRef.difficulty = e.target.value; });
  }

  els.startBtn?.addEventListener('click', () => {
    clearSavedGame();
    callbacksRef?.onNewGame?.();
    startIntro(false);
  });
  els.continueBtn?.addEventListener('click', () => {
    startIntro(true);
  });
  els.introNextBtn?.addEventListener('click', () => {
    introIdx++; introTimer = 0; renderIntroBeat();
  });
  els.introSkipBtn?.addEventListener('click', () => {
    enterPlayMode();
  });

  els.resumeBtn?.addEventListener('click', togglePause);
  els.calmRespawnBtn?.addEventListener('click', () => {
    togglePause();
    callbacksRef?.onReturnToCalmSpot?.();
  });
  els.restartBtn?.addEventListener('click', () => { clearSavedGame(); location.reload(); });
  els.tryAgainBtn?.addEventListener('click', () => {
    if (els.loseScreen) els.loseScreen.classList.add('hidden');
    callbacksRef?.onTryAgain?.();
  });
  els.loseRestartBtn?.addEventListener('click', () => { clearSavedGame(); location.reload(); });
  els.toCreditsBtn?.addEventListener('click', () => {
    if (els.endingScreen) els.endingScreen.classList.add('hidden');
    if (els.creditsScreen) els.creditsScreen.classList.remove('hidden');
  });
  els.playAgainBtn?.addEventListener('click', () => { clearSavedGame(); location.reload(); });

  // Global keyboard shortcuts: Esc (pause), Tab (world map), M (mute), P (photo mode), F3 (debug), Intro skip
  window.addEventListener('keydown', (e) => {
    if (stateRef.mode === 'intro') {
      introIdx++;
      introTimer = 0;
      renderIntroBeat();
      return;
    }
    if (e.code === 'Escape') {
      if (mapOpen) { mapOpen = false; els.mapOverlay?.classList.add('hidden'); return; }
      if (stateRef.mode === 'play' || stateRef.mode === 'paused') togglePause();
    } else if (e.code === 'Tab' && stateRef.mode === 'play') {
      e.preventDefault();
      mapOpen = !mapOpen;
      if (els.mapOverlay) els.mapOverlay.classList.toggle('hidden', !mapOpen);
      if (mapOpen) renderWorldMap();
    } else if (e.code === 'KeyM') {
      toggleMute();
      syncMuteLabel();
      showToast(isMuted() ? 'Audio muted' : 'Audio unmuted', 1.8);
    } else if (e.code === 'KeyP' && stateRef.mode === 'play') {
      photoMode = !photoMode;
      if (els.hud) els.hud.classList.toggle('photo-hidden', photoMode);
    } else if (e.code === 'F3') {
      e.preventDefault();
      debugOpen = !debugOpen;
      if (els.debugBox) els.debugBox.classList.toggle('hidden', !debugOpen);
    }
  });

  if (new URLSearchParams(window.location.search).get('playtest') === '1' && els.playtestTimer) {
    els.playtestTimer.classList.remove('hidden');
  }
}

// =========================================================================
// Per-Frame UI Update
// =========================================================================
const projVec = new THREE.Vector3();

export function updateUI(dt, state, renderer, camera) {
  // FPS counter for F3 overlay
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 0.4) {
    fpsDisplay = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0; fpsFrames = 0;
  }

  // Intro auto-advance & live 3D beat dolly clock
  if (state.mode === 'intro') {
    introTimer += dt;
    state.introBeatTime = introTimer;
    if (introTimer >= 7.5) {
      introTimer = 0;
      introIdx++;
      renderIntroBeat();
    }
    return;
  }

  // Typewriter dialogue progression (~42 chars/sec)
  if (state.dialogueActive) {
    const full = dlgLines[dlgIdx] || '';
    if (dlgChar < full.length) {
      dlgTimer += dt * 42;
      while (dlgTimer >= 1 && dlgChar < full.length) {
        dlgTimer -= 1;
        dlgChar++;
        if (dlgChar % 3 === 0) playDialogueBlip(1.0);
      }
      if (els.dialogueText) els.dialogueText.textContent = full.slice(0, dlgChar);
    }
  }

  // Timers for toast, zone banner, controls hint
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0 && els.toast) els.toast.classList.remove('show');
  }
  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0 && els.zoneBanner) els.zoneBanner.classList.remove('show');
  }
  if (hintTimer > 0) {
    hintTimer -= dt;
    if (hintTimer <= 0 && els.controlsHint) els.controlsHint.classList.remove('show');
  }

  if (state.mode !== 'play') return;

  // 0. Clear Step-by-Step Objective & Live Directional Guidance (top-left + top-right compass)
  const obj = getCurrentObjective(state);
  if (els.objAct) els.objAct.textContent = obj.act;
  if (els.objStep) els.objStep.textContent = obj.step || '';
  if (els.objText) els.objText.textContent = obj.text;

  if (camera && state.player && obj.pos) {
    const p = state.player;
    const dx = obj.pos.x - p.x;
    const dz = obj.pos.z - p.z;
    const distM = Math.max(0, Math.round(Math.hypot(dx, dz)));

    // Camera horizontal forward vector
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    fwd.y = 0;
    if (fwd.lengthSq() > 1e-4) fwd.normalize();
    const toTgt = new THREE.Vector3(dx, 0, dz);
    if (toTgt.lengthSq() > 1e-4) toTgt.normalize();

    const dot = Math.max(-1, Math.min(1, fwd.x * toTgt.x + fwd.z * toTgt.z));
    // Positive crossY means target is to the LEFT; negative means target is to the RIGHT
    const crossY = fwd.x * toTgt.z - fwd.z * toTgt.x;
    const relAng = Math.atan2(crossY, dot); // 0 = ahead, +PI/2 = right, -PI/2 = left

    let dirLabel = 'Straight Ahead';
    if (distM <= 5) dirLabel = 'Right Here!';
    else if (Math.abs(relAng) < 0.36) dirLabel = 'Straight Ahead';
    else if (relAng > 0 && relAng < 1.15) dirLabel = 'Bear Right';
    else if (relAng >= 1.15 && relAng < 2.25) dirLabel = 'Turn Right';
    else if (relAng < 0 && relAng > -1.15) dirLabel = 'Bear Left';
    else if (relAng <= -1.15 && relAng > -2.25) dirLabel = 'Turn Left';
    else dirLabel = 'Behind You';

    const rotDeg = (relAng * 180) / Math.PI;
    if (els.objDirArrow) els.objDirArrow.style.transform = `rotate(${rotDeg.toFixed(1)}deg)`;
    if (els.objDirText) {
      els.objDirText.textContent = distM <= 5
        ? `${dirLabel} · ${obj.hint || 'Press E'}`
        : `${dirLabel} · ${distM}m · ${obj.hint || ''}`;
    }
    if (els.compassArrow) {
      els.compassArrow.style.opacity = '1';
      els.compassArrow.style.transform = `rotate(${rotDeg.toFixed(1)}deg)`;
    }
    if (els.compassDist) els.compassDist.textContent = `${distM}m`;
  }

  // 1. Breath SVG ring (circumference 157.08 for r=25)
  const b = state.breath.value;
  if (els.breathArc) {
    const circ = 157.08;
    els.breathArc.style.strokeDashoffset = String(circ * (1 - b));
    const zCol = CONFIG.zones[state.zoneIndex]?.accentColor || '#FFC77A';
    els.breathArc.style.stroke = state.breath.inhaling ? zCol : '#FFF4DC';
  }
  if (els.breathLabel) {
    els.breathLabel.textContent = state.breath.inhaling ? 'inhale' : 'exhale';
  }

  // 2. Closed-eyelid Restlessness bar
  if (els.eyelidFill) {
    els.eyelidFill.style.width = `${Math.round(state.restlessness)}%`;
  }
  if (els.restlessVal) {
    els.restlessVal.textContent = state.inCalmSpot ? 'Resting…' : `${Math.round(state.restlessness)}%`;
  }

  // Soft warm vignette when restlessness >= 75
  if (els.vignette) {
    const op = state.restlessness >= CONFIG.restlessness.vignetteThreshold
      ? ((state.restlessness - 75) / 25) * 0.72
      : 0;
    els.vignette.style.opacity = op.toFixed(2);
  }

  // 3. Fragment dots (4 glowing zone dots)
  els.fragDots?.forEach((dot, i) => {
    const fc = FRAGMENT_LOCATIONS[i];
    const has = fc && state.fragments.includes(fc.id);
    dot.classList.toggle('collected', Boolean(has));
    if (has) dot.style.background = fc.color;
  });

  // 4. Hush Lantern pill & Surge countdown
  if (els.lanternPill) {
    if (!state.flags.hasLantern) {
      els.lanternPill.textContent = 'Talk to Grandma for Lantern';
    } else if (state.lantern.cooldown > 0) {
      els.lanternPill.textContent = `Hum (${state.lantern.cooldown.toFixed(1)}s)`;
    } else {
      els.lanternPill.textContent = 'Press H · Hum Ready';
    }
  }
  if (els.surgePill) {
    els.surgePill.classList.toggle('hidden', !state.surge.active);
    if (state.surge.active) {
      els.surgePill.textContent = `Dream Surge · ${Math.ceil(state.surge.remaining)}s — Reach the Altar!`;
    }
  }

  // 4b. Dynamic Living-Giant Challenge Alert Banner
  if (els.challengeBanner) {
    const ch = state.challenge;
    if (ch) {
      els.challengeBanner.classList.remove('hidden');
      els.challengeBanner.classList.toggle('safe', Boolean(ch.safe));
      els.challengeBanner.classList.toggle('danger', !ch.safe);
      if (els.chTitle) els.chTitle.textContent = `${ch.def.icon} ${ch.def.name}`;
      if (els.chTimer) {
        const secs = Math.max(1, Math.ceil(ch.timer));
        els.chTimer.textContent = ch.phase === 'telegraph' ? `IN ${secs}s` : `${secs}s LEFT`;
      }
      if (els.chHint) els.chHint.textContent = ch.phase === 'telegraph' ? ch.def.warn : ch.def.activeHint;
      if (els.chStatus) {
        els.chStatus.textContent = ch.safe ? `✓ ${ch.def.safeLabel}` : `⚠ ${ch.def.exposedLabel}`;
      }
    } else {
      els.challengeBanner.classList.add('hidden');
    }
  }

  // 5. Contextual interaction prompt & R rescue hint
  const prompt = !state.dialogueActive ? getActivePrompt() : null;
  if (els.promptBox) {
    if (prompt) {
      els.promptBox.textContent = `Press E · ${prompt.prompt}`;
      els.promptBox.classList.add('show');
    } else {
      els.promptBox.classList.remove('show');
    }
  }
  if (els.rescueHint) {
    els.rescueHint.classList.toggle('hidden', !state.flags.showRescueHint);
  }

  // 6. (Compass arrow & meter distance updated in Step 0 above for instant sync)

  // 7. Live map refresh while open
  if (mapOpen) renderWorldMap();

  // 8. F3 Perf/Debug overlay & Playtest timer
  if (debugOpen && els.debugBox && renderer) {
    const info = renderer.info;
    const p = state.player;
    els.debugBox.textContent =
      `FPS: ${fpsDisplay} | Calls: ${info.render.calls} | Tris: ${info.render.triangles}\n` +
      `Breath: ${b.toFixed(2)} (${state.breath.inhaling ? 'IN' : 'EX'}) Cycle: ${state.breath.cycleLength.toFixed(1)}s\n` +
      `Pip: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} | Frags: ${state.fragments.length}/4`;
  }
  if (els.playtestTimer && !els.playtestTimer.classList.contains('hidden')) {
    const mins = Math.floor(state.playSeconds / 60);
    const secs = Math.floor(state.playSeconds % 60).toString().padStart(2, '0');
    els.playtestTimer.textContent = `Playtest ${mins}:${secs} · dumpPlaytest()`;
  }
}
