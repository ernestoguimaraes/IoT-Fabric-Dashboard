import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { effectiveSpeed } from '../shared/simulation.js';

// Fator de ritmo da animação (0 = parado) a partir do estado reativo da máquina.
const pace = (d) => (d.status === 'offline' ? 0 : effectiveSpeed(d) / 100);

/**
 * Monta a cena 3D (idêntica à v2) lendo os objetos de máquina do store por referência.
 * Mudanças de telemetria/parâmetros refletem a cada frame (cores, feixes, andon, IHM, ritmo).
 */
export function initScene(container, MACHINES, { onPick } = {}) {

const STATUS_COLOR = { online: 0x3fb950, alert: 0xd29922, offline: 0xf85149 };

// ─── Renderer, câmera e pós-processamento ────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06090e);
scene.fog = new THREE.FogExp2(0x06090e, 0.026);

const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 120);
const CAM_HOME = new THREE.Vector3(14, 11, 19);
const CAM_INTRO = new THREE.Vector3(-22, 24, 34);
camera.position.copy(CAM_INTRO);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
container.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(container.clientWidth, container.clientHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
container.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 2);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 5;
controls.maxDistance = 38;
controls.autoRotateSpeed = 0.35;
controls.update();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const outlinePass = new OutlinePass(new THREE.Vector2(container.clientWidth, container.clientHeight), scene, camera);
outlinePass.edgeStrength = 4;
outlinePass.edgeGlow = 0.8;
outlinePass.edgeThickness = 1.6;
outlinePass.pulsePeriod = 2.4;
outlinePass.visibleEdgeColor.set(0x2dd4bf);
outlinePass.hiddenEdgeColor.set(0x1b3a5c);
composer.addPass(outlinePass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.75, 0.5, 1.05);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ─── Materiais e utilitários ─────────────────────────────────────────────────

const std = (color, roughness = 0.5, metalness = 0.5, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.5, ...extra });
const glow = (color, intensity = 3) =>
  new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const TEX = {
  stripes: canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e0a526'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111317';
    for (let i = -h; i < w; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + 16, h); ctx.lineTo(i + 16 + h, 0); ctx.lineTo(i + h, 0); ctx.fill();
    }
  }),
  radial: canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#808080'); g.addColorStop(1, '#000000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }),
  vertical: canvasTex(4, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#000000'); g.addColorStop(0.7, '#404040'); g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }),
  belt: canvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#16191e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2b313a';
    for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 3, h);
  }),
  floor: canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#141a22'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      const v = 18 + Math.random() * 14;
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},${Math.random() * 0.35})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3;
    for (let i = 0; i <= w; i += 256) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
  }),
};

function stripeMat(rx, ry) {
  const t = TEX.stripes.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return std(0xffffff, 0.65, 0.1, { map: t });
}

const MAT = {
  dark:      std(0x1c2129, 0.5, 0.65),
  darker:    std(0x0f1318, 0.6, 0.5),
  steel:     std(0xc3ccd6, 0.2, 1.0),
  white:     std(0xb4bcc6, 0.4, 0.15),
  brand:     std(0x0f8f80, 0.55, 0.35),
  rubber:    std(0x0b0d10, 0.9, 0.0),
  copper:    std(0xc07a3a, 0.3, 0.9),
  wood:      std(0x8a6a45, 0.85, 0.0),
  cardboard: std(0xb88a55, 0.85, 0.0),
  tape:      std(0xd9c7a0, 0.6, 0.0),
  yellow:    std(0xf2b705, 0.38, 0.3),
  lane:      std(0xe0a526, 0.6, 0.1, { emissive: 0xe0a526, emissiveIntensity: 0.22 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x8fc4f0, transparent: true, opacity: 0.07, roughness: 0.04, metalness: 0,
    side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.5,
  }),
};

function box(w, h, d, mat, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(g, mat);
}
function cyl(rt, rb, h, mat, seg = 24, open = false) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
}
function at(obj, x, y, z, parent) {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}
function additive(color, map, opacity) {
  return new THREE.MeshBasicMaterial({
    color, map, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
}

// ─── Iluminação ──────────────────────────────────────────────────────────────

scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x0b0f14, 0.25));

const keyLight = new THREE.DirectionalLight(0xfff1e0, 1.5);
keyLight.position.set(12, 18, 8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 50;
keyLight.shadow.camera.left = -16;
keyLight.shadow.camera.right = 16;
keyLight.shadow.camera.top = 16;
keyLight.shadow.camera.bottom = -16;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x3a7bff, 0.9);
rimLight.position.set(-10, 6, -14);
scene.add(rimLight);

// ─── Piso ────────────────────────────────────────────────────────────────────

TEX.floor.wrapS = TEX.floor.wrapT = THREE.RepeatWrapping;
TEX.floor.repeat.set(5, 5);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  std(0xffffff, 0.3, 0.35, { map: TEX.floor })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.02, 2);
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(28, 28, 0x2a4a6e, 0x1a2330);
grid.material.transparent = true;
grid.material.opacity = 0.28;
grid.position.set(0, 0.001, 2);
scene.add(grid);

function floorStrip(x1, z1, x2, z2, w, mat, y = 0.004) {
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  g.add(m);
  g.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  g.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
  scene.add(g);
  return g;
}

// Corredores das empilhadeiras
[[-5.55, -3.6, -5.55, 6.7], [-4.45, -3.6, -4.45, 6.7],
 [2.45, -2.6, 2.45, 6.7], [3.55, -2.6, 3.55, 3.45],
 [3.55, 3.45, 7.55, 3.45], [3.55, 4.55, 6.45, 4.55],
 [6.45, 4.55, 6.45, 6.7], [7.55, 3.45, 7.55, 6.7]]
  .forEach(([a, b, c, d]) => floorStrip(a, b, c, d, 0.07, MAT.lane));

// Zonas de risco (faixas zebradas)
function hazardFrame(cx, cz, w, d) {
  const t = 0.14;
  floorStrip(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, t, stripeMat(w * 2, 0.5), 0.005);
  floorStrip(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, t, stripeMat(w * 2, 0.5), 0.005);
  floorStrip(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, t, stripeMat(d * 2, 0.5), 0.005);
  floorStrip(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, t, stripeMat(d * 2, 0.5), 0.005);
}
hazardFrame(4, 10, 2.4, 1.9);
hazardFrame(8, 10, 2.0, 1.9);
[-6, -2, 2].forEach((x) => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.2, 64), stripeMat(6, 6));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.005, -2);
  scene.add(ring);
});

