/**
 * Dreamback Texture Kit — T9: Material Recipes & Texel Density Bindings
 *
 * Shading rule (T9 & M2):
 *  - flatShading: true  for stone, rock, cliff, cobble, pebbles, crystals, and roof shingles
 *  - flatShading: false (smooth) for terrain, grass, foliage, wood, plaster, water, and creatures
 */

import * as THREE from 'three';
import { registerMaterial } from './store.js';
import { getWorldRepeat } from './config.js';

function add(id, recipe) {
  registerMaterial(id, {
    worldRepeat: getWorldRepeat(id),
    flatShading: false,
    transparent: false,
    depthWrite: true,
    side: THREE.FrontSide,
    additive: false,
    roughness: 0.85,
    metalness: 0.0,
    ...recipe,
  });
}

// =========================================================================
// T1: Land, Paths & Water
// =========================================================================
add('land.marsh', { map: 'land.marsh', roughness: 0.88, mergeTarget: 'Terrain shader (Marshes zone)' });
add('land.hub', { map: 'land.hub', roughness: 0.86, mergeTarget: 'Terrain shader (Hub zone)' });
add('land.forest', { map: 'land.forest', roughness: 0.88, mergeTarget: 'Terrain shader (Forest zone)' });
add('land.cavern', { map: 'land.cavern', roughnessMap: 'land.cavern.rough', roughness: 1.0, mergeTarget: 'Terrain shader (Caverns zone)' });
add('land.crown', { map: 'land.crown', roughness: 0.62, mergeTarget: 'Terrain shader (Crown zone)' });
add('land.scales', { map: 'land.scales', normalMap: 'land.scales.normal', normalScale: 0.55, roughness: 0.82, mergeTarget: 'Terrain Giant skin overlay (~0.15 strength)' });
add('land.macro', { map: 'land.macro', roughness: 0.9, mergeTarget: 'Terrain world-wide multiply UV (600x200)' });
add('land.cliff', { map: 'land.cliff', flatShading: true, roughness: 0.9, mergeTarget: 'Steep terrain slopes & rock faces' });
add('path.dirt', { map: 'path.dirt', roughness: 0.9, mergeTarget: 'Dirt ground clearings' });
add('path.dirt.strip', { map: 'path.dirt.strip', transparent: true, depthWrite: false, roughness: 0.9, mergeTarget: 'Path spline ribbons' });
add('path.cobble', { map: 'path.cobble', flatShading: true, roughness: 0.84, mergeTarget: 'Tower courtyard cobblestones' });
add('path.steps', { map: 'path.steps', flatShading: true, roughness: 0.82, mergeTarget: 'Stepping stone pads' });
add('shore.mud', { map: 'shore.mud', roughness: 0.55, mergeTarget: 'Pool shore mud banks' });
add('water.pool', { map: 'water.pool', roughness: 0.22, transparent: true, opacity: 0.88, mergeTarget: 'Pool water surfaces (slow UV scroll)' });
add('water.foam', { map: 'water.foam', transparent: true, depthWrite: false, roughness: 0.6, mergeTarget: 'Pool shoreline foam strips' });
add('ground.moss', { map: 'ground.moss', roughness: 0.88, mergeTarget: 'Cavern walls & mossy rocks' });

