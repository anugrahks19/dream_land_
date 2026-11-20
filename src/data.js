/**
 * Dreamback — Central Tunable Configuration, Zone Definitions, World Coordinates & Dialogue
 * Every tunable number, color, coordinate, and line of dialogue lives here.
 * 1 world unit ≈ 1 ant-step. World runs tail (low X) to head (high X): 600 x 200 units.
 */

export const CONFIG = {
  world: {
    width: 600,
    depth: 200,
    segX: 200,
    segZ: 80,
    unit: 1,
    minX: -288,
    maxX: 288,
    minZ: -86,
    maxZ: 86,
    // World X runs -300..+300 (tail at -300, head at +300)
    tailX: -300,
    headX: 300,
    baseFogDensity: 0.0095,
    maxSlopeDeg: 52,
  },

  // Four continuous zones from Tail (-300) to Crown (+300)
  zones: [
    {
      id: 'marshes',
      name: 'Tail Marshes',
      xStart: -300,
      xEnd: -135,
      mainColor: '#8FBF8F',
      accentColor: '#F4E9CD',
      fogColor: '#CFE8DC',
      sunColor: '#FFC77A',
      hemiSky: '#FFF4DC',
      hemiGround: '#5A8A62',
      fogDensity: 0.0085,
      amplitudeScale: 0.48,
      skyTop: '#7C86C0',
      skyMid: '#F2A58E',
      skyHorizon: '#FFD9A0',
    },
    {
      id: 'forest',
      name: 'Spine Forest',
      xStart: -135,
      xEnd: 35,
      mainColor: '#D9A441',
      accentColor: '#6B7F3A',
      fogColor: '#F2D9A0',
      sunColor: '#FFC26E',
      hemiSky: '#FFE8B8',
      hemiGround: '#6B7F3A',
      fogDensity: 0.009,
      amplitudeScale: 0.85,
      skyTop: '#8C7FBF',
      skyMid: '#F29AA0',
      skyHorizon: '#FFC9A6',
    },
    {
      id: 'caverns',
      name: 'Rib Caverns',
      xStart: 35,
      xEnd: 175,
      mainColor: '#3B3F7A',
      accentColor: '#4FD1C5',
      accentSecondary: '#E27BB1',
      fogColor: '#353C6E',
      sunColor: '#B8D4E8',
      hemiSky: '#7C8CE0',
      hemiGround: '#2C4A47',
      fogDensity: 0.013,
      amplitudeScale: 1.35,
      skyTop: '#565A9C',
      skyMid: '#9B7FB5',
      skyHorizon: '#C998B8',
    },
    {
      id: 'crown',
      name: 'The Crown',
      xStart: 175,
      xEnd: 300,
      mainColor: '#F5F0EA',
      accentColor: '#F6B8C8',
      accentGold: '#F2C879',
      fogColor: '#FBE4E8',
      sunColor: '#FFE0A6',
      hemiSky: '#FFF4DC',
      hemiGround: '#D9C7D4',
      fogDensity: 0.0068,
      amplitudeScale: 0.65,
      skyTop: '#A9A8D6',
      skyMid: '#F6B8C8',
      skyHorizon: '#FFE7B0',
    },
  ],

  breath: {
    cycleLengths: [24, 28, 32, 36, 42], // Index = collected fragment count (0..4)
    baseAmplitude: 3.0,
    cycleEaseSeconds: 4.0,
    restlessSpeedMult: 1.12,
    restlessThreshold: 50,
    windMagnitude: 4.8,
    corridorWindBoost: 12.5,
  },

  player: {
    walkSpeed: 13.5,
    sprintSpeed: 21.0,
    jumpVelocity: 16.5,
    gravity: 38.0,
    coyoteTime: 0.14,
    jumpBuffer: 0.12,
    radius: 0.72,
    height: 1.45,
    accel: 14.0,
    airControl: 0.65,
    climbSpeed: 8.5,
    fallRespawnOffset: -20,
    spawnPos: { x: -265, z: 0 },
  },

  camera: {
    distance: 15.5,
    minDistance: 8,
    maxDistance: 28,
    height: 6.2,
    followLerp: 8.0,
    yFollowLerp: 4.2,
    pitchMin: -0.14,
    pitchMax: 1.05,
    defaultPitch: 0.34,
    defaultYaw: -Math.PI * 0.5, // Facing +X (tail toward head)
    mouseSensitivity: 0.0024,
  },

  restlessness: {
    max: 100,
    passiveRate: 0.42, // Tuned cozy default (Phase 8)
    fallSpike: 5,
    sprintNearSleeping: 1.4,
    wrongStep: 8,
    orbHit: 10,
    calmSpotRate: 12,
    humDrop: 6,
    fragmentDrop: 25,
    graceSeconds: 60, // First 60s cannot lose (capped at 95)
    swayThreshold: 50,
    vignetteThreshold: 75,
    tryAgainReset: 30,
  },

  difficulty: {
    default: 'cozy',
    presets: {
      cozy: { label: 'Cozy', restlessMult: 0.65, orbSpeedMult: 0.85 },
      normal: { label: 'Normal', restlessMult: 1.0, orbSpeedMult: 1.0 },
      bold: { label: 'Bold', restlessMult: 1.35, orbSpeedMult: 1.2 },
    },
  },

  lantern: {
    cooldown: 3.0,
    radius: 26,
    guideRadius: 24,
    pulseDuration: 1.1,
  },

  forest: {
    simpleMode: false, // Cut-list fallback: true replaces vines with exhale-only jump pads
    vineGrabRadius: 3.0,
    vineCooldown: 0.5,
    vineLaunchBoost: 15.5,
  },

  surge: {
    duration: 45,
    orbCount: 11,
    orbSpeed: 6.5,
    orbRadius: 2.1,
    bumpImpulse: 12,
  },

  textures: {
    enabled: true,
    quality: 'auto',
    seed: 1337,
    timeoutMs: 6000,
  },

  postprocessing: {
    bloom: true, // Subtle warm bloom with automatic direct-render fallback
  },

  save: {
    key: 'dreamback_save_v1',
    audioKey: 'dreamback_audio_v1',
    autoSaveSec: 15,
  },

  credits: [
    { role: 'World & Living Breath', name: 'Dreamback Team' },
    { role: 'Storybook Art & Procedural Kit', name: 'Canvas 2D + Three.js 0.160' },
    { role: 'Cozy Soundscape & Synth', name: 'Web Audio API' },
    { role: 'Typography', name: 'Fredoka & Caveat Brush (SIL OFL)' },
    { role: 'Optional Music Inspiration', name: 'YannZ — Indie Meditations (CC-BY 4.0)' },
  ],
};