// ─── Galpão: vidro, estrutura metálica e iluminação suspensa ────────────────

function createWall(w, h, pos, rotY = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.glass);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.y = rotY;
  scene.add(mesh);
  const kick = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.16), stripeMat(w * 1.5, 0.3));
  kick.position.set(pos[0], 0.08, pos[2]);
  kick.rotation.y = rotY;
  kick.material.side = THREE.DoubleSide;
  scene.add(kick);
}
createWall(18, 5, [0, 2.5, -8.5]);
createWall(18, 5, [0, 2.5, 12.5]);
createWall(20, 5, [-9.5, 2.5, 2], Math.PI / 2);
createWall(20, 5, [9.5, 2.5, 2], Math.PI / 2);

const steelFrame = std(0x2a313b, 0.45, 0.85);
// Pilares apenas nas paredes do fundo, para não obstruir a visão do operador
for (let x = -9.5; x <= 9.51; x += 3.8) at(box(0.18, 5.3, 0.18, steelFrame), x, 2.65, -8.5, scene).castShadow = true;
for (let z = -4.3; z <= 8.4; z += 4.2) at(box(0.18, 5.3, 0.18, steelFrame), -9.5, 2.65, z, scene).castShadow = true;
[[-9.5, 12.5], [9.5, 12.5]].forEach(([x, z]) => at(box(0.18, 5.3, 0.18, steelFrame), x, 2.65, z, scene));
[-8.5, 12.5].forEach((z) => at(box(19.2, 0.2, 0.14, steelFrame), 0, 5.25, z, scene));
[-9.5, 9.5].forEach((x) => at(box(0.14, 0.2, 21.2, steelFrame), x, 5.25, 2, scene));

const lampMat = glow(0xe4efff, 3.2);
const coneMat = additive(0x9cc7ff, TEX.vertical, 0.03);
[-4.5, 4.5].forEach((x) => {
  [-5, 1, 7].forEach((z) => {
    at(box(2.2, 0.08, 0.34, MAT.darker), x, 4.96, z, scene);
    for (const dx of [-0.9, 0.9]) at(cyl(0.006, 0.006, 0.6, MAT.dark, 4), x + dx, 5.3, z, scene);
    at(box(2.0, 0.02, 0.24, lampMat), x, 4.91, z, scene);
    const spot = new THREE.SpotLight(0xdfeaff, 15, 13, 0.75, 0.7, 1.4);
    spot.position.set(x, 4.85, z);
    spot.target.position.set(x, 0, z);
    scene.add(spot, spot.target);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.3, 4.8, 40, 1, true), coneMat);
    cone.position.set(x, 2.45, z);
    scene.add(cone);
  });
});

// Painel de LED institucional na parede do fundo
const signTex = canvasTex(2048, 200, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.font = '600 92px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(w * 0.15, 0, w * 0.85, 0);
  grad.addColorStop(0, '#2dd4bf');
  grad.addColorStop(1, '#a78bfa');
  ctx.fillStyle = grad;
  ctx.fillText('AI FABRIC  ·  CENTRAL DE MONITORAMENTO IoT  ·  LINHA A', w / 2, h / 2);
});
const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, depthWrite: false });
signMat.color.setScalar(1.8);
at(new THREE.Mesh(new THREE.PlaneGeometry(11, 1.08), signMat), 0, 4.15, -8.38, scene);

// ─── Atmosfera: partículas de poeira ─────────────────────────────────────────

