# Dreamback

**A tiny ant. A sleeping giant. One breath at a time.**

You are **Pip**, the youngest scout of a cozy ant colony living on the mossy tail of **Old Mother Hush**, an ancient sleeping Giant. Four Dream Fragments have scattered across her 600-unit breathing back—from the **Tail Marshes**, through the wind-swept **Spine Forest** and glowing **Rib Caverns**, up to **The Crown**. Gather all four before she stirs awake.

- **Zero engine / zero build step**: Plain ES modules + Three.js `0.160.0` via CDN import map + procedural Canvas 2D Tiny-Glade-inspired Texture Kit (`src/tex/`) + Web Audio API cozy synth soundtrack.
- **Texture Gallery reference**: Open `http://localhost:8000/docs/texture-gallery/` to inspect all 148 procedural textures.

---

## Run Locally (60 Seconds)

```bash
python -m http.server 8000
```
Open **http://localhost:8000/** in Chrome, Edge, or Firefox.

### Query Flags
- `?notex=1` — Disable procedural textures for flat-shaded A/B comparison.
- `?quality=high|medium|low` — Override automatic texture quality tier.
- `?debug=1` — Enable teleport keys `1`–`4` (zones), `F` (collect all fragments), `K` (trigger ending).
- `?playtest=1` — Show session timer and record telemetry (`window.dumpPlaytest()`).

### Controls
| Action | Key |
|---|---|
| Move / Climb | `W A S D` |
| Look / Orbit | Mouse (click canvas or drag) · Scroll zoom |
| Jump / Grab & Release Vine | `Space` |
| Sprint | `Shift` |
| Interact / Talk / Collect | `E` |
| Hum (Hush Lantern pulse) | `H` |
| World Map | `Tab` |
| Pause / Volume / Return to Calm Spot | `Esc` |
| Return to Last Calm Spot (Rescue) | `R` |
| Mute Audio | `M` |
| Photo Mode (hide HUD) | `P` |
| Performance / Debug Overlay | `F3` |

---

## Deploy

### GitHub Pages
1. Push the repository to GitHub (`main` branch).
2. Open **Settings → Pages → Build and deployment**.
3. Set **Source** to *Deploy from a branch*, select `main` and `/ (root)`, and click **Save**.
4. Wait ~60 seconds, then open the published URL in an **incognito window** to verify fresh-load behavior (all paths are relative so project subpaths work cleanly).

### Netlify Drop
1. Open https://app.netlify.com/drop.
2. Drag and drop the project root folder (`d:\DREAMLAND`) directly onto the drop zone.
3. Open the generated live URL in an **incognito window**.

### Backup Zip
```bash
zip -r dreamback-backup.zip . -x ".git/*" "node_modules/*"
```

### Run Offline if Network Fails
Vendor `three@0.160.0` locally (`curl -L https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js -o assets/vendor/three.module.js`) and serve `index-offline.html` via `python -m http.server 8000`.

---

## Optional External CC0 / CC-BY Assets
- The game ships 100% self-contained with zero runtime external asset fetches (only Three.js CDN + Google Fonts Fredoka/Caveat Brush).
- Optional vendored glTF props (e.g., Quaternius CC0 Medieval Village / Fantasy Props) or CC-BY 4.0 music (e.g., YannZ *Indie Meditations*, credited in `CONFIG.credits`) can be dropped into `assets/` and loaded via `GLTFLoader` with primitive fallbacks intact.
