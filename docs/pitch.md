# Dreamback — One-Page Pitch

## The Problem
Open-world games often feel like static museums waiting for the player to walk across them—and hackathon 3D prototypes either drown in heavy engine boilerplate or feel flat and lifeless.

## The Idea
**Dreamback** turns the open world itself into a living, sleeping creature. You play as **Pip**, a tiny ant carrying a glowing Hush Lantern across the 600-unit back of **Old Mother Hush**. Four Dream Fragments have scattered from Tail Marshes to The Crown. Gather them before dawn so she sleeps peacefully and your colony stays safe.

## Fit to Theme: Living Open World
One global **Breathing Cycle** drives the entire world simultaneously:
- The terrain physically rises and falls beneath Pip's feet.
- Exponential fog thickens on inhale and clears on exhale.
- Exhale gusts sway grass, push vines into their green safe-swing window, and carry Pip across wind corridors.
- Cavern platforms solidify or fade with inhale/exhale rhythms.
- Every collected Dream Fragment calms the Giant's breath (24s → 28s → 32s → 36s) and shifts the golden-hour sky toward rosy dawn.

## Tech & AI Craft
Built in plain JavaScript ES modules + Three.js `0.160.0`—**no game engine, no physics library, no bundler**. Every texture (148 storybook surfaces, sprites, sky LUTs, UI skins, and picture-book scenes) is generated procedurally on Canvas 2D; all music and SFX are synthesized live via Web Audio API. AI assisted at build time with Three.js boilerplate, noise/terrain shaders, dialogue & lore, color palettes, audio synthesis design, and debugging—with zero runtime AI calls so the demo never fails from network issues.