const DUST_N = 650;
const dustPos = new Float32Array(DUST_N * 3);
const dustSpeed = new Float32Array(DUST_N);
for (let i = 0; i < DUST_N; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 18;
  dustPos[i * 3 + 1] = Math.random() * 5;
  dustPos[i * 3 + 2] = -8 + Math.random() * 20;
  dustSpeed[i] = 0.02 + Math.random() * 0.06;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0x9cc7ff, size: 0.035, map: TEX.radial, transparent: true, opacity: 0.45,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(dust);

// ─── Componentes compartilhados: torre de sinalização e IHM ─────────────────

const stackLights = [];
function addStackLight(parent, data, x, y, z) {
  const g = new THREE.Group();
  at(cyl(0.014, 0.014, 0.12, MAT.steel, 8), 0, 0.06, 0, g);
  at(cyl(0.05, 0.05, 0.02, MAT.dark, 20), 0, 0.12, 0, g);
  const colors = [0x3fb950, 0xd29922, 0xf85149];
  const mats = colors.map((c, i) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c), emissive: c, roughness: 0.25, metalness: 0.1 });
    at(cyl(0.045, 0.045, 0.07, m, 20), 0, 0.165 + i * 0.075, 0, g);
    return { m, c };
  });
  stackLights.push({ mats, data, phase: Math.random() * 6 });
  at(cyl(0.05, 0.05, 0.02, MAT.dark, 20), 0, 0.395, 0, g);
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const screens = [];
function createScreen(data, w = 0.3, h = 0.19) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 160;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const s = {
    ctx: canvas.getContext('2d'), tex, data,
    hist: Array.from({ length: 32 }, () => data.usage + (Math.random() - 0.5) * 10),
  };
  drawScreen(s);
  screens.push(s);
  return mesh;
}
function drawScreen(s) {
  const { ctx, data } = s;
  const W = 256, H = 160;
  const col = data.status === 'online' ? '#3fb950' : data.status === 'alert' ? '#d29922' : '#f85149';
  ctx.fillStyle = '#04101d'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = col; ctx.fillRect(0, 0, W, 28);
  ctx.fillStyle = '#04101d'; ctx.font = 'bold 17px Segoe UI, sans-serif';
  ctx.textAlign = 'left'; ctx.fillText(data.id, 10, 20);
  ctx.textAlign = 'right'; ctx.fillText(data.status.toUpperCase(), W - 10, 20);
  ctx.textAlign = 'left';
  if (data.status === 'offline') {
    ctx.fillStyle = '#f85149'; ctx.font = 'bold 30px Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('SEM SINAL', W / 2, 100); ctx.textAlign = 'left';
    s.tex.needsUpdate = true;
    return;
  }
  ctx.fillStyle = '#7d8a99'; ctx.font = '13px Segoe UI, sans-serif';
  ctx.fillText('TEMP', 10, 50); ctx.fillText('VIB', 96, 50); ctx.fillText('USO', 180, 50);
  ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 22px Segoe UI, sans-serif';
  ctx.fillText(Math.round(data.temp) + '°', 10, 76); ctx.fillText(data.vib.toFixed(1), 96, 76); ctx.fillText(Math.round(data.usage) + '%', 180, 76);
  ctx.beginPath();
  s.hist.forEach((v, i) => {
    const x = 10 + i * (236 / (s.hist.length - 1));
    const y = 150 - (Math.max(0, Math.min(100, v)) / 100) * 58;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = '#2dd4bf'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(246, 152); ctx.lineTo(10, 152); ctx.closePath();
  ctx.fillStyle = 'rgba(88,166,255,0.16)'; ctx.fill();
  s.tex.needsUpdate = true;
}

// ─── Braço articulado de 6 eixos (robôs e célula de solda) ───────────────────

function buildArm(color, scale = 1, tool = 'gripper') {
  const armMat = std(color, 0.34, 0.35);
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  const j1 = new THREE.Group(); root.add(j1);
  at(cyl(0.3, 0.34, 0.18, armMat, 32), 0, 0.09, 0, j1);
  at(cyl(0.24, 0.27, 0.04, MAT.dark, 32), 0, 0.2, 0, j1);
  at(box(0.34, 0.3, 0.38, armMat, 0.06), 0, 0.36, 0, j1);

  const j2 = new THREE.Group(); j2.position.set(0, 0.42, 0); j1.add(j2);
  const cap2 = cyl(0.14, 0.14, 0.46, MAT.dark, 28); cap2.rotation.x = Math.PI / 2; j2.add(cap2);
  at(box(0.17, 0.86, 0.21, armMat, 0.06), 0, 0.43, 0, j2);

  const j3 = new THREE.Group(); j3.position.set(0, 0.86, 0); j2.add(j3);
  const cap3 = cyl(0.11, 0.11, 0.32, MAT.dark, 24); cap3.rotation.x = Math.PI / 2; j3.add(cap3);
  const motor = cyl(0.085, 0.085, 0.22, MAT.dark, 20); motor.rotation.z = Math.PI / 2; at(motor, -0.18, 0, 0, j3);
  at(box(0.72, 0.14, 0.16, armMat, 0.05), 0.36, 0, 0, j3);

  const wrist = new THREE.Group(); wrist.position.set(0.74, 0, 0); j3.add(wrist);
  const wr = cyl(0.07, 0.07, 0.12, MAT.steel, 20); wr.rotation.z = Math.PI / 2; wrist.add(wr);
  const flange = new THREE.Group(); flange.position.set(0.08, 0, 0); wrist.add(flange);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 8, 28), glow(0x2dd4bf, 2.8));
  ring.rotation.y = Math.PI / 2; at(ring, 0.01, 0, 0, flange);

  const fingers = [];
  const tip = new THREE.Object3D();
  if (tool === 'gripper') {
    at(box(0.06, 0.13, 0.15, MAT.steel, 0.012), 0.05, 0, 0, flange);
    [-1, 1].forEach((side) => {
      const f = at(box(0.13, 0.035, 0.028, MAT.steel, 0.006), 0.14, 0, side * 0.045, flange);
      fingers.push({ mesh: f, side });
    });
    tip.position.set(0.2, 0, 0);
  } else {
    at(box(0.07, 0.1, 0.1, MAT.dark, 0.012), 0.04, 0, 0, flange);
    const torch = cyl(0.028, 0.016, 0.24, MAT.copper, 16); torch.rotation.z = -Math.PI / 2;
    at(torch, 0.19, 0, 0, flange);
    tip.position.set(0.32, 0, 0);
  }
  flange.add(tip);
  return { root, j1, j2, j3, wrist, fingers, tip, mat: armMat };
}

// ─── Centro de usinagem CNC ──────────────────────────────────────────────────

function buildCNC(data) {
  const g = new THREE.Group();
  const on = data.status !== 'offline';
  at(box(1.84, 0.16, 1.34, MAT.darker, 0.03), 0, 0.08, 0, g);
  at(box(1.7, 1.1, 1.0, MAT.white, 0.05), 0, 0.71, -0.1, g);
  // Moldura frontal com janela de inspeção
  at(box(0.18, 1.1, 0.2, MAT.white), -0.76, 0.71, 0.5, g);
  at(box(0.62, 1.1, 0.2, MAT.white), 0.54, 0.71, 0.5, g);
  at(box(0.9, 0.22, 0.2, MAT.white), -0.22, 1.15, 0.5, g);
  at(box(0.9, 0.28, 0.2, MAT.white), -0.22, 0.3, 0.5, g);
  at(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), MAT.darker), -0.22, 0.74, 0.402, g);
  at(box(0.8, 0.02, 0.03, glow(0xcfe8ff, on ? 2.6 : 0.05)), -0.22, 1.025, 0.52, g);
  // Mesa, peça e spindle visíveis pela janela
  at(box(0.62, 0.05, 0.16, MAT.dark), -0.22, 0.47, 0.5, g);
  at(box(0.16, 0.08, 0.1, MAT.steel, 0.01), -0.22, 0.535, 0.5, g);
  const spindle = new THREE.Group(); spindle.position.set(-0.22, 0.86, 0.5); g.add(spindle);
  at(cyl(0.07, 0.07, 0.28, MAT.steel, 24), 0, 0.06, 0, spindle);
  at(cyl(0.1, 0.1, 0.06, MAT.dark, 6), 0, -0.1, 0, spindle);
  at(cyl(0.012, 0.004, 0.16, MAT.steel, 8), 0, -0.2, 0, spindle);
  at(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), MAT.glass), -0.22, 0.74, 0.605, g);
  at(box(0.03, 0.3, 0.04, MAT.steel, 0.01), 0.17, 0.74, 0.63, g);
  // IHM, botoeiras e topo na cor da marca
  at(box(0.36, 0.28, 0.04, MAT.darker, 0.015), 0.54, 0.86, 0.62, g);
  at(createScreen(data), 0.54, 0.86, 0.642, g);
  const estop = cyl(0.035, 0.035, 0.03, glow(0xff2a2a, 1.4), 20); estop.rotation.x = Math.PI / 2; at(estop, 0.44, 0.58, 0.615, g);
  const start = cyl(0.025, 0.025, 0.02, glow(0x3fb950, on ? 1.6 : 0.1), 16); start.rotation.x = Math.PI / 2; at(start, 0.56, 0.58, 0.61, g);
  at(box(1.74, 0.1, 1.24, MAT.brand, 0.04), 0, 1.31, 0, g);
  for (let i = 0; i < 5; i++) at(box(0.012, 0.03, 0.55, MAT.darker), 0.856, 0.52 + i * 0.09, -0.1, g);
  at(box(0.34, 0.3, 0.36, MAT.dark, 0.03), -0.55, 0.31, -0.78, g);
  addStackLight(g, data, 0.72, 1.36, -0.45);

  return {
    model: g,
    update(t, dt) { spindle.rotation.y += dt * 22 * pace(data); },
  };
}