// =========================================================================
// Key World Landmarks, Calm Spots, Puzzles, Vines & Climbables
// =========================================================================
export const CALM_SPOTS = [
  // Marshes (at least every ~40s travel)
  { id: 'calm_colony', zone: 'marshes', x: -260, z: 4, radius: 5.5, label: 'Colony Hearth' },
  { id: 'calm_marsh_mid', zone: 'marshes', x: -205, z: -12, radius: 5.5, label: 'Lily Pool Moss' },
  { id: 'calm_marsh_exit', zone: 'marshes', x: -148, z: 6, radius: 5.5, label: 'Marsh Lookout' },
  // Forest
  { id: 'calm_forest_entry', zone: 'forest', x: -115, z: -4, radius: 5.5, label: 'Bramble Hollow' },
  { id: 'calm_forest_mid', zone: 'forest', x: -32, z: 8, radius: 5.5, label: 'Honeytree Glade' },
  // Caverns
  { id: 'calm_cavern_entry', zone: 'caverns', x: 46, z: 0, radius: 5.5, label: 'First Rib Hearth' },
  { id: 'calm_cavern_gate', zone: 'caverns', x: 136, z: -4, radius: 5.5, label: 'Lantern Alcove' },
  // Crown
  { id: 'calm_crown_base', zone: 'crown', x: 185, z: 0, radius: 5.5, label: 'Cloudstep Rest' },
  { id: 'calm_crown_summit', zone: 'crown', x: 222, z: 2, radius: 6.0, label: 'Pebble Overlook' },
];

export const FRAGMENT_LOCATIONS = [
  { id: 'frag_marsh', zone: 'marshes', index: 0, x: -178, z: 22, yOff: 2.2, color: '#8FBF8F', name: 'Marsh Dream' },
  { id: 'frag_forest', zone: 'forest', index: 1, x: 14, z: -2, yOff: 12.2, color: '#D9A441', name: 'Canopy Dream' },
  { id: 'frag_cavern', zone: 'caverns', index: 2, x: 162, z: 0, yOff: 2.6, color: '#4FD1C5', name: 'Echo Dream' },
  { id: 'frag_crown', zone: 'crown', index: 3, x: 244, z: 0, yOff: 2.8, color: '#F6B8C8', name: 'Dawn Dream' },
];

export const ALTAR_POS = { x: 274, z: 0, radius: 5.0 };

