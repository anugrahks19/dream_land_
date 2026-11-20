# Dreamback — 90-Second Live Demo Script

1. **0:00–0:10 — Hook**: Open live URL. *"What if the open world was alive? Meet Dreamback, a world that breathes."* Click Begin Adventure (skip intro with any key).
2. **0:10–0:25 — Show the Breath**: Stand still in Tail Marshes. Point out terrain heaving, fog breathing, reeds swaying, breath ring cycling, and soft breathing audio. Talk to Grandma Moss-Ant (`E`) to receive the Hush Lantern.
3. **0:25–0:70 — Tour All 4 Zones** (use `?debug=1` hotkeys `2`, `3`, `4` if short on time):
   - **Marshes**: Hum (`H`) near reed maze to spot Fragment 1 chime & glow.
   - **Forest**: Wait for exhale green vine glow, leap (`Space`) and swing toward Honeytree.
   - **Caverns**: Hold `H` to awaken Wisp-Moths tracing Teal → Rose → Indigo pads, open gate.
   - **Crown**: Point out the colossal sleeping Giant eyelid, lift Fragment 4 to show Dream Surge orbs, dash to Dream Altar (`E`).
4. **0:70–0:85 — Ending Bloom**: Let the 20-second pullback, 3,600-flower wave, dawn sky, and final chord breathe without talking over it.
5. **0:85–0:90 — Close**: *"Pure ES modules, Three.js, procedural Canvas 2D storybook textures and Web Audio—no game engine. Thank you!"*

## Fallback Plans
- **No audio / muted venue**: Visual breath ring, fog pulse, swaying foliage, and Wisp-Moth glow communicate every mechanic silently.
- **No internet**: Run `python -m http.server 8000` locally and open `index-offline.html` (with vendored `three.module.js`).
- **Low-end laptop GPU**: Append `?quality=low` or `?notex=1` for guaranteed 60 fps.