// ─── Robô industrial ─────────────────────────────────────────────────────────

function buildRobot(data) {
  const g = new THREE.Group();
  at(cyl(0.42, 0.48, 0.25, MAT.dark, 32), 0, 0.125, 0, g);
  at(cyl(0.44, 0.44, 0.02, MAT.steel, 32), 0, 0.26, 0, g);
  const arm = buildArm(0xf08a24, 0.75, 'gripper');
  arm.root.position.y = 0.27;
  g.add(arm.root);
  at(box(0.04, 0.9, 0.04, MAT.dark), 0.75, 0.45, -0.6, g);
  addStackLight(g, data, 0.75, 0.9, -0.6);

  const phase = Math.random() * Math.PI * 2;
  const baseYaw = -Math.PI / 2;
  const armOn = new THREE.Color(0xf08a24), armOff = new THREE.Color(0x5c4330);
  let lt = 0;
  return {
    model: g,
    update(t, dt) {
      const off = data.status === 'offline';
      arm.mat.color.lerp(off ? armOff : armOn, Math.min(1, dt * 3));
      if (off) {
        const e = Math.min(1, dt * 2);
        arm.j1.rotation.y += (baseYaw + 0.4 - arm.j1.rotation.y) * e;
        arm.j2.rotation.z += (-0.95 - arm.j2.rotation.z) * e;
        arm.j3.rotation.z += (-0.95 - arm.j3.rotation.z) * e;
        return;
      }
      lt += dt * pace(data);
      t = lt;
      const k = t * 0.8 + phase;
      arm.j1.rotation.y = baseYaw + Math.sin(t * 0.45 + phase) * 0.9;
      arm.j2.rotation.z = -0.35 + Math.sin(k) * 0.22;
      arm.j3.rotation.z = -0.6 + Math.sin(k + 1.2) * 0.32;
      arm.wrist.rotation.x = t * 1.4;
      const open = (Math.sin(t * 1.6 + phase) + 1) / 2;
      arm.fingers.forEach((f) => { f.mesh.position.z = f.side * (0.028 + open * 0.035); });
    },
  };
}

// ─── Esteira transportadora ──────────────────────────────────────────────────

function buildConveyor(data) {
  const g = new THREE.Group();
  const L = 2.1;
  for (const x of [-0.9, 0.9]) for (const z of [-0.24, 0.24]) at(box(0.06, 0.5, 0.06, MAT.dark), x, 0.25, z, g);
  at(box(0.04, 0.04, 0.48, MAT.dark), -0.9, 0.18, 0, g);
  at(box(0.04, 0.04, 0.48, MAT.dark), 0.9, 0.18, 0, g);
  for (const z of [-0.3, 0.3]) at(box(L + 0.1, 0.11, 0.05, MAT.brand, 0.015), 0, 0.53, z, g);
  const beltTex = TEX.belt.clone();
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
  beltTex.repeat.set(6, 1);
  beltTex.needsUpdate = true;
  at(box(L, 0.03, 0.54, std(0xffffff, 0.8, 0.1, { map: beltTex })), 0, 0.535, 0, g);
  for (const x of [-L / 2, L / 2]) {
    const r = cyl(0.05, 0.05, 0.56, MAT.steel, 20); r.rotation.x = Math.PI / 2; at(r, x, 0.52, 0, g);
  }
  // Sensor fotoelétrico e IHM
  at(box(0.04, 0.3, 0.04, MAT.dark), 0.3, 0.7, 0.34, g);
  at(box(0.03, 0.03, 0.03, glow(0xff3b3b, 3)), 0.3, 0.8, 0.31, g);
  at(box(0.04, 0.6, 0.04, MAT.dark), 1.15, 0.3, 0.3, g);
  const hmi = createScreen(data, 0.24, 0.15);
  at(box(0.28, 0.19, 0.04, MAT.darker, 0.01), 1.15, 0.68, 0.32, g);
  at(hmi, 1.15, 0.68, 0.343, g);
  addStackLight(g, data, 1.15, 0.78, 0.22);

  const boxes = [];
  const sizes = [[0.28, 0.2, 0.3], [0.22, 0.16, 0.24], [0.3, 0.22, 0.32]];
  for (let i = 0; i < 3; i++) {
    const [w, h, d] = sizes[i];
    const b = new THREE.Group();
    at(box(w, h, d, MAT.cardboard, 0.012), 0, h / 2, 0, b);
    at(box(w + 0.004, 0.012, 0.06, MAT.tape), 0, h + 0.001, 0, b);
    b.position.set(-L / 2 + (i / 3) * L, 0.55, (Math.random() - 0.5) * 0.08);
    b.rotation.y = (Math.random() - 0.5) * 0.25;
    g.add(b);
    boxes.push(b);
  }
  return {
    model: g,
    update(t, dt) {
      const speed = 0.35 * pace(data);
      const shaky = data.status === 'alert' && data.vib >= data.params.vibLimit;
      beltTex.offset.x -= dt * speed * 3 / L;
      boxes.forEach((b, i) => {
        b.position.x += dt * speed;
        if (b.position.x > L / 2 - 0.1) b.position.x = -L / 2 + 0.1;
        b.position.y = 0.55 + (shaky ? Math.sin(t * 38 + i) * 0.006 : 0);
      });
    },
  };
}

// ─── Empilhadeira ────────────────────────────────────────────────────────────