export const NPCS_CONFIG = [
  { id: 'grandma', name: 'Grandma Moss-Ant', zone: 'marshes', fragId: 'frag_marsh', x: -248, z: -4, color: '#8FBF8F', portraitIdx: 0 },
  { id: 'bramble', name: 'Bramble the Beetle', zone: 'forest', fragId: 'frag_forest', x: -104, z: -8, color: '#6B7F3A', portraitIdx: 1 },
  { id: 'moth_guide', name: 'Wisp-Moth', zone: 'caverns', fragId: 'frag_cavern', x: 64, z: 4, color: '#4FD1C5', portraitIdx: 3 },
  { id: 'pebble', name: 'Old Pebble', zone: 'crown', fragId: 'frag_crown', x: 228, z: -8, color: '#F4E9CD', portraitIdx: 2 },
];

// Ladder-style climbable volumes (explicit start/end so climbing is always smooth & bug-free)
export const CLIMBABLES = [
  { id: 'climb_tutorial', x: -222, z: 12, bottomY: 0, height: 6.5, normalX: -1, normalZ: 0, width: 3.4 },
  { id: 'climb_forest_tree', x: 11, z: -2, bottomY: 0, height: 11.2, normalX: -1, normalZ: 0, width: 3.6 },
  { id: 'climb_crown_step1', x: 178, z: 0, bottomY: 0, height: 8.5, normalX: -1, normalZ: 0, width: 4.5 },
  { id: 'climb_crown_step2', x: 204, z: 0, bottomY: 0, height: 7.5, normalX: -1, normalZ: 0, width: 4.5 },
];

// 6 swinging vines along Spine Forest (handles hang ~3.2-3.5u above ground so Pip can leap & grab cleanly)
export const VINES_CONFIG = [
  { id: 'vine_1', x: -84, z: -4, anchorYOff: 15.8, length: 12.5, phaseOff: 0.0 },
  { id: 'vine_2', x: -69, z: -2, anchorYOff: 16.2, length: 12.8, phaseOff: 0.35 },
  { id: 'vine_3', x: -54, z: 3, anchorYOff: 16.2, length: 12.8, phaseOff: 0.7 },
  { id: 'vine_4', x: -20, z: 4, anchorYOff: 15.8, length: 12.5, phaseOff: 0.15 },
  { id: 'vine_5', x: -6, z: 1, anchorYOff: 16.0, length: 12.6, phaseOff: 0.5 },
  { id: 'vine_6', x: 4, z: -2, anchorYOff: 16.0, length: 12.6, phaseOff: 0.85 },
];

export const WIND_CORRIDORS = [
  { id: 'gust_1', xMin: -102, xMax: -46, zMin: -16, zMax: 16, dirX: 1, dirZ: 0 },
  { id: 'gust_2', xMin: -28, xMax: 12, zMin: -14, zMax: 14, dirX: 1, dirZ: -0.1 },
];

// Breath-synced platforms in Rib Caverns (step up to the elevated mushroom pads!)
export const BREATH_PLATFORMS = [
  { id: 'bp_cav_1', zone: 'caverns', x: 79, z: -11, yOff: 2.5, w: 6.5, d: 6.5, mode: 'exhale' },
  { id: 'bp_cav_2', zone: 'caverns', x: 98, z: 9.5, yOff: 2.7, w: 6.5, d: 6.5, mode: 'inhale' },
  { id: 'bp_cav_3', zone: 'caverns', x: 117, z: -7, yOff: 2.5, w: 6.5, d: 6.5, mode: 'exhale' },
];

// 3 Mushroom puzzle pads in Rib Caverns (correct order: 0 -> 1 -> 2, shown by Wisp-Moth trail)
export const MUSHROOM_PADS = [
  { id: 'pad_0', order: 0, x: 86, z: -12, radius: 3.4, capHeight: 4.5, color: '#4FD1C5' },
  { id: 'pad_1', order: 1, x: 105, z: 11, radius: 3.4, capHeight: 4.7, color: '#E27BB1' },
  { id: 'pad_2', order: 2, x: 124, z: -8, radius: 3.4, capHeight: 4.5, color: '#8894F2' },
];

// Optional hidden Dreamfire Echoes revealed by Hush Lantern pulse (H)
export const HIDDEN_ECHOES = [
  { id: 'echo_marsh', zone: 'marshes', x: -205, z: -38, color: '#8FBF8F', lore: 'Whisper of the Lily Shore: "Even the smallest ripple rocks Old Mother Hush to sleep."' },
  { id: 'echo_forest', zone: 'forest', x: -44, z: -28, color: '#D9A441', lore: 'Whisper of the Amber Bough: "Golden sap holds the warmth of a hundred summers."' },
  { id: 'echo_cavern', zone: 'caverns', x: 92, z: -24, color: '#4FD1C5', lore: 'Whisper of the Rib Vault: "Her heartbeat sounds like rain on distant roofs."' },
  { id: 'echo_crown', zone: 'crown', x: 248, z: 26, color: '#F6B8C8', lore: 'Whisper of the Cloud Rim: "Dawn waits patiently for the smallest traveler."' },
];

