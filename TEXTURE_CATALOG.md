# Dreamback Texture Kit — Catalog & Merge Mapping

Generated directly from `tex/registry.js` (148 textures across T1–T8, with T9 material recipes and texel density rules).

## Prefix Summary

| Prefix | Count |
|---|---:|
| `land.` | 10 |
| `path.` | 4 |
| `shore.` | 1 |
| `water.` | 2 |
| `ground.` | 1 |
| `build.` | 24 |
| `nature.` | 22 |
| `fx.` | 24 |
| `char.` | 15 |
| `sky.` | 6 |
| `fog.` | 1 |
| `post.` | 4 |
| `ui.` | 23 |
| `story.` | 11 |

## Pip Final Colors (for Workspace A fallbacks)

```json
{
  "shellBase": "#C8643B",
  "shellHighlight": "#E08A5A",
  "belly": "#F4E9CD",
  "eyeDark": "#2C4A47",
  "eyeSpark": "#FFF4DC",
  "leafBase": "#6E9F6A",
  "leafHighlight": "#B7D6A0",
  "bulbEmissive": "#FFC77A",
  "bulbCore": "#FFF4DC"
}
```

## Complete Texture Catalog & Merge Mapping

| ID | Base Size | Tiles | Color Space | Shading | World Repeat / UV Rule | Intended Game Object / Merge Mapping |
|---|---|---|---|---|---:|---|
| `land.marsh` | 512×512 | yes (xy) | SRGBColorSpace | smooth | rest-pose XZ / 8u | Terrain shader (Marshes zone) — Marshes sage moss-grass terrain |
| `land.hub` | 512×512 | yes (xy) | SRGBColorSpace | smooth | rest-pose XZ / 8u | Terrain shader (Hub zone) — Hub lush meadow with clover and daisies |
| `land.forest` | 512×512 | yes (xy) | SRGBColorSpace | smooth | rest-pose XZ / 8u | Terrain shader (Forest zone) — Forest warm amber leaf-litter terrain |
| `land.cavern` | 512×512 | yes (xy) | SRGBColorSpace | smooth | rest-pose XZ / 8u | Terrain shader (Caverns zone) — Caverns indigo stone with teal moss cracks and pink spores |
| `land.cavern.rough` | 512×512 | yes (xy) | NoColorSpace | smooth | rest-pose XZ / 8u | Game asset — Caverns roughness map (wet gloss in Worley cracks) |
| `land.crown` | 512×512 | yes (xy) | SRGBColorSpace | smooth | rest-pose XZ / 8u | Terrain shader (Crown zone) — Crown pearl marble-cloud terrain with blush veins and gold dust |
| `land.scales` | 512×512 | yes (xy) | SRGBColorSpace | smooth | rest-pose XZ / 40u | Terrain Giant skin overlay (~0.15 strength) — Giant skin soft scale overlay (tiles every 40 world units) |
| `land.scales.normal` | 512×512 | yes (xy) | NoColorSpace | smooth | rest-pose XZ / 40u | Game asset — Giant skin soft scale normal map |
| `land.macro` | 1024×512 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Terrain world-wide multiply UV (600x200) — World-wide watercolor variation map across 600x200 world |
| `land.cliff` | 512×512 | yes (xy) | SRGBColorSpace | flat | rest-pose XZ / 8u | Steep terrain slopes & rock faces — Flat-facet rock cliff with strata and top-edge moss |
| `path.dirt` | 512×512 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 6u | Dirt ground clearings — Warm tan dirt path with pebbles and faint ruts |
| `path.dirt.strip` | 256×512 | yes (y) | SRGBColorSpace | smooth | UV repeat / 6u | Path spline ribbons — Dirt path ribbon strip with soft alpha sides & grass nicks |
| `path.cobble` | 512×512 | yes (xy) | SRGBColorSpace | flat | UV repeat / 4u | Tower courtyard cobblestones — Small rounded pebble cobblestone near towers |
| `path.steps` | 512×512 | yes (xy) | SRGBColorSpace | flat | UV repeat / 4u | Stepping stone pads — Stepping-stone top with mossy rim |
| `shore.mud` | 512×512 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 6u | Pool shore mud banks — Wet brown-green mud gradient for pool edges |
| `water.pool` | 512×512 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 6u | Pool water surfaces (slow UV scroll) — Teal pool water with tileable soft caustic web (scrolling) |
| `water.foam` | 256×64 | yes (x) | SRGBColorSpace | smooth | UV repeat / 4u | Pool shoreline foam strips — Cream scalloped shore foam strip with soft alpha |
| `ground.moss` | 512×512 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 6u | Cavern walls & mossy rocks — Dense teal-green moss tile with tiny spore glints for cavern rocks |
| `build.stone` | 512×512 | yes (xy) | SRGBColorSpace | flat | UV repeat / 4u | Towers & stone walls — Tower stone masonry (tiles every 4 world units) |
| `build.stone.normal` | 512×512 | yes (xy) | NoColorSpace | smooth | UV repeat / 4u | Game asset — Tower stone masonry normal map |
| `build.stone.ruin` | 512×512 | yes (xy) | SRGBColorSpace | flat | UV repeat / 4u | Ruined walls & arches — Mossy ruined stone masonry with chipped corners and cracks |
| `build.stone.arch` | 256×128 | yes (x) | SRGBColorSpace | flat | UV repeat / 4u | Archway voussoirs — Voussoir wedge stone strip for arches (tiles in X) |
| `build.roof` | 256×256 | yes (xy) | SRGBColorSpace | flat | UV repeat / 3u | Tower & hut roofs — Rounded-bottom cottage roof shingles (tiles every 3 units) |
| `build.roof.moss` | 256×256 | yes (xy) | SRGBColorSpace | flat | UV repeat / 3u | Old mossy roofs — Moss-covered roof shingle variant |
| `build.plaster` | 512×512 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 4u | Colony hut clay walls — Colony hut clay plaster (cream to sage with trowel strokes) |
| `build.plank` | 512×512 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 2u | Bridges, piers & fences — Warm vertical wood planks (tiles every 2 world units) |
| `build.plank.painted` | 512×512 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 2u | Tutorial wooden sign boards — Sign board wood planks with chalky cream edge wear |
| `build.log` | 256×256 | yes (y) | SRGBColorSpace | smooth | UV repeat / 2u | Fallen logs & benches — Log texture: left half bark, right half end-grain rings (tiles in Y) |
| `build.rope` | 64×128 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 1u | Bridge ropes & bindings — Twisted diagonal rope stripe tile |
| `build.barrel` | 128×128 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 1.5u | Colony barrels — Wooden barrel staves with two iron hoops |
| `build.door` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Round hut doors — Round storybook wooden cottage door with iron straps |
| `build.trim` | 128×128 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 2u | Window shutters & trim — Shutters and cottage trim in sage and cream |
| `build.window` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Lit cottage/tower windows — Warm glowing cottage window with cross mullions (emissive) |
| `build.window.dark` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Unlit windows below fragment threshold — Unlit dusk window glass with cross mullions |
| `build.lantern` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Hanging & post lanterns — Translucent amber lantern glass with bright core and frame |
| `build.gate` | 512×512 | yes (xy) | SRGBColorSpace | flat | UV repeat / 4u | Caverns carved stone gate — Caverns indigo carved stone gate |
| `build.gate.emissive` | 512×512 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 1u | Game asset — Glowing teal rune line emissive map for Caverns gate |
| `build.altar` | 512×512 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Crown stone altar top — Crown pearl stone circle altar top with rune ring |
| `build.altar.socket` | 512×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Altar fragment sockets (lit state) — Altar socket decals (4x128 atlas in zone colors) |
| `build.altar.socket.lit` | 512×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Game asset — Altar socket lit emissive atlas (4x128) |
| `build.altar.socket.unlit` | 512×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Altar fragment sockets (unlit state) — Altar socket unlit carved stone atlas (4x128) |
| `build.rib` | 256×256 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 4u | Giant-rib bone arches — Giant-rib arch smooth pearl-indigo bone with faint growth rings |
| `nature.reed` | 64×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Marsh reed cards — Marsh reed blade sprite (alpha) |
| `nature.reed.cattail` | 64×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Marsh cattail reed cards — Marsh cattail seed-head reed variant (alpha) |
| `nature.grassblade` | 32×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Instanced grass blades — Lush tapered grass blade with center vein (alpha) |
| `nature.grassblade.dry` | 32×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Dry golden grass blades — Dry golden-tan grass blade variant (alpha) |
| `nature.flowers` | 512×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Instanced biome flowers (8-cell atlas) — 8-cell flower atlas (daisy, buttercup, pink, lavender, marigold, teal, pearl lily, blush cosmos) |
| `nature.flowers.bloom` | 384×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Ending wave bloom cards — 3 tiny single-tint flower heads for the ending wave |
| `nature.clover` | 128×128 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 2u | Hub clover ground scatter — Tileable clover leaf triplet scatter (alpha) |
| `nature.ivy` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Tower & wall ivy clusters — 6-leaf ivy atlas with painted veins (alpha) |
| `nature.moss` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Puffy moss caps on stones — Puffy moss cap decal/sprite (alpha) |
| `nature.bark` | 256×256 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 3u | Old Honeytree & woodland trunks — Old Honeytree warm brown bark with honey fissures (tiles every 3 units) |
| `nature.bark.pale` | 256×256 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 3u | Willow trunks — Pale willow bark in cream with dark flecks |
| `nature.canopy` | 256×256 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 4u | Instanced tree canopies (per-instance tint) — Golden olive-to-honey leaf cluster canopy tile (tiles every 4 units) |
| `nature.willow` | 64×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Hanging willow curtains — Drooping willow frond strands (alpha) |
| `nature.mushroom.cap` | 384×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Cavern mushroom bounce pads (3-cell atlas) — 3-cell mushroom cap atlas (teal, pink, indigo with spots) |
| `nature.mushroom.cap.glow` | 384×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Game asset — Emissive glow twin for mushroom cap atlas |
| `nature.mushroom.stem` | 64×128 | yes (x) | SRGBColorSpace | smooth | UV repeat / 1u | Cavern mushroom stems — Cream mushroom stem with vertical striations and soft bottom shade |
| `nature.crystal` | 128×128 | no (clamp) | SRGBColorSpace | flat | 0..1 clamp / atlas UV | Teal cavern crystal props — Faceted teal cavern crystal with bright inner core (alpha) |
| `nature.crystal.pink` | 128×128 | no (clamp) | SRGBColorSpace | flat | 0..1 clamp / atlas UV | Pink cavern crystal props — Faceted rose-pink crystal variant (alpha) |
| `nature.crystal.gold` | 128×128 | no (clamp) | SRGBColorSpace | flat | 0..1 clamp / atlas UV | Gold crown crystal props — Faceted golden crystal variant (alpha) |
| `nature.crystal.glow` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Game asset — Emissive inner-core glow twin for faceted crystals |
| `nature.cloudpuff` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Floating horizon cloud puffs — Soft storybook cloud puff (pink-lilac underside, gold top) |
| `nature.pebble` | 128×128 | yes (xy) | SRGBColorSpace | flat | UV repeat / 1.5u | Ground pebble meshes — Small stone pebble surface with warm speckles |
| `fx.halo.warm` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Warm golden gaussian halo glow (additive-safe) |
| `fx.halo.cool` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Cool cavern-teal gaussian halo glow (additive-safe) |
| `fx.halo.pink` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Soft rose-blush gaussian halo glow (additive-safe) |
| `fx.godray` | 64×512 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Soft vertical golden sunbeam god-ray (brightest at top) |
| `fx.firefly` | 64×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Bright firefly core with soft warm halo |
| `fx.wishlight` | 64×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Gold-white wishlight orb with soft trailing tail |
| `fx.sparkle` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Soft 4-point golden sparkle star |
| `fx.butterfly` | 512×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — 4-cell painted butterfly wing atlas (mirrored in shader) |
| `fx.moth` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — Fuzzy glowing moth wing sprite (alpha) |
| `fx.bird` | 256×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — 3-frame distant bird flap silhouette atlas |
| `fx.leaf` | 192×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — 3-shape drifting leaf particle atlas (amber, olive, honey) |
| `fx.petal` | 192×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — 3-shape drifting blossom petal atlas (cream, pink, gold) |
| `fx.spore` | 64×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Soft glowing teal cavern spore particle |
| `fx.dust` | 64×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Faint golden sun-dust mote particle |
| `fx.mist` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — Extremely soft low-alpha drifting meadow mist puff |
| `fx.smoke` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — Soft warm chimney smoke curl puff |
| `fx.ring` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Warm golden hum pulse ring with soft inner and outer falloff |
| `fx.calm` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Calm Spot disc: radial moss glow, thin ring, drifting specks |
| `fx.orb` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Dream orb with pink-gold warped fBm swirl, bright rim and inner glow |
| `fx.fragment` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Dream Fragment glowing halo with 6 soft starburst rays |
| `fx.fragment.crystal` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — Neutral-warm faceted Dream Fragment crystal sprite (tintable per zone) |
| `fx.footprint` | 64×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — Tiny golden flower footprint decal |
| `fx.shadow` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Normal-blended alpha sprite / decal — Soft round contact shadow tinted #2C4A47 (never black) |
| `fx.lanternpool` | 256×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Additive glow sprite / particle — Warm golden lantern light pool for ground projection |
| `char.pip.shell` | 256×256 | yes (x) | SRGBColorSpace | smooth | UV repeat / 1u | Pip body/carapace sphere — Pip warm russet shell with faint segment lines, cream belly & soft top sheen |
| `char.pip.eye` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Pip eye spheres — Pip eye sphere texture (dark #2C4A47 iris, two warm sparks, warm rim) |
| `char.pip.leaf` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Pip backpack leaf — Pip backpack leaf sprite with midrib, veins and tiny holes (alpha) |
| `char.pip.bulb` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Pip lantern bulb (flicker emissive) — Pip lantern bulb warm filament emissive gradient |
| `char.grandma.body` | 256×256 | yes (x) | SRGBColorSpace | smooth | UV repeat / 1u | Grandma body primitive — Grandma cozy sage body with soft moss patches (wraps X) |
| `char.grandma.shawl` | 128×128 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 1u | Grandma knitted shawl — Grandma knitted V-stitch cream shawl with bottom fringe |
| `char.bramble.shell` | 256×256 | yes (x) | SRGBColorSpace | smooth | UV repeat / 1u | Bramble beetle shell — Bramble olive & amber glossy shell with center split & cream spots |
| `char.pebble.shell` | 256×256 | yes (x) | SRGBColorSpace | smooth | UV repeat / 1u | Old Pebble snail shell — Old Pebble spiral cream snail shell with warm swirls & glowing rim |
| `char.pebble.glow` | 256×256 | yes (x) | SRGBColorSpace | smooth | UV repeat / 1u | Game asset — Emissive glowing spiral rim for Old Pebble snail shell |
| `char.pebble.body` | 128×128 | yes (x) | SRGBColorSpace | smooth | UV repeat / 1u | Old Pebble body — Old Pebble pale peach snail body with soft moist sheen |
| `char.moth.body` | 64×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Wisp-Moth body — Wisp-Moth warm emissive fuzzy body gradient |
| `char.puff.wool` | 256×256 | yes (xy) | SRGBColorSpace | smooth | UV repeat / 1.5u | Puff wool body spheres — Sheep-like Puff curly cream wool tile (tiles every 1.5 units) |
| `char.puff.face` | 128×128 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Puff face sphere — Puff friendly taupe muzzle with tiny sparkling eyes and blush cheeks |
| `char.giant.eyelid` | 512×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Giant sleeping eyelid mesh — Sleeping Giant pearl-pink eyelid skin with fine blush veins and gentle creases |
| `char.giant.lash` | 64×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Giant eyelash cards — Sleeping Giant long soft eyelash strand (alpha) |
| `sky.lut` | 5×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Sky dome shader gradient LUT — 5-column sky gradient LUT (golden, rose, lavender, peach, dawn; zenith->horizon) |
| `sky.clouds` | 512×512 | yes (xy) | NoColorSpace | smooth | UV repeat / 120u | Sky cloud layer mask — Stretched soft fBm cloud band mask (grayscale, tinted in shader) |
| `sky.cloudshadow` | 512×512 | yes (xy) | NoColorSpace | smooth | UV repeat / 90u | Terrain cloud-shadow projection — Large soft cloud shadow blotches for terrain lighting (0.75..1.0) |
| `sky.sun` | 512×512 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Sun billboard sprite — Warm golden sun disc with wide glow and soft horizontal flare |
| `sky.stars` | 1024×512 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Lavender-dusk star dome — Sparse soft twilight stars (equirectangular, fades in at lavender dusk) |
| `sky.horizonhaze` | 4×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Horizon haze cylinder band — Warm golden horizon haze alpha strip |
| `fog.ground` | 4×256 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Ground-hugging golden haze — Ground-hugging golden meadow haze alpha gradient |
| `post.vignette` | 512×512 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Post-process warm vignette — Warm storybook radial vignette (#4A3B2A at 35%, never black) |
| `post.restless` | 512×512 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Restlessness vignette overlay — Soft warm-gray vignette variant for high restlessness |
| `post.grain` | 256×256 | yes (xy) | NoColorSpace | smooth | UV repeat / 1u | Post-process +/-3% grain tile — Subtle tileable +/- 3% storybook film grain overlay |
| `post.grade` | 256×80 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Color-grade 5-keyframe LUT strips — Five 256x16 color-grade 3D LUT strips (rows 0..4 = golden, rose, lavender, peach, dawn) |
| `ui.paper` | 512×512 | yes (xy) | SRGBColorSpace | CSS | UV repeat / 1u | CSS UI skin (ui.js / index.html) — Cream storybook paper tile with fibers and soft tea-stain blotches |
| `ui.paper.dark` | 512×512 | yes (xy) | SRGBColorSpace | CSS | UV repeat / 1u | CSS UI skin (ui.js / index.html) — Warmer cream-tan paper tile for pause menu panels |
| `ui.panel.border` | 192×192 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — 9-slice hand-drawn wobbly ink panel border with corner leaf & dot doodles |
| `ui.button` | 256×96 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Storybook pill button (normal state) |
| `ui.button.hover` | 256×96 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Storybook pill button (hover state) |
| `ui.button.pressed` | 256×96 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Storybook pill button (pressed state) |
| `ui.button.start` | 320×112 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Primary start pill button with painted leaf sprigs |
| `ui.logo.brush` | 512×512 | yes (xy) | SRGBColorSpace | CSS | UV repeat / 1u | CSS UI skin (ui.js / index.html) — Tileable dry-brush alpha mask for storybook title logo fill |
| `ui.logo.sprig` | 256×256 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Hand-drawn cream-white leaf sprig for title logo (variant 1) |
| `ui.logo.sprig.alt` | 256×256 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Hand-drawn cream-white curling leaf sprig (variant 2) |
| `ui.breath` | 256×256 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Breath meter HUD ring with gap, tick marks and inner paper disc |
| `ui.eyelid` | 512×96 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Giant eyelid calm bar with soft lashes and golden glow-fill |
| `ui.dot` | 64×64 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Empty fragment droplet outline (zone-tintable) |
| `ui.dot.filled` | 64×64 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Filled glowing fragment droplet (zone-tintable) |
| `ui.dialogue` | 768×192 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Storybook dialogue paper box with speaker name tab and speech tail |
| `ui.portrait` | 512×128 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — 4-portrait dialogue atlas (Grandma, Bramble, Pebble, Moth) |
| `ui.keys` | 768×64 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — 12 hand-drawn cream/ink keycap icons (E,W,A,S,D,H,Space,Shift,Esc,M,Tab,P) |
| `ui.compass` | 256×256 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Soft edge-glow golden compass direction arrow |
| `ui.signicons` | 384×128 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — 3-cell painted wooden-sign tutorial doodles (move, jump, climb) |
| `ui.map` | 1024×512 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Tab map overlay & parchment canvas — World map parchment with stains, soft edge burn, and region-wash helpers |
| `ui.map.icons` | 448×64 | no (clamp) | SRGBColorSpace | smooth | 0..1 clamp / atlas UV | Map landmark icons atlas — 7-icon map atlas (tower, tree, ribs, eyelid, lookout, ant dot, wishlight) |
| `ui.loading` | 256×256 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Sunrise loading ring around tiny Pip silhouette |
| `ui.toast` | 256×64 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS UI skin (ui.js / index.html) — Small cream paper notification toast strip |
| `story.menu` | 1280×720 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Title screen fallback painting (golden meadow, 2 towers, Puffs, calm right space for logo) |
| `story.beat1` | 1280×720 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Intro Beat 1 painting: sleeping Giant mossy hill-range at sunset, glowing tail colony |
| `story.beat2` | 1280×720 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Intro Beat 2 painting: glowing dream fragments drifting down hills under rose sky |
| `story.beat3` | 1280×720 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Intro Beat 3 painting: tiny Pip with lantern on ridge facing distant dawn head |
| `story.lose` | 1280×720 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Gentle cream wash lose card with swaying swirls and sleepy-eyelid motif |
| `story.ending` | 1280×720 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Ending storybook painting: dawn pink-gold sky, flower hills, Pip silhouette, sunburst |
| `story.credits` | 720×2160 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Tall scrolling credits backdrop (lavender dusk to crown dawn with stars & sprigs) |
| `story.pause` | 1280×720 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Warm soft paper veil backdrop for the pause menu |
| `story.page` | 1280×720 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Storybook lore page frame with paper, corner flourishes and soft page-curl shadow |
| `story.divider` | 512×64 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Storybook horizontal ink-and-leaf divider flourish strip |
| `story.dropcap` | 128×128 | no (clamp) | SRGBColorSpace | CSS | CSS data URL (`css(id)`) | CSS Story/Menu page (story.*) — Storybook illuminated dropcap leaf-sprig backdrop motif |