function buildForklift(data) {
  const g = new THREE.Group();
  at(box(0.84, 0.26, 0.54, MAT.yellow, 0.05), 0, 0.24, 0, g);
  at(box(0.22, 0.36, 0.56, MAT.dark, 0.06), -0.38, 0.28, 0, g);
  at(box(0.26, 0.06, 0.3, MAT.darker, 0.02), -0.1, 0.4, 0, g);
  at(box(0.06, 0.2, 0.28, MAT.darker, 0.02), -0.22, 0.5, 0, g);
  const wheelS = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), MAT.darker);
  wheelS.rotation.set(Math.PI / 2, 0.6, 0);
  at(wheelS, 0.08, 0.58, 0, g);
  for (const x of [-0.3, 0.2]) for (const z of [-0.23, 0.23]) at(box(0.03, 0.5, 0.03, MAT.darker), x, 0.62, z, g);
  at(box(0.56, 0.03, 0.52, MAT.darker, 0.01), -0.05, 0.88, 0, g);
  const beaconMat = glow(0xff8c1a, 3);
  at(cyl(0.035, 0.035, 0.05, beaconMat, 16), -0.22, 0.92, 0, g);
  const hlMat = glow(0xfff4d6, 4);
  for (const z of [-0.2, 0.2]) at(box(0.02, 0.04, 0.05, hlMat), 0.215, 0.84, z, g);
  for (const z of [-0.13, 0.13]) at(box(0.04, 0.9, 0.045, MAT.steel), 0.46, 0.5, z, g);
  at(box(0.04, 0.04, 0.3, MAT.steel), 0.46, 0.93, 0, g);

  const carriage = new THREE.Group(); carriage.position.set(0.49, 0.06, 0); g.add(carriage);
  at(box(0.03, 0.32, 0.36, MAT.darker), 0, 0.16, 0, carriage);
  for (const z of [-0.1, 0.1]) at(box(0.44, 0.025, 0.06, MAT.steel), 0.23, 0.012, z, carriage);
  if (data.id !== 'FKL-002') {
    at(box(0.4, 0.07, 0.36, MAT.wood), 0.23, 0.06, 0, carriage);
    at(box(0.32, 0.24, 0.3, MAT.cardboard, 0.012), 0.23, 0.215, 0, carriage);
    at(box(0.324, 0.012, 0.06, MAT.tape), 0.23, 0.335, 0, carriage);
  }

  const wheels = [];
  for (const [x, r] of [[0.28, 0.105], [-0.27, 0.09]]) {
    for (const z of [-0.28, 0.28]) {
      const w = new THREE.Group(); w.position.set(x, r, z); g.add(w);
      const tire = cyl(r, r, 0.08, MAT.rubber, 22); tire.rotation.x = Math.PI / 2; w.add(tire);
      const hub = cyl(r * 0.5, r * 0.5, 0.085, MAT.steel, 12); hub.rotation.x = Math.PI / 2; w.add(hub);
      wheels.push({ w, r });
    }
  }
  const spot = new THREE.SpotLight(0xfff1d6, 9, 5, 0.55, 0.6, 1.6);
  spot.position.set(0.25, 0.82, 0);
  spot.target.position.set(1.8, 0, 0);
  g.add(spot, spot.target);

  let dist = 0;
  const phase = Math.random() * 6;
  return {
    model: g,
    update(t, dt, m) {
      dist += m.moved || 0;
      wheels.forEach(({ w, r }) => { w.rotation.z = -dist / r; });
      carriage.position.y = 0.06 + (Math.sin(t * 0.7 + phase) * 0.5 + 0.5) * 0.18;
      beaconMat.emissiveIntensity = Math.sin(t * 9 + phase) > 0.2 ? 5 : 0.3;
    },
  };
}

// ─── Injetora de plástico ────────────────────────────────────────────────────

function buildInjector(data) {
  const g = new THREE.Group();
  at(box(2.1, 0.08, 0.72, MAT.darker), 0, 0.04, 0, g);
  at(box(2.2, 0.45, 0.8, MAT.white, 0.04), 0, 0.305, 0, g);
  at(box(2.22, 0.04, 0.82, MAT.brand), 0, 0.51, 0, g);
  // Unidade de fechamento
  at(box(0.12, 0.7, 0.7, MAT.brand, 0.02), -1.0, 0.88, 0, g);
  at(box(0.14, 0.76, 0.76, MAT.brand, 0.02), -0.1, 0.91, 0, g);
  at(box(0.12, 0.3, 0.34, MAT.copper, 0.01), -0.23, 0.9, 0, g);
  for (const y of [0.64, 1.16]) for (const z of [-0.27, 0.27]) {
    const tb = cyl(0.03, 0.03, 0.92, MAT.steel, 16); tb.rotation.z = Math.PI / 2; at(tb, -0.55, y, z, g);
  }
  const platen = new THREE.Group(); platen.position.set(-0.55, 0.9, 0); g.add(platen);
  at(box(0.1, 0.62, 0.62, MAT.steel, 0.015), 0, 0, 0, platen);
  at(box(0.12, 0.3, 0.34, MAT.copper, 0.01), 0.11, 0, 0, platen);
  const toggle = cyl(0.06, 0.06, 0.4, MAT.steel, 16); toggle.rotation.z = Math.PI / 2; at(toggle, -0.25, 0, 0, platen);
  for (const z of [-0.4, 0.4]) at(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.66), MAT.glass), -0.55, 0.88, z, g);
  // Unidade de injeção
  at(box(0.95, 0.1, 0.36, MAT.dark, 0.02), 0.5, 0.58, 0, g);
  const barrel = cyl(0.075, 0.075, 0.86, MAT.steel, 24); barrel.rotation.z = Math.PI / 2; at(barrel, 0.45, 0.8, 0, g);
  const nozzle = cyl(0.03, 0.075, 0.12, MAT.steel, 16); nozzle.rotation.z = Math.PI / 2; at(nozzle, -0.03, 0.8, 0, g);
  const heaterMat = glow(0xff5a1f, 1.6);
  for (let i = 0; i < 5; i++) {
    const hb = cyl(0.092, 0.092, 0.07, heaterMat, 24); hb.rotation.z = Math.PI / 2; at(hb, 0.13 + i * 0.13, 0.8, 0, g);
  }
  at(cyl(0.04, 0.04, 0.14, MAT.steel, 12), 0.76, 0.93, 0, g);
  at(cyl(0.19, 0.05, 0.34, MAT.brand, 24), 0.76, 1.17, 0, g);
  at(cyl(0.195, 0.195, 0.03, MAT.steel, 24), 0.76, 1.35, 0, g);
  at(box(0.3, 0.36, 0.38, MAT.dark, 0.04), 0.98, 0.72, 0, g);
  // IHM em pedestal
  at(box(0.05, 0.55, 0.05, MAT.dark), 0.25, 0.8, 0.5, g);
  at(box(0.36, 0.26, 0.04, MAT.darker, 0.015), 0.25, 1.12, 0.52, g);
  at(createScreen(data), 0.25, 1.12, 0.542, g);
  addStackLight(g, data, -1.0, 1.23, -0.28);

  const heatLight = new THREE.PointLight(0xff5a1f, 0, 2.2, 1.6);
  heatLight.position.set(0.45, 0.95, 0.3);
  g.add(heatLight);
  const phase = Math.random() * 6;
  let lt = 0;
  return {
    model: g,
    update(t, dt) {
      const critical = data.status !== 'offline' && data.temp >= data.params.tempLimit;
      lt += dt * pace(data);
      const c = (lt * 0.35 + phase) % 1;
      const open = c < 0.4 ? 0 : c < 0.55 ? (c - 0.4) / 0.15 : c < 0.8 ? 1 : 1 - (c - 0.8) / 0.2;
      platen.position.x = -0.48 - open * 0.28;
      if (critical) {
        const p = 0.5 + 0.5 * Math.sin(t * 5);
        heaterMat.emissiveIntensity = 2.4 + p * 2.4;
        heatLight.intensity = 2 + p * 3;
      } else {
        heaterMat.emissiveIntensity = data.status === 'offline' ? 0.15 : 1.6;
        heatLight.intensity = 0;
      }
    },
  };
}

