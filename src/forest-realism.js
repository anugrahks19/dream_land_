/**
 * Dreamback — Photorealistic Three.js Forest & Meadow Realism System
 * Inspired by modern Three.js forest environments:
 *  - EZTree-style multi-branch procedural Pine & Broadleaf Oak trees with alpha-cutout botanical leaf cards
 *  - 26,000-blade GPU-instanced curved ShaderMaterial grass field with wind gusts, root AO, subsurface sun glow & player bending
 *  - 220 instanced 3D woodland fern rosettes & arched 3D cattail reeds
 *  - Terrain-conforming cobblestone courtyard & winding flagstone wayfinding road
 *  - Custom soft-Fresnel volumetric sun-shaft god-rays with camera proximity fade
 */

import * as THREE from 'three';

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// =========================================================================
// 1. High-Detail Procedural Botanical Alpha-Cutout Foliage Textures
// =========================================================================
function makeCanvasTex(drawFn, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  drawFn(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function createBotanicalTextures() {
  // A. Evergreen Pine / Spruce Bough Texture (woody twigs + layered fine needles)
  const pineBoughTex = makeCanvasTex((g, S) => {
    const cx = S * 0.5;
    // Main central stem + side twigs
    g.strokeStyle = '#3C2A1E';
    g.lineCap = 'round';
    g.lineWidth = S * 0.022;
    g.beginPath();
    g.moveTo(cx, S * 0.96);
    g.quadraticCurveTo(cx + S * 0.02, S * 0.5, cx, S * 0.08);
    g.stroke();

    const branches = [];
    for (let i = 0; i < 14; i++) {
      const t = 0.14 + (i / 14) * 0.76;
      const side = i % 2 === 0 ? 1 : -1;
      const sy = S * (1 - t);
      const len = S * (0.14 + Math.sin(t * Math.PI) * 0.34);
      const ang = -Math.PI * 0.5 + side * (0.48 + (1 - t) * 0.42);
      const ex = cx + Math.cos(ang) * len;
      const ey = sy + Math.sin(ang) * len;
      branches.push({ sx: cx, sy, ex, ey, ang, side });
      g.strokeStyle = '#4A3424';
      g.lineWidth = Math.max(2, S * 0.011 * (1 - t * 0.45));
      g.beginPath();
      g.moveTo(cx, sy);
      g.lineTo(ex, ey);
      g.stroke();
    }
    branches.push({ sx: cx, sy: S * 0.92, ex: cx, ey: S * 0.06, ang: -Math.PI * 0.5, side: 0 });

    // Hundreds of crisp overlapping conifer needles (dark interior -> sunlit emerald tips)
    const needleCols = ['#1D3422', '#264429', '#2F5530', '#3E6A39', '#567F42', '#70914A'];
    for (let b = 0; b < branches.length; b++) {
      const br = branches[b];
      const steps = b === branches.length - 1 ? 46 : 26;
      for (let k = 0; k < steps; k++) {
        const f = k / steps;
        const bx = br.sx + (br.ex - br.sx) * f;
        const by = br.sy + (br.ey - br.sy) * f;
        for (const nSide of [-1, 1]) {
          const jitter = (hash2(b * 31 + k, nSide * 17) - 0.5) * 0.34;
          const nAng = br.ang + nSide * (0.58 + f * 0.2) + jitter;
          const nLen = S * (0.042 + hash2(k, b * 13 + nSide) * 0.042) * (1 - f * 0.25);
          const ci = Math.min(needleCols.length - 1, Math.floor(f * 3.5 + hash2(b, k * 7) * 3.2));
          g.strokeStyle = needleCols[ci];
          g.lineWidth = Math.max(1.8, S * 0.0065);
          g.beginPath();
          g.moveTo(bx, by);
          g.lineTo(bx + Math.cos(nAng) * nLen, by + Math.sin(nAng) * nLen);
          g.stroke();
        }
      }
    }
  }, 512);

  // B. Deciduous Oak / Birch Leaf-Cluster Card Texture (organic twigs + 75 individual painted leaves)
  const oakClusterTex = makeCanvasTex((g, S) => {
    const cx = S * 0.5, cy = S * 0.52;
    g.strokeStyle = '#4B3624';
    g.lineCap = 'round';
    for (let t = 0; t < 7; t++) {
      const a = -Math.PI * 0.9 + (t / 6) * Math.PI * 0.8;
      const len = S * (0.28 + hash2(t, 3) * 0.16);
      g.lineWidth = S * 0.011;
      g.beginPath();
      g.moveTo(cx, S * 0.88);
      g.quadraticCurveTo(cx + Math.cos(a) * len * 0.4, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      g.stroke();
    }

    // Layered leaves: deeper shadows first, sunlit golden-green outer leaves on top
    const leafCols = ['#2C4727', '#395C2E', '#4C7335', '#648A3E', '#7E9E47', '#9BB056'];
    for (let i = 0; i < 88; i++) {
      const a = hash2(i, 11) * Math.PI * 2;
      const rad = Math.pow(hash2(i, 23), 0.62) * S * 0.39;
      const lx = cx + Math.cos(a) * rad;
      const ly = cy + Math.sin(a) * rad * 0.92;
      const rot = a + (hash2(i, 37) - 0.5) * 1.1;
      const lw = S * (0.044 + hash2(i, 41) * 0.036);
      const lh = lw * (1.55 + hash2(i, 53) * 0.55);

      const shadeIdx = Math.min(leafCols.length - 1, Math.floor((i / 88) * 4.5 + hash2(i, 61) * 1.8));
      g.save();
      g.translate(lx, ly);
      g.rotate(rot);
      g.fillStyle = leafCols[shadeIdx];
      g.beginPath();
      g.moveTo(0, -lh * 0.5);
      g.bezierCurveTo(lw * 0.85, -lh * 0.2, lw * 0.72, lh * 0.32, 0, lh * 0.5);
      g.bezierCurveTo(-lw * 0.72, lh * 0.32, -lw * 0.85, -lh * 0.2, 0, -lh * 0.5);
      g.closePath();
      g.fill();

      // Subtle midrib vein
      g.strokeStyle = 'rgba(255, 244, 210, 0.24)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, -lh * 0.42);
      g.lineTo(0, lh * 0.42);
      g.stroke();
      g.restore();
    }
  }, 512);

  // C. Woodland Sword-Fern Frond Texture
  const fernFrondTex = makeCanvasTex((g, S) => {
    const cx = S * 0.5;
    g.strokeStyle = '#365429';
    g.lineWidth = S * 0.015;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, S * 0.98);
    g.quadraticCurveTo(cx + S * 0.015, S * 0.5, cx, S * 0.04);
    g.stroke();

    const pairs = 26;
    for (let i = 0; i < pairs; i++) {
      const t = i / (pairs - 1);
      const y = S * (0.92 - t * 0.85);
      const widthEnv = Math.sin(Math.pow(t, 0.72) * Math.PI);
      const pLen = S * (0.04 + widthEnv * 0.36);
      const pW = S * (0.014 + widthEnv * 0.014);
      const col = t > 0.6 ? '#5C873C' : t > 0.25 ? '#426D31' : '#2D4F24';

      for (const side of [-1, 1]) {
        g.save();
        g.translate(cx, y);
        g.rotate(side * (-0.28 + t * 0.22));
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(0, -pW * 0.5);
        g.quadraticCurveTo(side * pLen * 0.55, -pW * 0.9, side * pLen, 0);
        g.quadraticCurveTo(side * pLen * 0.55, pW * 0.9, 0, pW * 0.5);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
  }, 512);

  return { pineBoughTex, oakClusterTex, fernFrondTex };
}

// =========================================================================
// 2. EZTree-Style Realistic Branching 3D Forest Trees (Pine & Broadleaf Oak)
// =========================================================================
function createCrossedLeafCardGeometry() {
  // 2 intersecting gently bent foliage cards -> rich 3D volume from every camera angle!
  const pos = [];
  const norm = [];
  const uv = [];
  const idx = [];
  const planes = [
    { rotY: 0, tilt: 0.14 },
    { rotY: Math.PI * 0.52, tilt: -0.14 },
  ];
  planes.forEach((pl, pIdx) => {
    const base = pIdx * 4;
    const c = Math.cos(pl.rotY), s = Math.sin(pl.rotY);
    const pts = [
      [-0.5, -0.5, pl.tilt],
      [ 0.5, -0.5, -pl.tilt],
      [ 0.5,  0.5, pl.tilt],
      [-0.5,  0.5, -pl.tilt],
    ];
    for (const [px, py, pz] of pts) {
      pos.push(px * c - pz * s, py, px * s + pz * c);
      norm.push(0, 0.85, 0.52);
    }
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

export function createForestTreeBuilder(scene, barkMat, botanicalTex, getBaseHeightAt, registerCylinderCollider) {
  const cardGeo = createCrossedLeafCardGeometry();

  // Instanced pools for ALL pine & oak canopy leaf cards -> thousands of detailed leaf cards in ONLY 2 draw calls!!
  const MAX_PINE_CARDS = 2600;
  const MAX_OAK_CARDS = 2600;

  const pineLeafMat = new THREE.MeshStandardMaterial({
    map: botanicalTex.pineBoughTex,
    alphaTest: 0.34,
    side: THREE.DoubleSide,
    roughness: 0.84,
    metalness: 0.0,
  });
  const oakLeafMat = new THREE.MeshStandardMaterial({
    map: botanicalTex.oakClusterTex,
    alphaTest: 0.34,
    side: THREE.DoubleSide,
    roughness: 0.80,
    metalness: 0.0,
  });

  const pineInst = new THREE.InstancedMesh(cardGeo, pineLeafMat, MAX_PINE_CARDS);
  pineInst.castShadow = true;
  pineInst.receiveShadow = true;
  const oakInst = new THREE.InstancedMesh(cardGeo, oakLeafMat, MAX_OAK_CARDS);
  oakInst.castShadow = true;
  oakInst.receiveShadow = true;

  let pineCount = 0;
  let oakCount = 0;

  const m4 = new THREE.Matrix4();
  const vPos = new THREE.Vector3();
  const vQuat = new THREE.Quaternion();
  const vScale = new THREE.Vector3();
  const vEuler = new THREE.Euler();
  const tmpCol = new THREE.Color();

  function addPineCard(x, y, z, sx, sy, rx, ry, rz, tintHex) {
    if (pineCount >= MAX_PINE_CARDS) return;
    vPos.set(x, y, z);
    vEuler.set(rx, ry, rz);
    vQuat.setFromEuler(vEuler);
    vScale.set(sx, sy, sx);
    m4.compose(vPos, vQuat, vScale);
    pineInst.setMatrixAt(pineCount, m4);
    pineInst.setColorAt(pineCount, tmpCol.set(tintHex));
    pineCount++;
  }

  function addOakCard(x, y, z, sx, sy, rx, ry, rz, tintHex) {
    if (oakCount >= MAX_OAK_CARDS) return;
    vPos.set(x, y, z);
    vEuler.set(rx, ry, rz);
    vQuat.setFromEuler(vEuler);
    vScale.set(sx, sy, sx);
    m4.compose(vPos, vQuat, vScale);
    oakInst.setMatrixAt(oakCount, m4);
    oakInst.setColorAt(oakCount, tmpCol.set(tintHex));
    oakCount++;
  }

  function addTree(x, z, height, trunkRadius, species = 'pine', palette = null, isHero = false) {
    const baseY = getBaseHeightAt(x, z);
    const grp = new THREE.Group();
    grp.position.set(x, baseY - 0.5, z);

    // Organic slight trunk lean
    const leanX = (hash2(x, z) - 0.5) * 0.06;
    const leanZ = (hash2(z, x) - 0.5) * 0.06;
    grp.rotation.set(leanX, hash2(x * 1.3, z * 0.7) * Math.PI * 2, leanZ);

    // Tapered segmented trunk with root flare (real Poly Haven CC0 bark_brown_01!)
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkRadius * (species === 'pine' ? 0.14 : 0.34), trunkRadius * 1.38, height, 8, 4),
      barkMat
    );
    trunk.position.y = height * 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    grp.add(trunk);

    // 3 buttress roots gripping the earth
    for (let r = 0; r < 3; r++) {
      const ra = (r / 3) * Math.PI * 2 + hash2(x, r) * 0.7;
      const root = new THREE.Mesh(new THREE.CylinderGeometry(trunkRadius * 0.18, trunkRadius * 0.45, trunkRadius * 2.4, 5), barkMat);
      root.position.set(Math.cos(ra) * trunkRadius * 0.9, trunkRadius * 0.45, Math.sin(ra) * trunkRadius * 0.9);
      root.rotation.z = -Math.cos(ra) * 0.95;
      root.rotation.x = Math.sin(ra) * 0.95;
      grp.add(root);
    }

    if (species === 'pine') {
      // Conifer Pine / Spruce: 6 tiered whorls of angled limbs + 36 layered needle bough cards!
      const pal = palette || ['#8FA87C', '#7F9B6E', '#A8BA84', '#6E885F'];
      const tiers = 6;
      for (let tier = 0; tier < tiers; tier++) {
        const tf = tier / (tiers - 1); // 0 = bottom wide, 1 = top spire
        const ty = baseY - 0.3 + height * (0.28 + tf * 0.68);
        const radius = (height * 0.25) * (1.08 - tf * 0.78);
        const cardsInTier = tier === tiers - 1 ? 3 : (7 - Math.floor(tf * 3));

        // Add visible wooden bough limbs on lower tiers
        if (tier < 4) {
          for (let b = 0; b < 4; b++) {
            const ba = (b / 4) * Math.PI * 2 + tier * 0.8;
            const bLen = radius * 0.85;
            const limb = new THREE.Mesh(new THREE.CylinderGeometry(trunkRadius * 0.08, trunkRadius * 0.22, bLen, 5), barkMat);
            limb.position.set(Math.cos(ba) * bLen * 0.44, height * (0.28 + tf * 0.68), Math.sin(ba) * bLen * 0.44);
            limb.rotation.z = -Math.cos(ba) * 1.25;
            limb.rotation.x = Math.sin(ba) * 1.25;
            grp.add(limb);
          }
        }

        for (let c = 0; c < cardsInTier; c++) {
          const ang = (c / cardsInTier) * Math.PI * 2 + tier * 0.95 + hash2(x + tier, z + c) * 0.5;
          const dist = radius * (0.58 + hash2(c, tier + x) * 0.42);
          const cx = x + Math.cos(ang) * dist;
          const cz = z + Math.sin(ang) * dist;
          const cy = ty - dist * 0.14 + (hash2(cx, cz) - 0.5) * 0.6;
          const cardScale = (2.6 + (1 - tf) * 2.8) * (height / 14);
          const tint = pal[(tier + c + Math.abs(Math.floor(x))) % pal.length];
          addPineCard(
            cx, cy, cz,
            cardScale, cardScale * 0.88,
            (hash2(cx, tier) - 0.5) * 0.45,
            ang + Math.PI * 0.5,
            (hash2(cz, c) - 0.5) * 0.35,
            tint
          );
        }
      }
      // Crown spire tip
      addPineCard(x, baseY + height * 0.98, z, 2.2 * (height / 14), 2.8 * (height / 14), 0, hash2(x, z) * 3, 0, pal[2]);
    } else {
      // Broadleaf Oak / Golden Forest Tree: 4 primary boughs + 8 secondary twigs + 38 dense layered leaf-cluster cards!
      const pal = palette || ['#B5C98E', '#9EB878', '#D1D08C', '#89A66A'];
      const boughCount = isHero ? 6 : 4;
      const crownR = height * (isHero ? 0.42 : 0.34);

      for (let b = 0; b < boughCount; b++) {
        const ba = (b / boughCount) * Math.PI * 2 + hash2(x, b * 7) * 0.5;
        const bLen = height * (isHero ? 0.42 : 0.38);
        const limb = new THREE.Mesh(new THREE.CylinderGeometry(trunkRadius * 0.16, trunkRadius * 0.44, bLen, 6), barkMat);
        const midX = Math.cos(ba) * bLen * 0.4;
        const midZ = Math.sin(ba) * bLen * 0.4;
        limb.position.set(midX, height * 0.68, midZ);
        limb.rotation.z = -Math.cos(ba) * 0.78;
        limb.rotation.x = Math.sin(ba) * 0.78;
        limb.castShadow = true;
        grp.add(limb);

        // Cluster of 7 overlapping foliage leaf-cards around each limb tip!
        const tipX = x + Math.cos(ba) * crownR * 0.85;
        const tipY = baseY + height * 0.82 + (hash2(b, x) - 0.3) * 1.6;
        const tipZ = z + Math.sin(ba) * crownR * 0.85;
        for (let k = 0; k < 7; k++) {
          const ka = hash2(b * 19 + k, x) * Math.PI * 2;
          const kr = (0.3 + hash2(k, z + b) * 0.7) * crownR * 0.62;
          const ky = (hash2(b + k, x + z) - 0.38) * crownR * 0.65;
          const sc = (2.8 + hash2(k * 7, x) * 2.1) * (isHero ? 1.25 : 1.0);
          const tint = pal[(b + k) % pal.length];
          addOakCard(
            tipX + Math.cos(ka) * kr,
            tipY + ky,
            tipZ + Math.sin(ka) * kr,
            sc, sc * 0.92,
            (hash2(k, b) - 0.5) * 0.5,
            ka,
            (hash2(x, k) - 0.5) * 0.45,
            tint
          );
        }
      }
      // Upper crown dome cluster (10 cards)
      for (let k = 0; k < 10; k++) {
        const ka = (k / 10) * Math.PI * 2;
        const kr = hash2(k, x + 5) * crownR * 0.65;
        const sc = (3.0 + hash2(k, z) * 1.8) * (isHero ? 1.2 : 1.0);
        addOakCard(
          x + Math.cos(ka) * kr,
          baseY + height * 0.94 + hash2(k * 3, x) * crownR * 0.42,
          z + Math.sin(ka) * kr,
          sc, sc * 0.88,
          (hash2(k, 9) - 0.5) * 0.4,
          ka,
          (hash2(k, 17) - 0.5) * 0.4,
          pal[k % pal.length]
        );
      }
    }

    scene.add(grp);
    registerCylinderCollider(x, z, trunkRadius * 1.18, height, 'tree');
  }

  function finalize() {
    pineInst.count = pineCount;
    pineInst.instanceMatrix.needsUpdate = true;
    if (pineInst.instanceColor) pineInst.instanceColor.needsUpdate = true;
    scene.add(pineInst);

    oakInst.count = oakCount;
    oakInst.instanceMatrix.needsUpdate = true;
    if (oakInst.instanceColor) oakInst.instanceColor.needsUpdate = true;
    scene.add(oakInst);
  }

  return { addTree, finalize };
}

// =========================================================================
// 3. 26,000-Blade GPU-Instanced Curved Shader Grass Meadow (Grassworks-style!)
// =========================================================================
function createCurvedGrassBladeGeometry() {
  // 3-blade natural grass tuft clump per instance -> 24,000 instances = 72,000 lush curved blades!!
  const positions = [];
  const uvs = [];
  const indices = [];
  const segs = 3;
  let vOff = 0;

  const subBlades = [
    { ox: 0.0,   oz: 0.0,   rot: 0.0,  h: 0.88, w: 0.105, bend: 0.24 },
    { ox: 0.14,  oz: 0.08,  rot: 2.1,  h: 0.72, w: 0.095, bend: 0.28 },
    { ox: -0.13, oz: 0.10,  rot: 4.2,  h: 0.64, w: 0.090, bend: 0.26 },
  ];

  for (const sb of subBlades) {
    const c = Math.cos(sb.rot), s = Math.sin(sb.rot);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const width = sb.w * (1.0 - Math.pow(Math.max(0.0001, t), 1.3));
      const y = t * sb.h;
      const curve = t * t * sb.bend;

      if (i < segs) {
        const lx1 = -width, lz1 = curve;
        const lx2 =  width, lz2 = curve;
        positions.push(
          sb.ox + lx1 * c - lz1 * s, y, sb.oz + lx1 * s + lz1 * c,
          sb.ox + lx2 * c - lz2 * s, y, sb.oz + lx2 * s + lz2 * c
        );
        uvs.push(0, t, 1, t);
      } else {
        const lz = curve + 0.03;
        positions.push(sb.ox - lz * s, y, sb.oz + lz * c);
        uvs.push(0.5, 1.0);
      }
    }
    for (let i = 0; i < segs - 1; i++) {
      const row = vOff + i * 2;
      const next = vOff + (i + 1) * 2;
      indices.push(row, row + 1, next, row + 1, next + 1, next);
    }
    const lastRow = vOff + (segs - 1) * 2;
    const tipIdx = vOff + segs * 2;
    indices.push(lastRow, lastRow + 1, tipIdx);
    vOff += segs * 2 + 1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildRealisticGrassField(scene, getBaseHeightAt, breathMaskAt, exclusions = []) {
  const BLADE_COUNT = 22000; // x3 blades per clump = 66,000 real curved blades!
  const baseGeo = createCurvedGrassBladeGeometry();
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = baseGeo.index;
  geo.attributes.position = baseGeo.attributes.position;
  geo.attributes.uv = baseGeo.attributes.uv;

  const offsets = new Float32Array(BLADE_COUNT * 3);
  const scales = new Float32Array(BLADE_COUNT * 3); // x: widthScale, y: heightScale, z: yaw
  const extra = new Float32Array(BLADE_COUNT * 3);  // x: breathMask, y: zoneMix (0=marsh,1=forest), z: seed

  function isExcluded(x, z) {
    // Keep cobblestone courtyard & lily pond clean
    if (Math.hypot(x + 258, z) < 11.4) return true;
    if (Math.hypot(x + 205, z + 24) < 15.8) return true;
    // Keep wooden bridge deck clear
    if (x > -143 && x < -125 && Math.abs(z) < 3.6) return true;
    // Keep cottages & tower footprints clear
    for (const ex of exclusions) {
      if (Math.hypot(x - ex.x, z - ex.z) < ex.r) return true;
    }
    // Keep main winding footpath subtly clear down center
    if (x > -256 && x < -140) {
      const pathZ = Math.sin((x + 258) * 0.045) * 4.2;
      if (Math.abs(z - pathZ) < 1.85) return true;
    }
    return false;
  }

  let placed = 0;
  let attempts = 0;
  while (placed < BLADE_COUNT && attempts < BLADE_COUNT * 4) {
    attempts++;
    // 55% concentrated densely around Tail Marshes Colony & meadow foreground (high visual richness!),
    // 45% across Spine Forest floor & glades
    let x, z;
    if (placed < BLADE_COUNT * 0.56) {
      x = -286 + hash2(attempts, 13.7) * 160;
      z = -48 + hash2(attempts, 29.3) * 96;
    } else {
      x = -126 + hash2(attempts, 47.1) * 162;
      z = -54 + hash2(attempts, 61.9) * 108;
    }
    if (isExcluded(x, z)) continue;

    // Clumpy organic meadow distribution (leaves subtle natural clearings)
    const clump = Math.sin(x * 0.17) * Math.cos(z * 0.19) + Math.sin((x + z) * 0.08);
    if (clump < -1.15 && hash2(attempts, 91.1) > 0.35) continue;

    const y = getBaseHeightAt(x, z);
    offsets[placed * 3] = x;
    offsets[placed * 3 + 1] = y - 0.08;
    offsets[placed * 3 + 2] = z;

    const hScale = 0.62 + hash2(attempts, 103.3) * 1.15;
    const wScale = 0.85 + hash2(attempts, 117.9) * 0.55;
    const yaw = hash2(attempts, 131.1) * Math.PI * 2;
    scales[placed * 3] = wScale;
    scales[placed * 3 + 1] = hScale;
    scales[placed * 3 + 2] = yaw;

    const zMix = Math.max(0, Math.min(1, (x + 148) / 36));
    extra[placed * 3] = breathMaskAt(x, z);
    extra[placed * 3 + 1] = zMix;
    extra[placed * 3 + 2] = hash2(attempts, 157.3);
    placed++;
  }

  geo.instanceCount = placed;
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 3));
  geo.setAttribute('aExtra', new THREE.InstancedBufferAttribute(extra, 3));

  const uniforms = {
    uTime: { value: 0 },
    uBreath: { value: 0 },
    uBreathAmp: { value: 1.6 },
    uWind: { value: 0.25 },
    uPlayerPos: { value: new THREE.Vector3(-258, 8, 0) },
    uSunDir: { value: new THREE.Vector3(0.82, 0.42, 0.38).normalize() },
    uFogColor: { value: new THREE.Color('#D5BA9D') },
    uFogDensity: { value: 0.0046 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aOffset;
      attribute vec3 aScale;
      attribute vec3 aExtra;

      uniform float uTime;
      uniform float uBreath;
      uniform float uBreathAmp;
      uniform float uWind;
      uniform vec3 uPlayerPos;

      varying float vH;
      varying float vSeed;
      varying float vZone;
      varying float vFogDepth;
      varying vec3 vWorldPos;

      void main() {
        vH = uv.y;
        vZone = aExtra.y;
        vSeed = aExtra.z;

        float wS = aScale.x;
        float hS = aScale.y;
        float yaw = aScale.z;

        vec3 local = vec3(position.x * wS, position.y * hS, position.z * hS);
        float c = cos(yaw), s = sin(yaw);
        vec3 rot = vec3(local.x * c - local.z * s, local.y, local.x * s + local.z * c);

        // World anchor follows live Giant breathing heave!
        vec3 worldBase = aOffset + vec3(0.0, uBreath * uBreathAmp * aExtra.x, 0.0);

        // Multi-octave traveling forest wind gusts (safe pow avoids WebGL NaN on uv.y == 0!)
        float hClamped = max(0.0001, uv.y);
        float gustA = sin(uTime * 1.85 + worldBase.x * 0.13 + worldBase.z * 0.09);
        float gustB = cos(uTime * 3.1 + worldBase.x * 0.27 - worldBase.z * 0.21) * 0.45;
        float bend = (hClamped * hClamped) * (0.22 + uWind * 0.62);
        rot.x += (gustA * 0.55 + gustB * 0.35 + uWind * 0.72) * bend;
        rot.z += (gustB * 0.5 - gustA * 0.25) * bend;

        // Interactive player trampling — blades part gently as Pip walks!
        vec2 toBlade = worldBase.xz - uPlayerPos.xz;
        float distP = length(toBlade);
        float pushMask = smoothstep(2.2, 0.25, distP) * hClamped;
        vec2 pushDir = distP > 0.01 ? (toBlade / distP) : vec2(1.0, 0.0);
        rot.xz += pushDir * pushMask * 0.75;
        rot.y -= pushMask * 0.26;

        vec3 wp = worldBase + rot;
        vWorldPos = wp;

        vec4 mvPosition = modelViewMatrix * vec4(wp, 1.0);
        vFogDepth = max(0.0, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uFogColor;
      uniform float uFogDensity;

      varying float vH;
      varying float vSeed;
      varying float vZone;
      varying float vFogDepth;
      varying vec3 vWorldPos;

      void main() {
        // TRUE LINEAR-SPACE photorealistic forest grass colors (Three.js OutputPass applies ACES + sRGB!)
        vec3 marshRoot = vec3(0.014, 0.036, 0.010);
        vec3 marshMid  = mix(vec3(0.048, 0.125, 0.026), vec3(0.075, 0.155, 0.032), vSeed);
        vec3 marshTip  = mix(vec3(0.145, 0.235, 0.052), vec3(0.245, 0.265, 0.068), vSeed);

        vec3 forestRoot = vec3(0.022, 0.024, 0.008);
        vec3 forestMid  = mix(vec3(0.088, 0.095, 0.022), vec3(0.145, 0.105, 0.024), vSeed);
        vec3 forestTip  = mix(vec3(0.245, 0.175, 0.042), vec3(0.320, 0.220, 0.055), vSeed);

        vec3 cRoot = mix(marshRoot, forestRoot, vZone);
        vec3 cMid  = mix(marshMid, forestMid, vZone);
        vec3 cTip  = mix(marshTip, forestTip, vZone);

        float h = clamp(vH, 0.0, 1.0);
        vec3 col = mix(cRoot, cMid, smoothstep(0.0, 0.55, h));
        col = mix(col, cTip, smoothstep(0.48, 1.0, h));

        // Dappled canopy shadow variation across the meadow floor
        float dapple = 0.78 + 0.28 * sin(vWorldPos.x * 0.14 + 0.5) * cos(vWorldPos.z * 0.15);
        col *= dapple;

        // Warm golden-hour backlit subsurface translucency (NaN-safe multiplication, zero pow(0,x)!)
        vec3 toCam = cameraPosition - vWorldPos;
        float camLen = max(0.001, length(toCam));
        vec3 viewDir = toCam / camLen;
        float bl = max(0.0, dot(-viewDir, normalize(uSunDir)));
        float backLight = bl * bl * bl;
        col += vec3(0.32, 0.24, 0.08) * backLight * (h * h) * 0.55;

        // Soft exponential atmospheric fog matching scene.fog (uFogColor is already linear)
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, uniforms, count: placed };
}

// =========================================================================
// 4. Instanced 3D Woodland Fern Rosettes (220 lush forest floor ferns!)
// =========================================================================
function createFernRosetteGeometry() {
  const fronds = 7;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
    const c = Math.cos(ang), s = Math.sin(ang);
    const len = 1.15 + (f % 3) * 0.16;
    const w = 0.44;
    const base = f * 6;

    // 2-segment arching frond (rises gracefully then arches outward!)
    const segPts = [
      { r: 0.04, y: 0.02, halfW: w * 0.45, v: 0.0 },
      { r: len * 0.52, y: 0.48, halfW: w * 0.62, v: 0.52 },
      { r: len, y: 0.28, halfW: w * 0.35, v: 1.0 },
    ];
    for (const sp of segPts) {
      // Left & right perpendicular to radial direction
      const px = -s * sp.halfW, pz = c * sp.halfW;
      positions.push(
        c * sp.r - px, sp.y, s * sp.r - pz,
        c * sp.r + px, sp.y, s * sp.r + pz
      );
      normals.push(0, 1, 0, 0, 1, 0);
      uvs.push(0, sp.v, 1, sp.v);
    }
    indices.push(
      base, base + 1, base + 2, base + 1, base + 3, base + 2,
      base + 2, base + 3, base + 4, base + 3, base + 5, base + 4
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildRealisticFerns(scene, fernFrondTex, getBaseHeightAt, anchorPoints = []) {
  const geo = createFernRosetteGeometry();
  const mat = new THREE.MeshStandardMaterial({
    map: fernFrondTex,
    alphaTest: 0.32,
    side: THREE.DoubleSide,
    roughness: 0.78,
  });

  const positions = [];
  // Cluster ferns naturally around tree roots, cottages, boulders & trail edges
  for (let i = 0; i < anchorPoints.length; i++) {
    const ap = anchorPoints[i];
    const perAnchor = ap.count || 3;
    for (let k = 0; k < perAnchor; k++) {
      const a = hash2(i * 11 + k, ap.x) * Math.PI * 2;
      const dist = (ap.r || 2.0) + 0.4 + hash2(k, ap.z + i) * 2.2;
      positions.push({
        x: ap.x + Math.cos(a) * dist,
        z: ap.z + Math.sin(a) * dist,
        s: 0.72 + hash2(i, k * 13) * 0.75,
        rot: hash2(ap.x + k, ap.z) * Math.PI * 2,
      });
    }
  }
  // Extra woodland undergrowth scattered across Marshes & Spine Forest
  for (let i = 0; i < 120; i++) {
    const x = -282 + hash2(i, 701) * 305;
    const z = -54 + hash2(i, 709) * 108;
    if (Math.hypot(x + 258, z) < 12 || Math.hypot(x + 205, z + 24) < 16) continue;
    positions.push({ x, z, s: 0.68 + hash2(i, 719) * 0.72, rot: hash2(i, 727) * Math.PI * 2 });
  }

  const inst = new THREE.InstancedMesh(geo, mat, positions.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  const cols = ['#84A868', '#6D9254', '#9CB874', '#7B9858'];

  positions.forEach((it, idx) => {
    p.set(it.x, getBaseHeightAt(it.x, it.z) - 0.08, it.z);
    e.set(0, it.rot, 0);
    q.setFromEuler(e);
    sc.set(it.s, it.s, it.s);
    m4.compose(p, q, sc);
    inst.setMatrixAt(idx, m4);
    inst.setColorAt(idx, col.set(cols[idx % cols.length]));
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);
  return { mesh: inst, items: positions, baseAmp: 0.08 };
}

// =========================================================================
// 5. Real 3D Arched Marsh Reeds & Velvet Cattails (replaces cactus sprites!)
// =========================================================================
function createReedClumpGeometry() {
  // 5 slender curving reed stalks in one clean geometry
  const pos = [];
  const norm = [];
  const idx = [];
  let vBase = 0;

  for (let s = 0; s < 5; s++) {
    const a = (s / 5) * Math.PI * 2 + s * 0.4;
    const ox = Math.cos(a) * 0.24;
    const oz = Math.sin(a) * 0.24;
    const h = 2.6 + (s % 3) * 0.65;
    const bend = 0.35 + (s % 2) * 0.25;
    const segs = 4;

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const w = 0.065 * (1 - t * 0.78);
      const cx = ox + Math.cos(a) * Math.pow(t, 2.0) * bend;
      const cz = oz + Math.sin(a) * Math.pow(t, 2.0) * bend;
      const cy = t * h;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      pos.push(cx - px, cy, cz - pz, cx + px, cy, cz + pz);
      norm.push(0, 0.7, 0.7, 0, 0.7, 0.7);
    }
    for (let i = 0; i < segs; i++) {
      const r0 = vBase + i * 2;
      const r1 = vBase + (i + 1) * 2;
      idx.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
    }
    vBase += (segs + 1) * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildRealisticReeds(scene, reedPositions, getBaseHeightAt) {
  const stalkGeo = createReedClumpGeometry();
  const stalkMat = new THREE.MeshStandardMaterial({
    color: '#6C8B52',
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const stalkInst = new THREE.InstancedMesh(stalkGeo, stalkMat, reedPositions.length);
  stalkInst.castShadow = true;
  stalkInst.receiveShadow = true;

  // Velvet dark-brown cattail heads on every 2nd reed clump!
  const catGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.56, 6);
  catGeo.translate(0, 2.55, 0);
  const catMat = new THREE.MeshStandardMaterial({ color: '#4E3422', roughness: 0.94 });
  const catCount = Math.ceil(reedPositions.length * 0.5);
  const catInst = new THREE.InstancedMesh(catGeo, catMat, catCount);

  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  const cols = ['#5D7F47', '#6E9154', '#7F9B5A', '#4E6F3C'];

  let ci = 0;
  reedPositions.forEach((it, idx) => {
    p.set(it.x, getBaseHeightAt(it.x, it.z) - 0.15, it.z);
    e.set(0, it.rot, 0);
    q.setFromEuler(e);
    sc.set(it.s, it.s, it.s);
    m4.compose(p, q, sc);
    stalkInst.setMatrixAt(idx, m4);
    stalkInst.setColorAt(idx, col.set(cols[idx % cols.length]));
    if (idx % 2 === 0 && ci < catCount) {
      catInst.setMatrixAt(ci++, m4);
    }
  });
  stalkInst.instanceMatrix.needsUpdate = true;
  if (stalkInst.instanceColor) stalkInst.instanceColor.needsUpdate = true;
  catInst.instanceMatrix.needsUpdate = true;
  scene.add(stalkInst, catInst);
  return [
    { mesh: stalkInst, items: reedPositions, baseAmp: 0.12 },
  ];
}

// =========================================================================
// 6. Terrain-Conforming Cobblestone Courtyard + Winding Flagstone Footpath
// =========================================================================
export function buildNaturalRoadAndCourtyard(scene, cobbleMat, stoneMat, getBaseHeightAt) {
  // Terrain-conforming cobblestone plaza at (-258, 0) — zero floating slab edges!
  const courtGeo = new THREE.PlaneGeometry(23, 23, 24, 24);
  courtGeo.rotateX(-Math.PI / 2);
  const pos = courtGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const r = Math.hypot(lx, lz);
    const wx = -258 + lx;
    const wz = lz;
    const gy = getBaseHeightAt(wx, wz);
    // Feather outer edge below grass so cobblestone blends organically into meadow!
    const rimSink = r > 9.4 ? -(r - 9.4) * 0.42 : 0.14;
    pos.setY(i, gy + rimSink);
  }
  courtGeo.computeVertexNormals();
  const courtMesh = new THREE.Mesh(courtGeo, cobbleMat);
  courtMesh.position.set(-258, 0, 0);
  courtMesh.receiveShadow = true;
  scene.add(courtMesh);

  // Winding stepping-stone flagstone trail: Colony -> Grandma -> Bridge -> Spine Forest -> Rib Caverns!
  const stoneGeo = new THREE.CylinderGeometry(1.15, 1.32, 0.24, 7);
  const pathPoints = [];
  for (let x = -246; x <= -144; x += 3.2) {
    const z = Math.sin((x + 258) * 0.045) * 4.2;
    pathPoints.push({ x, z, r: 0.85 + hash2(x, 11) * 0.42 });
  }
  // Branch spur right to Grandma Moss-Ant (-242, 4)
  pathPoints.push({ x: -245, z: 3.1, r: 1.05 }, { x: -242, z: 4.0, r: 1.25 });
  // Continue east past Wooden Bridge through Spine Forest to Rib Caverns entrance
  for (let x = -124; x <= 38; x += 4.2) {
    const z = Math.sin((x + 124) * 0.032) * 5.2;
    pathPoints.push({ x, z, r: 0.9 + hash2(x, 23) * 0.45 });
  }

  const inst = new THREE.InstancedMesh(stoneGeo, stoneMat, pathPoints.length);
  inst.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const vP = new THREE.Vector3();
  const vQ = new THREE.Quaternion();
  const vS = new THREE.Vector3();
  const vE = new THREE.Euler();

  pathPoints.forEach((pt, idx) => {
    const y = getBaseHeightAt(pt.x, pt.z);
    // Tilt flagstone slightly to match local terrain slope
    const slopeX = (getBaseHeightAt(pt.x + 1, pt.z) - getBaseHeightAt(pt.x - 1, pt.z)) * 0.5;
    const slopeZ = (getBaseHeightAt(pt.x, pt.z + 1) - getBaseHeightAt(pt.x, pt.z - 1)) * 0.5;
    vP.set(pt.x, y + 0.04, pt.z);
    vE.set(Math.atan(slopeZ), hash2(pt.x, pt.z) * Math.PI * 2, -Math.atan(slopeX));
    vQ.setFromEuler(vE);
    vS.set(pt.r, 1.0, pt.r * (0.82 + hash2(idx, 5) * 0.32));
    m4.compose(vP, vQ, vS);
    inst.setMatrixAt(idx, m4);
  });
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
}

// =========================================================================
// 7. Custom Volumetric Sun-Shaft God-Rays (Soft Fresnel + Camera Proximity Fade)
// =========================================================================
export function buildVolumetricGodRays(scene, getBaseHeightAt) {
  const spots = [
    [-250, -6], [-212, -14], [-174, 8], [-138, -10],
    [-112, -4], [-86, 12], [-64, -10], [-38, 6], [-12, -8], [16, 4],
    [224, 6], [258, -6],
  ];

  const geo = new THREE.CylinderGeometry(2.4, 7.2, 48, 12, 1, true);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#FFE0A2') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 toCam = cameraPosition - vWorldPos;
        float camDist = max(0.001, length(toCam));
        vec3 viewDir = toCam / camDist;
        float ndv = abs(dot(normalize(vWorldNormal), viewDir));
        float fresnel = ndv * ndv;
        float vFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.18, vUv.y);
        float nearFade = smoothstep(10.0, 26.0, camDist);
        float shimmer = 0.82 + 0.18 * sin(uTime * 0.7 + vWorldPos.x * 0.08 + vUv.x * 6.28);
        float alpha = fresnel * vFade * nearFade * shimmer * 0.13;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  const meshes = [];
  for (const [gx, gz] of spots) {
    const gy = getBaseHeightAt(gx, gz);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(gx, gy + 19, gz);
    m.rotation.z = -0.34;
    m.rotation.x = 0.12;
    scene.add(m);
    meshes.push(m);
  }
  return { meshes, uniforms };
}