export const CAVERN_GATE = { x: 148, z: 0, width: 10, height: 11 };

export const TUTORIAL_MARKERS = [
  { id: 'tut_move', x: -242, z: 8, iconIdx: 0, text: 'WASD to walk · Shift to sprint · Mouse to look' },
  { id: 'tut_jump', x: -230, z: 4, iconIdx: 1, text: 'Space to hop across moss & pools' },
  { id: 'tut_climb', x: -225, z: 12, iconIdx: 2, text: 'Walk into mossy ledges & hold W to climb' },
];

// =========================================================================
// Dialogue & Intro Story Beats (30+ warm lines)
// =========================================================================
export const INTRO_BEATS = [
  {
    bg: 'story.beat1',
    title: 'Old Mother Hush',
    text: 'Long before anyone counted days, an ancient Giant lay down to rest. Moss grew over her shoulders, rivers settled in her folds, and our tiny colony made a home on her tail.',
  },
  {
    bg: 'story.beat2',
    title: 'Dreams Fall',
    text: 'Tonight her dreams scattered across her back as glowing Dream Fragments. Without them her breath grows restless—and if she wakes, everything on her back will tumble away.',
  },
  {
    bg: 'story.beat3',
    title: 'Pip Sets Out',
    text: 'Gather all four Dream Fragments from Tail to Crown before dawn. Move with her breath, rest at glowing Calm Spots, and bring her peaceful sleep back home.',
  },
];

export const DIALOGUE = {
  grandma: {
    before: [
      'The Giant\'s breathing is uneven, little one. Take my Hush Lantern, and hold H to hum when the world feels wobbly.',
      'Our first Dream Fragment drifted into the tall reed maze eastward. Listen for its soft chime when you draw near.',
      'And remember—whenever you feel the back trembling, pause inside a glowing Calm Spot to catch your breath.',
    ],
    after: [
      'You found the Marsh Dream! Feel how Old Mother Hush already exhales a little slower?',
      'Follow the sunlit path up into the Spine Forest. Bramble the Beetle is grumpy, but he knows the safest branches.',
    ],
  },
  bramble: {
    before: [
      'Swing on the exhale, not the inhale. Trust me, I learned that the hard way. Twice.',
      'When the vines glow soft green, leap with Space to grab hold, then tap Space again to soar toward the Honeytree.',
      'The Canopy Dream sparkles right at the top of the tallest trunk ahead. Mind the gusty breeze!',
    ],
    after: [
      'Hah! Clean landing for such tiny legs! The whole forest smells like warm honey again.',
      'Beyond these trunks lie the Rib Caverns. Hum softly for the Wisp-Moths down there—they love a good tune.',
    ],
  },
  moth_guide: {
    before: [
      'Follow us! Hum, hum, hum (hold H), and we\'ll light the way across the three glowing mushroom pads.',
      'Step on each pad in the order we flutter—teal, then rose, then indigo—and the ancient rib gate will open.',
    ],
    after: [
      'Ooh, lovely humming! The Echo Dream is safe and the cavern feels so warm and cozy now!',
      'Climb the pearl ribs eastward to the Crown. Old Pebble is waiting near the clouds.',
    ],
  },
  pebble: {
    before: [
      'Dawn is coming, small one. Give the Giant her dreams back.',
      'The last fragment rests right in the center of the summit—when you lift it, the Dream Surge will swirl for a short while.',
      'Drift with the exhale gusts, dodge the rosy dream-orbs, and carry all four fragments to the Dream Altar ahead.',
    ],
    after: [
      'You did it, tiny scout. Carry the four dreams to the stone Dream Altar and press E when you are ready for sunrise.',
    ],
  },
};

/**
 * Determine current zone index (0..3) and smooth blend factor to next zone from world X.
 */
export function zoneAt(x) {
  const zones = CONFIG.zones;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (x <= z.xEnd || i === zones.length - 1) {
      const next = zones[Math.min(zones.length - 1, i + 1)];
      const edgeDist = z.xEnd - x;
      const blendWidth = 26;
      const blend = i < zones.length - 1 ? Math.max(0, Math.min(1, 1 - edgeDist / blendWidth)) : 0;
      return { index: i, zone: z, nextIndex: Math.min(zones.length - 1, i + 1), nextZone: next, blend };
    }
  }
  return { index: 0, zone: zones[0], nextIndex: 0, nextZone: zones[0], blend: 0 };
}