// ─── Prensa hidráulica de 4 colunas ──────────────────────────────────────────

function buildPress(data) {
  const g = new THREE.Group();
  at(box(1.4, 0.3, 1.0, MAT.dark, 0.04), 0, 0.15, 0, g);
  at(box(1.02, 0.08, 0.72, MAT.steel, 0.01), 0, 0.34, 0, g);
  at(box(0.52, 0.06, 0.42, MAT.darker, 0.01), 0, 0.41, 0, g);
  for (const x of [-0.5, 0.5]) for (const z of [-0.33, 0.33]) at(cyl(0.055, 0.055, 1.42, MAT.steel, 20), x, 1.0, z, g);
  at(box(1.4, 0.36, 1.0, MAT.brand, 0.05), 0, 1.85, 0, g);
  at(box(1.42, 0.05, 1.02, MAT.darker), 0, 1.69, 0, g);
  at(cyl(0.2, 0.2, 0.34, MAT.steel, 28), 0, 2.2, 0, g);
  at(cyl(0.22, 0.22, 0.04, MAT.dark, 28), 0, 2.38, 0, g);
  at(cyl(0.12, 0.12, 0.4, MAT.steel, 24), 0, 1.47, 0, g);
  // Unidade hidráulica lateral
  at(box(0.34, 0.5, 0.44, MAT.dark, 0.03), 0.9, 0.25, 0, g);
  at(cyl(0.025, 0.025, 1.3, MAT.copper, 10), 0.78, 1.15, -0.3, g);
  // Martelo (slide) com faixa de segurança
  const ram = new THREE.Group(); ram.position.set(0, 1.2, 0); g.add(ram);
  at(box(1.0, 0.2, 0.72, MAT.white, 0.02), 0, 0, 0, ram);
  at(new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.1), stripeMat(4, 0.4)), 0, 0, 0.362, ram);
  for (const x of [-0.5, 0.5]) for (const z of [-0.33, 0.33]) at(cyl(0.085, 0.085, 0.22, MAT.dark, 20), x, 0, z, ram);
  at(cyl(0.08, 0.08, 0.75, MAT.steel, 20), 0, 0.475, 0, ram);
  at(box(0.48, 0.05, 0.38, MAT.darker), 0, -0.125, 0, ram);
  // Cortina de luz de segurança
  for (const x of [-0.64, 0.64]) {
    at(box(0.05, 1.1, 0.05, MAT.darker), x, 0.85, 0.52, g);
    at(box(0.012, 0.95, 0.012, glow(0xff3030, 2.2)), x * 0.955, 0.85, 0.52, g);
  }
  // IHM em braço
  at(box(0.04, 0.9, 0.04, MAT.dark), 0.95, 0.95, 0.35, g);
  at(box(0.36, 0.26, 0.04, MAT.darker, 0.015), 0.95, 1.3, 0.38, g);
  at(createScreen(data), 0.95, 1.3, 0.402, g);
  addStackLight(g, data, 0.55, 2.03, -0.35);

  const TOP = 1.2, BOTTOM = 0.56;
  const phase = Math.random();
  let lt = 0;
  return {
    model: g,
    update(t, dt) {
      lt += dt * pace(data);
      const p = (lt * 0.38 + phase) % 1;
      let y;
      if (p < 0.22) { const k = p / 0.22; y = TOP - (TOP - BOTTOM) * k * k; }
      else if (p < 0.32) y = BOTTOM;
      else { const k = (p - 0.32) / 0.68; y = BOTTOM + (TOP - BOTTOM) * (1 - Math.pow(1 - k, 2)); }
      ram.position.y = y;
    },
  };
}

// ─── Célula de solda robotizada (com faíscas) ────────────────────────────────

const SPARK_N = 160;
const sparkPos = new Float32Array(SPARK_N * 3).fill(-100);
const sparkVel = new Float32Array(SPARK_N * 3);
const sparkLife = new Float32Array(SPARK_N);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparkMat = new THREE.PointsMaterial({
  size: 0.045, map: TEX.radial, transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, toneMapped: false,
});
sparkMat.color.setRGB(4, 2.2, 0.7);
scene.add(new THREE.Points(sparkGeo, sparkMat));
const _tip = new THREE.Vector3();