// =========================================================================
// T2: Built Props
// =========================================================================
add('build.stone', { map: 'build.stone', normalMap: 'build.stone.normal', normalScale: 0.85, flatShading: true, roughness: 0.86, mergeTarget: 'Towers & stone walls' });
add('build.stone.ruin', { map: 'build.stone.ruin', normalMap: 'build.stone.normal', normalScale: 0.85, flatShading: true, roughness: 0.88, mergeTarget: 'Ruined walls & arches' });
add('build.stone.arch', { map: 'build.stone.arch', flatShading: true, roughness: 0.86, mergeTarget: 'Archway voussoirs' });
add('build.roof', { map: 'build.roof', flatShading: true, roughness: 0.84, mergeTarget: 'Tower & hut roofs' });
add('build.roof.moss', { map: 'build.roof.moss', flatShading: true, roughness: 0.88, mergeTarget: 'Old mossy roofs' });
add('build.plaster', { map: 'build.plaster', roughness: 0.9, mergeTarget: 'Colony hut clay walls' });
add('build.plank', { map: 'build.plank', roughness: 0.82, mergeTarget: 'Bridges, piers & fences' });
add('build.plank.painted', { map: 'build.plank.painted', roughness: 0.84, mergeTarget: 'Tutorial wooden sign boards' });
add('build.log', { map: 'build.log', roughness: 0.86, mergeTarget: 'Fallen logs & benches' });
add('build.rope', { map: 'build.rope', roughness: 0.92, mergeTarget: 'Bridge ropes & bindings' });
add('build.barrel', { map: 'build.barrel', roughness: 0.8, mergeTarget: 'Colony barrels' });
add('build.door', { map: 'build.door', roughness: 0.82, mergeTarget: 'Round hut doors' });
add('build.trim', { map: 'build.trim', roughness: 0.84, mergeTarget: 'Window shutters & trim' });
add('build.window', { map: 'build.window', emissiveMap: 'build.window', emissive: '#FFC77A', emissiveIntensity: 1.25, roughness: 0.35, mergeTarget: 'Lit cottage/tower windows' });
add('build.window.dark', { map: 'build.window.dark', roughness: 0.4, mergeTarget: 'Unlit windows below fragment threshold' });
add('build.lantern', { map: 'build.lantern', emissiveMap: 'build.lantern', emissive: '#FFC77A', emissiveIntensity: 1.15, transparent: true, opacity: 0.92, roughness: 0.3, mergeTarget: 'Hanging & post lanterns' });
add('build.gate', { map: 'build.gate', emissiveMap: 'build.gate.emissive', emissive: '#4FD1C5', emissiveIntensity: 1.1, flatShading: true, roughness: 0.78, mergeTarget: 'Caverns carved stone gate' });
add('build.altar', { map: 'build.altar', roughness: 0.65, mergeTarget: 'Crown stone altar top' });
add('build.altar.socket', { map: 'build.altar.socket', emissiveMap: 'build.altar.socket.lit', emissive: '#FFF4DC', emissiveIntensity: 0.85, roughness: 0.55, mergeTarget: 'Altar fragment sockets (lit state)' });
add('build.altar.socket.unlit', { map: 'build.altar.socket.unlit', roughness: 0.85, mergeTarget: 'Altar fragment sockets (unlit state)' });
add('build.rib', { map: 'build.rib', roughness: 0.68, mergeTarget: 'Giant-rib bone arches' });