function buildWelder(data) {
  const g = new THREE.Group();
  at(box(1.7, 0.04, 1.5, std(0x2a3038, 0.4, 0.8)), 0, 0.02, 0, g);
  at(box(0.9, 0.48, 0.62, MAT.dark, 0.03), 0.28, 0.28, 0, g);
  at(box(0.96, 0.04, 0.68, MAT.steel), 0.28, 0.54, 0, g);
  at(box(0.26, 0.02, 0.52, MAT.steel), 0.36, 0.57, 0, g);
  at(box(0.02, 0.12, 0.52, MAT.steel), 0.36, 0.64, 0, g);
  at(box(0.08, 0.06, 0.08, MAT.dark), 0.1, 0.6, -0.2, g);
  at(box(0.08, 0.06, 0.08, MAT.dark), 0.1, 0.6, 0.2, g);
  at(cyl(0.2, 0.23, 0.46, MAT.dark, 28), -0.45, 0.23, 0, g);
  const arm = buildArm(0x0f8f80, 0.62, 'torch');
  arm.root.position.set(-0.45, 0.46, 0);
  g.add(arm.root);
  arm.j2.rotation.z = -0.7;
  arm.j3.rotation.z = -0.2;
  // Cortinas de solda
  const curtain = new THREE.MeshStandardMaterial({
    color: 0xb4230f, transparent: true, opacity: 0.42, roughness: 0.6, side: THREE.DoubleSide, depthWrite: false,
  });
  at(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), curtain), 0, 0.64, -0.74, g);
  const side = at(new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.2), curtain), -0.84, 0.64, 0, g);
  side.rotation.y = Math.PI / 2;
  for (const [x, z] of [[-0.84, -0.74], [0.8, -0.74], [-0.84, 0.72]]) at(box(0.04, 1.3, 0.04, MAT.darker), x, 0.65, z, g);
  at(box(1.66, 0.04, 0.04, MAT.darker), -0.02, 1.28, -0.74, g);
  at(box(0.04, 0.04, 1.48, MAT.darker), -0.84, 1.28, -0.01, g);
  at(box(0.04, 1.0, 0.04, MAT.dark), 0.75, 0.5, 0.6, g);
  addStackLight(g, data, 0.75, 1.0, 0.6);

  const arcLight = new THREE.PointLight(0x9fd0ff, 0, 3.5, 1.4);
  g.add(arcLight);
  const arcGlow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), additive(0xcfe8ff, null, 1));
  arcGlow.material.color.setScalar(6);
  g.add(arcGlow);
  let lt = 0;
  return {
    model: g,
    update(t, dt) {
      const k = pace(data);
      const on = k > 0 && data.params.mode !== 'paused';
      lt += dt * k;
      t = lt;
      arm.j1.rotation.y = Math.sin(t * 0.55) * 0.28;
      arm.j2.rotation.z = -0.7 + Math.sin(t * 1.1) * 0.02;
      arm.wrist.rotation.x = Math.sin(t * 0.8) * 0.3;
      arm.tip.getWorldPosition(_tip);
      const arcOn = on && (t % 3.2) < 2.3;
      const local = g.worldToLocal(_tip.clone());
      arcLight.position.copy(local);
      arcGlow.position.copy(local);
      arcGlow.visible = arcOn;
      arcLight.intensity = arcOn ? 6 + Math.random() * 10 : 0;
      for (let i = 0; i < SPARK_N; i++) {
        const i3 = i * 3;
        sparkLife[i] -= dt;
        if (sparkLife[i] <= 0) {
          if (arcOn && Math.random() < 0.5) {
            sparkPos[i3] = _tip.x; sparkPos[i3 + 1] = _tip.y; sparkPos[i3 + 2] = _tip.z;
            sparkVel[i3] = (Math.random() - 0.5) * 2.2;
            sparkVel[i3 + 1] = 0.6 + Math.random() * 1.8;
            sparkVel[i3 + 2] = (Math.random() - 0.5) * 2.2;
            sparkLife[i] = 0.25 + Math.random() * 0.55;
          } else {
            sparkPos[i3 + 1] = -100;
          }
          continue;
        }
        sparkVel[i3 + 1] -= 7 * dt;
        sparkPos[i3] += sparkVel[i3] * dt;
        sparkPos[i3 + 1] += sparkVel[i3 + 1] * dt;
        sparkPos[i3 + 2] += sparkVel[i3 + 2] * dt;
        if (sparkPos[i3 + 1] < 0.03) { sparkPos[i3 + 1] = 0.03; sparkVel[i3 + 1] *= -0.3; sparkVel[i3] *= 0.6; sparkVel[i3 + 2] *= 0.6; }
      }
      sparkGeo.attributes.position.needsUpdate = true;
    },
  };
}

// ─── Montagem das máquinas + efeitos de status ───────────────────────────────

const builders = {
  cnc: buildCNC, robot: buildRobot, conveyor: buildConveyor, forklift: buildForklift,
  injector: buildInjector, press: buildPress, welder: buildWelder,
};

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function createLabel(data) {
  const div = document.createElement('div');
  const dot = document.createElement('span');
  Object.assign(dot.style, {
    display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
    marginRight: '6px', verticalAlign: 'middle', transition: 'background 0.3s, box-shadow 0.3s',
  });
  div.append(dot, document.createTextNode(data.name));
  Object.assign(div.style, {
    color: '#c9d1d9', fontSize: '11px', fontWeight: '500',
    fontFamily: "'Segoe UI', system-ui, sans-serif", textShadow: '0 1px 4px rgba(0,0,0,0.8)',
    background: 'rgba(8,12,18,0.62)', padding: '3px 9px', borderRadius: '5px',
    border: '1px solid rgba(88,166,255,0.18)', backdropFilter: 'blur(4px)',
    pointerEvents: 'none', whiteSpace: 'nowrap',
  });
  const obj = new CSS2DObject(div);
  obj.userData.dot = dot;
  return obj;
}

const machines = [];

MACHINES.forEach((data) => {
  const root = new THREE.Group();
  root.position.set(data.pos[0], data.pos[1], data.pos[2]);
  scene.add(root);

  const built = builders[data.type](data);
  const model = built.model;
  model.traverse((o) => {
    if (o.isMesh) {
      const transparent = o.material.transparent;
      o.castShadow = !transparent;
      o.receiveShadow = !transparent;
    }
  });
  root.add(model);
  root.updateMatrixWorld(true);

  const bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3()).sub(root.position);
  const r = Math.min(1.3, Math.max(size.x, size.z) * 0.5 + 0.12);

  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.045, 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  at(ring, 0, 0.012, 0, root);

  const halo = new THREE.Mesh(new THREE.PlaneGeometry(r * 3.2, r * 3.2), additive(0xffffff, TEX.radial, 0.28));
  halo.rotation.x = -Math.PI / 2;
  at(halo, 0, 0.008, 0, root);

  // Feixe holográfico: sempre criado, visível apenas em alerta/offline
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, 4.2, 48, 1, true), additive(0xffffff, TEX.vertical, 0.22));
  at(beam, 0, 2.1, 0, root);

  const label = createLabel(data);
  at(label, 0, bbox.max.y + 0.32, 0, root);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(size.x + 0.2, size.y + 0.1, size.z + 0.2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hit.userData.machineId = data.id;
  at(hit, center.x, center.y, center.z, root);

  machines.push({ data, root, model, update: built.update, ring, halo, beam, hit, label, moved: 0, shownStatus: null });
});

// Aplica cores de status (anel, halo, feixe, rótulo) quando o status muda.
function syncStatusVisuals(m) {
  if (m.shownStatus === m.data.status) return;
  m.shownStatus = m.data.status;
  const color = new THREE.Color(STATUS_COLOR[m.data.status]);
  m.ring.material.color.copy(color).multiplyScalar(2.2);
  m.halo.material.color.copy(color);
  m.beam.material.color.copy(color);
  m.beam.visible = m.data.status !== 'online';
  const c = hex(STATUS_COLOR[m.data.status]);
  m.label.userData.dot.style.background = c;
  m.label.userData.dot.style.boxShadow = `0 0 8px ${c}`;
  const s = screens.find((x) => x.data === m.data);
  if (s) drawScreen(s);
}
machines.forEach(syncStatusVisuals);

// ─── Trajetos das empilhadeiras (idênticos à v1) ─────────────────────────────

const forkliftPaths = {
  'FKL-001': { t: 0, speed: 0.002, points: [
    [-5, 0, 6], [-5, 0, 3], [-5, 0, 0], [-5, 0, -3], [-5, 0, 0], [-5, 0, 3], [-5, 0, 6],
  ]},
  'FKL-002': { t: 0, speed: 0.0025, points: [
    [3, 0, 6], [3, 0, 2], [3, 0, -2], [3, 0, 2], [3, 0, 6],
  ]},
  'FKL-003': { t: 0, speed: 0.0018, points: [
    [7, 0, 6], [7, 0, 4], [5, 0, 4], [3, 0, 4], [5, 0, 4], [7, 0, 4], [7, 0, 6],
  ]},
};
machines.forEach((m) => {
  const p = forkliftPaths[m.data.id];
  if (!p) return;
  const [a, b] = [p.points[0], p.points[1]];
  m.root.rotation.y = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
});

// ─── Seleção (raycaster) ─────────────────────────────────────────────────────

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selectedId = null;
const hitMeshes = machines.map((m) => m.hit);

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hitMeshes);
  return hits.length ? hits[0].object.userData.machineId : null;
}

renderer.domElement.addEventListener('click', (event) => {
  const id = pick(event);
  if (id && onPick) onPick(id);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  renderer.domElement.style.cursor = pick(event) ? 'pointer' : 'grab';
});

function select(id) {
  selectedId = id;
  const m = machines.find((x) => x.data.id === id);
  outlinePass.selectedObjects = m ? [m.model] : [];
  if (m) { lastInteraction = performance.now(); controls.autoRotate = false; }
}

// IHM das máquinas: histórico de uso atualizado a cada segundo
const screenTimer = setInterval(() => {
  screens.forEach((s) => {
    if (s.data.status !== 'offline') {
      s.hist.shift();
      s.hist.push(s.data.usage + (Math.random() - 0.5) * 6);
    }
    drawScreen(s);
  });
}, 1000);

// ─── Loop de animação ────────────────────────────────────────────────────────

const clock = new THREE.Clock();
const INTRO_S = 3.6;
let introDone = false;
let lastInteraction = performance.now();
controls.enabled = false;
controls.addEventListener('start', () => { lastInteraction = performance.now(); controls.autoRotate = false; });
renderer.domElement.addEventListener('pointerdown', () => {
  lastInteraction = performance.now();
  controls.autoRotate = false;
  if (!introDone) { introDone = true; controls.enabled = true; }
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!introDone) {
    const k = Math.min(1, t / INTRO_S);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(CAM_INTRO, CAM_HOME, e);
    if (k >= 1) { introDone = true; controls.enabled = true; }
  } else if (!selectedId && performance.now() - lastInteraction > 20000) {
    controls.autoRotate = true;
  }

  machines.forEach((m) => {
    syncStatusVisuals(m);
    const path = forkliftPaths[m.data.id];
    m.moved = 0;
    const k = pace(m.data);
    if (m.data.moving && path && k > 0) {
      path.t = (path.t + path.speed * k * dt * 60) % 1;
      const n = path.points.length - 1;
      const i0 = Math.min(Math.floor(path.t * n), n - 1);
      const frac = path.t * n - i0;
      const p0 = path.points[i0], p1 = path.points[i0 + 1];
      const x = p0[0] + (p1[0] - p0[0]) * frac;
      const z = p0[2] + (p1[2] - p0[2]) * frac;
      const dx = x - m.root.position.x, dz = z - m.root.position.z;
      m.moved = Math.hypot(dx, dz);
      if (m.moved > 1e-5) {
        let diff = Math.atan2(-dz, dx) - m.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        m.root.rotation.y += diff * Math.min(1, dt * 6);
      }
      m.root.position.x = x;
      m.root.position.z = z;
    }
    m.update(t, dt, m);

    const fast = m.data.status === 'alert' ? 3.2 : m.data.status === 'offline' ? 1.4 : 1.6;
    const p = 0.5 + 0.5 * Math.sin(t * fast + m.root.position.x);
    m.ring.scale.setScalar(1 + p * 0.05);
    m.halo.material.opacity = 0.16 + p * 0.2;
    if (m.beam.visible) m.beam.material.opacity = 0.12 + p * 0.14;
  });

  stackLights.forEach((s) => {
    const st = s.data.status;
    const idx = st === 'online' ? 0 : st === 'alert' ? 1 : 2;
    s.mats.forEach(({ m, c }, i) => {
      const active = i === idx;
      m.color.setHex(c).multiplyScalar(active ? 0.6 : 0.18);
      let I = active ? 4 : 0.05;
      if (active && st === 'alert') I = Math.sin(t * 6 + s.phase) > 0 ? 5 : 0.25;
      else if (active && st === 'offline') I = 2.5 + Math.sin(t * 2 + s.phase) * 1.5;
      m.emissiveIntensity = I;
    });
  });

  for (let i = 0; i < DUST_N; i++) {
    const i3 = i * 3;
    dustPos[i3 + 1] += dustSpeed[i] * dt;
    dustPos[i3] += Math.sin(t * 0.3 + i) * dt * 0.03;
    if (dustPos[i3 + 1] > 5) dustPos[i3 + 1] = 0;
  }
  dustGeo.attributes.position.needsUpdate = true;

  controls.update();
  composer.render();
  labelRenderer.render(scene, camera);
}

animate();
window.__factory = { camera, controls, scene };

// ─── Resize ──────────────────────────────────────────────────────────────────

function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
}
new ResizeObserver(onResize).observe(container);
window.addEventListener('resize', onResize);

return { select, dispose: () => clearInterval(screenTimer) };
}