// =========================================================================
// T3: Nature Props
// =========================================================================
add('nature.reed', { map: 'nature.reed', transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.82, mergeTarget: 'Marsh reed cards' });
add('nature.reed.cattail', { map: 'nature.reed.cattail', transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.84, mergeTarget: 'Marsh cattail reed cards' });
add('nature.grassblade', { map: 'nature.grassblade', transparent: true, alphaTest: 0.12, side: THREE.DoubleSide, roughness: 0.84, mergeTarget: 'Instanced grass blades' });
add('nature.grassblade.dry', { map: 'nature.grassblade.dry', transparent: true, alphaTest: 0.12, side: THREE.DoubleSide, roughness: 0.88, mergeTarget: 'Dry golden grass blades' });
add('nature.flowers', { map: 'nature.flowers', transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.8, mergeTarget: 'Instanced biome flowers (8-cell atlas)' });
add('nature.flowers.bloom', { map: 'nature.flowers.bloom', transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.78, mergeTarget: 'Ending wave bloom cards' });
add('nature.clover', { map: 'nature.clover', transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.86, mergeTarget: 'Hub clover ground scatter' });
add('nature.ivy', { map: 'nature.ivy', transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.82, mergeTarget: 'Tower & wall ivy clusters' });
add('nature.moss', { map: 'nature.moss', transparent: true, depthWrite: false, roughness: 0.9, mergeTarget: 'Puffy moss caps on stones' });
add('nature.bark', { map: 'nature.bark', roughness: 0.88, mergeTarget: 'Old Honeytree & woodland trunks' });
add('nature.bark.pale', { map: 'nature.bark.pale', roughness: 0.84, mergeTarget: 'Willow trunks' });
add('nature.canopy', { map: 'nature.canopy', roughness: 0.82, mergeTarget: 'Instanced tree canopies (per-instance tint)' });
add('nature.willow', { map: 'nature.willow', transparent: true, alphaTest: 0.12, side: THREE.DoubleSide, roughness: 0.84, mergeTarget: 'Hanging willow curtains' });
add('nature.mushroom.cap', { map: 'nature.mushroom.cap', emissiveMap: 'nature.mushroom.cap.glow', emissive: '#FFF4DC', emissiveIntensity: 0.75, roughness: 0.65, mergeTarget: 'Cavern mushroom bounce pads (3-cell atlas)' });
add('nature.mushroom.stem', { map: 'nature.mushroom.stem', roughness: 0.84, mergeTarget: 'Cavern mushroom stems' });
add('nature.crystal', { map: 'nature.crystal', emissiveMap: 'nature.crystal.glow', emissive: '#4FD1C5', emissiveIntensity: 0.85, flatShading: true, transparent: true, roughness: 0.25, mergeTarget: 'Teal cavern crystal props' });
add('nature.crystal.pink', { map: 'nature.crystal.pink', emissiveMap: 'nature.crystal.glow', emissive: '#E27BB1', emissiveIntensity: 0.85, flatShading: true, transparent: true, roughness: 0.25, mergeTarget: 'Pink cavern crystal props' });
add('nature.crystal.gold', { map: 'nature.crystal.gold', emissiveMap: 'nature.crystal.glow', emissive: '#F2C879', emissiveIntensity: 0.85, flatShading: true, transparent: true, roughness: 0.25, mergeTarget: 'Gold crown crystal props' });
add('nature.cloudpuff', { map: 'nature.cloudpuff', transparent: true, depthWrite: false, side: THREE.DoubleSide, unlit: true, mergeTarget: 'Floating horizon cloud puffs' });
add('nature.pebble', { map: 'nature.pebble', flatShading: true, roughness: 0.86, mergeTarget: 'Ground pebble meshes' });

// =========================================================================
// T4: FX, Particles & Glows (Additive where glowing, depthWrite: false)
// =========================================================================
for (const id of ['fx.halo.warm', 'fx.halo.cool', 'fx.halo.pink', 'fx.godray', 'fx.firefly', 'fx.wishlight', 'fx.sparkle', 'fx.spore', 'fx.dust', 'fx.ring', 'fx.calm', 'fx.orb', 'fx.fragment', 'fx.lanternpool']) {
  add(id, { map: id, transparent: true, depthWrite: false, additive: true, unlit: true, side: THREE.DoubleSide, mergeTarget: 'Additive glow sprite / particle' });
}
for (const id of ['fx.butterfly', 'fx.moth', 'fx.bird', 'fx.leaf', 'fx.petal', 'fx.mist', 'fx.smoke', 'fx.fragment.crystal', 'fx.footprint', 'fx.shadow']) {
  add(id, { map: id, transparent: true, depthWrite: false, additive: false, unlit: true, side: THREE.DoubleSide, mergeTarget: 'Normal-blended alpha sprite / decal' });
}

// =========================================================================
// T5: Characters & Creatures (ALL smooth shading, zero outlines)
// =========================================================================
add('char.pip.shell', { map: 'char.pip.shell', roughness: 0.58, mergeTarget: 'Pip body/carapace sphere' });
add('char.pip.eye', { map: 'char.pip.eye', roughness: 0.28, mergeTarget: 'Pip eye spheres' });
add('char.pip.leaf', { map: 'char.pip.leaf', transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.78, mergeTarget: 'Pip backpack leaf' });
add('char.pip.bulb', { map: 'char.pip.bulb', emissiveMap: 'char.pip.bulb', emissive: '#FFC77A', emissiveIntensity: 1.4, roughness: 0.3, mergeTarget: 'Pip lantern bulb (flicker emissive)' });
add('char.grandma.body', { map: 'char.grandma.body', roughness: 0.82, mergeTarget: 'Grandma body primitive' });
add('char.grandma.shawl', { map: 'char.grandma.shawl', roughness: 0.92, mergeTarget: 'Grandma knitted shawl' });
add('char.bramble.shell', { map: 'char.bramble.shell', roughness: 0.45, mergeTarget: 'Bramble beetle shell' });
add('char.pebble.shell', { map: 'char.pebble.shell', emissiveMap: 'char.pebble.glow', emissive: '#FFC77A', emissiveIntensity: 0.85, roughness: 0.52, mergeTarget: 'Old Pebble snail shell' });
add('char.pebble.body', { map: 'char.pebble.body', roughness: 0.48, mergeTarget: 'Old Pebble body' });
add('char.moth.body', { map: 'char.moth.body', emissiveMap: 'char.moth.body', emissive: '#FFC77A', emissiveIntensity: 1.1, roughness: 0.6, mergeTarget: 'Wisp-Moth body' });
add('char.puff.wool', { map: 'char.puff.wool', roughness: 0.94, mergeTarget: 'Puff wool body spheres' });
add('char.puff.face', { map: 'char.puff.face', roughness: 0.86, mergeTarget: 'Puff face sphere' });
add('char.giant.eyelid', { map: 'char.giant.eyelid', roughness: 0.66, mergeTarget: 'Giant sleeping eyelid mesh' });
add('char.giant.lash', { map: 'char.giant.lash', transparent: true, alphaTest: 0.12, side: THREE.DoubleSide, roughness: 0.78, mergeTarget: 'Giant eyelash cards' });

// =========================================================================
// T6: Sky & Atmosphere
// =========================================================================
add('sky.lut', { map: 'sky.lut', unlit: true, mergeTarget: 'Sky dome shader gradient LUT' });
add('sky.clouds', { map: 'sky.clouds', unlit: true, transparent: true, depthWrite: false, mergeTarget: 'Sky cloud layer mask' });
add('sky.cloudshadow', { map: 'sky.cloudshadow', unlit: true, mergeTarget: 'Terrain cloud-shadow projection' });
add('sky.sun', { map: 'sky.sun', unlit: true, transparent: true, depthWrite: false, additive: true, mergeTarget: 'Sun billboard sprite' });
add('sky.stars', { map: 'sky.stars', unlit: true, transparent: true, depthWrite: false, additive: true, mergeTarget: 'Lavender-dusk star dome' });
add('sky.horizonhaze', { map: 'sky.horizonhaze', unlit: true, transparent: true, depthWrite: false, mergeTarget: 'Horizon haze cylinder band' });
add('fog.ground', { map: 'fog.ground', unlit: true, transparent: true, depthWrite: false, mergeTarget: 'Ground-hugging golden haze' });
add('post.vignette', { map: 'post.vignette', unlit: true, transparent: true, depthWrite: false, mergeTarget: 'Post-process warm vignette' });
add('post.restless', { map: 'post.restless', unlit: true, transparent: true, depthWrite: false, mergeTarget: 'Restlessness vignette overlay' });
add('post.grain', { map: 'post.grain', unlit: true, mergeTarget: 'Post-process +/-3% grain tile' });
add('post.grade', { map: 'post.grade', unlit: true, mergeTarget: 'Color-grade 5-keyframe LUT strips' });
add('ui.map', { map: 'ui.map', unlit: true, mergeTarget: 'Tab map overlay & parchment canvas' });
add('ui.map.icons', { map: 'ui.map.icons', unlit: true, transparent: true, depthWrite: false, mergeTarget: 'Map landmark icons atlas' });
