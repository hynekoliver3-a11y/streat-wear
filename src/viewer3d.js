// DRIPLAB 360° viewer — puts your 2D artwork onto real 3D product models.
// Bundled by scripts/build.mjs into viewer3d.bundle.js (classic script, works from file://).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import tshirtGlb from '../models/tshirt.glb';
import sneakerGlb from '../models/sneaker.glb';

const $ = (s) => document.querySelector(s);

// Where each 2D editor product's silhouette sits in the 600x700 editor space.
// The 3D model's bounding box (as seen from the front) is matched to this rect.
const FRAMES = {
  tee: [40, 560, 66, 650],
  hoodie: [22, 578, 40, 628],
  joggers: [132, 468, 60, 650],
  cap: [95, 525, 190, 465],
  sneaker: [58, 585, 285, 548],
  tote: [100, 500, 85, 652],
  custom: [0, 600, 0, 700],
};

const MODELS = {
  tee: {
    name: 'T-Shirt', data: tshirtGlb, print: 'tee', colorable: true,
    fabric: true,
    // projection: camera looks from +Z; editor "right" = +X
    views: { front: { dir: [0, 0, 1], right: [1, 0, 0] }, back: { dir: [0, 0, -1], right: [-1, 0, 0] } },
    upload: { view: 'front', x: 300, y: 250, size: 190 },
  },
  sneaker: {
    name: 'Sneaker', data: sneakerGlb, print: 'sneaker', colorable: false,
    variants: true,
    views: { front: { dir: [0, 0, 1], right: [1, 0, 0] }, back: { dir: [0, 0, -1], right: [-1, 0, 0] } },
    upload: { view: 'front', x: 330, y: 430, size: 110 },
  },
};

let renderer, scene, camera, controls, turntable, modelRoot, ground, keyLight;
let current = null;           // { key, def, root, meshes, frame, bbox, decals, variants }
let autoRotate = true;
let snapTarget = null;
let recording = false;
let lastT = 0;
let opened = false;
const loader = new GLTFLoader();

function api() { return window.DripLab; }

function initRenderer() {
  const canvas = $('#v3dCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = studioBackdrop();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
  camera.position.set(0, 0.05, 2.2);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.6;
  controls.maxDistance = 4;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2 + 0.15;
  controls.addEventListener('start', () => { snapTarget = null; });

  keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(1.2, 2.4, 1.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.radius = 6;
  keyLight.shadow.bias = -0.0005;
  const sc = keyLight.shadow.camera;
  sc.left = sc.bottom = -1; sc.right = sc.top = 1; sc.near = 0.1; sc.far = 8;
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.7);
  rim.position.set(-1.5, 1.2, -1.8);
  scene.add(rim);

  ground = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  turntable = new THREE.Group();
  scene.add(turntable);

  new ResizeObserver(resize).observe($('#v3dStage'));
  resize();
  renderer.setAnimationLoop(tick);
}

function studioBackdrop() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(512, 430, 40, 512, 512, 760);
  g.addColorStop(0, '#f3f3f1');
  g.addColorStop(0.55, '#d9d9d6');
  g.addColorStop(1, '#a9a9a6');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function resize() {
  const el = $('#v3dStage');
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (current) frameCamera();
}

function tick(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  if (!opened) return;
  if (!recording) {
    if (snapTarget !== null) {
      let d = snapTarget - turntable.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      turntable.rotation.y += d * Math.min(1, dt * 6);
      if (Math.abs(d) < 0.002) { turntable.rotation.y = snapTarget; snapTarget = null; }
    } else if (autoRotate) {
      turntable.rotation.y += dt * 0.55;
    }
  }
  controls.update();
  renderer.render(scene, camera);
}

/* ---------------- model loading ---------------- */
function parseGlb(bytes) {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((res, rej) => loader.parse(buf, '', res, rej));
}

async function readVariants(gltf) {
  const ext = gltf.parser.json.extensions && gltf.parser.json.extensions.KHR_materials_variants;
  if (!ext) return null;
  const names = ext.variants.map((v) => v.name);
  const perMesh = [];
  const jobs = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const a = gltf.parser.associations.get(o);
    if (!a || a.meshes === undefined) return;
    const prim = gltf.parser.json.meshes[a.meshes].primitives[a.primitives || 0];
    const maps = prim.extensions && prim.extensions.KHR_materials_variants && prim.extensions.KHR_materials_variants.mappings;
    if (!maps) return;
    const entry = { mesh: o, byVariant: {} };
    perMesh.push(entry);
    for (const m of maps) {
      jobs.push(gltf.parser.getDependency('material', m.material).then((mat) => {
        for (const vi of m.variants) entry.byVariant[vi] = mat;
      }));
    }
  });
  await Promise.all(jobs);
  return { names, perMesh };
}

function normalize(root, targetHeight) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const k = targetHeight / Math.max(size.y, size.x * 0.75, 1e-6);
  root.scale.multiplyScalar(k);
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  const c = b2.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= b2.min.y;
  root.updateMatrixWorld(true);
}

async function loadModel(key, bytes, def) {
  setStatus('Loading 3D model…');
  const gltf = await parseGlb(bytes);
  const root = gltf.scene;
  const isShoe = key === 'sneaker';
  normalize(root, isShoe ? 0.5 : 0.9);
  if (!isShoe) root.position.y += 0.08; // float the garment like a ghost mannequin
  root.updateMatrixWorld(true);

  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    meshes.push(o);
  });

  const garment = api() ? api().garment : '#f4f3ef';
  if (def.fabric) {
    for (const m of meshes) {
      const old = m.material;
      m.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(garment),
        normalMap: old.normalMap || null,
        normalScale: new THREE.Vector2(0.9, 0.9),
        aoMap: old.aoMap || null,
        aoMapIntensity: 0.6,
        roughness: 0.92,
        metalness: 0,
        sheen: 1,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color(0x3a3a3a),
        side: THREE.DoubleSide,
      });
      old.dispose();
    }
  } else if (def.colorable) {
    for (const m of meshes) {
      m.material = m.material.clone();
      m.material.color = new THREE.Color(garment);
      m.material.side = THREE.DoubleSide;
    }
  }

  const variants = def.variants ? await readVariants(gltf) : null;

  if (current) {
    turntable.remove(current.root);
    disposeDecals();
  }
  turntable.add(root);
  root.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(root);
  current = { key, def, root, meshes, bbox, decals: [], variants };
  frameCamera();
  buildVariantUI();
  await refreshArt();
  setStatus('');
}

function frameCamera() {
  const size = current.bbox.getSize(new THREE.Vector3());
  const center = current.bbox.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.5;
  const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
  const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
  const wide = Math.max(size.x, size.z) / 2;
  // fit height and width (turntable spins, so use the widest footprint) plus room for the controls
  const dist = Math.max((size.y / 2) / Math.tan(halfV) * 1.18, wide / Math.tan(halfH) * 1.12) + wide;
  center.y -= size.y * 0.06;
  controls.target.copy(center);
  camera.position.set(center.x, center.y + r * 0.15, center.z + dist);
  controls.minDistance = dist * 0.35;
  controls.maxDistance = dist * 2.2;
  controls.update();
  const s = Math.max(size.x, size.z) * 1.5;
  keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -s;
  keyLight.shadow.camera.right = keyLight.shadow.camera.top = s;
  keyLight.shadow.camera.updateProjectionMatrix();
}

/* ---------------- artwork → decals ---------------- */
function disposeDecals() {
  if (!current) return;
  for (const d of current.decals) {
    d.parent && d.parent.remove(d);
    d.geometry.dispose();
    if (d.material.map) d.material.map.dispose();
    d.material.dispose();
  }
  current.decals = [];
}

function isEmpty(canvas) {
  const s = document.createElement('canvas');
  s.width = 64; s.height = 74;
  const x = s.getContext('2d');
  x.drawImage(canvas, 0, 0, 64, 74);
  const d = x.getImageData(0, 0, 64, 74).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 2) return false;
  return true;
}

let fabricNormal = null;
function decalMaterial(tex) {
  const fab = current.def.fabric && current.meshes[0].material.normalMap;
  if (fab && !fabricNormal) {
    fabricNormal = fab.clone();
    fabricNormal.wrapS = fabricNormal.wrapT = THREE.RepeatWrapping;
    fabricNormal.repeat.set(2.2, 2.2);
    fabricNormal.needsUpdate = true;
  }
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    roughness: fab ? 0.8 : 0.6,
    metalness: 0,
    normalMap: fab ? fabricNormal : null,
    normalScale: new THREE.Vector2(0.6, 0.6),
    sheen: fab ? 0.6 : 0,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0x555555),
  });
}

// Project the 600x700 editor canvas onto the model, from one side.
function projectView(viewKey, canvas, frame) {
  const v = current.def.views[viewKey];
  if (!v) return;
  const dir = new THREE.Vector3(...v.dir).normalize();
  const right = new THREE.Vector3(...v.right).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize(); // dir × right = up for right-handed basis
  if (up.y < 0) up.negate();

  // extents of the model along right / up / dir
  const b = current.bbox;
  const corners = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const ext = (axis) => { const vals = corners.map((c) => c.dot(axis)); return [Math.min(...vals), Math.max(...vals)]; };
  const [r0, r1] = ext(right), [u0, u1] = ext(up), [d0, d1] = ext(dir);

  const [fx0, fx1, fy0, fy1] = frame;
  const kx = (r1 - r0) / (fx1 - fx0);
  const ky = (u1 - u0) / (fy1 - fy0);
  const rc = r0 + (300 - fx0) * kx;
  const uc = u1 - (350 - fy0) * ky;
  const depth = (d1 - d0) * 0.7;
  const dc = d1 - depth / 2 + (d1 - d0) * 0.02;

  const pos = right.clone().multiplyScalar(rc).add(up.clone().multiplyScalar(uc)).add(dir.clone().multiplyScalar(dc));
  const basis = new THREE.Matrix4().makeBasis(right, up, dir);
  const orient = new THREE.Euler().setFromRotationMatrix(basis);
  const size = new THREE.Vector3(600 * kx, 700 * ky, depth);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  // decal geometry is built in world space; turntable must be at rest while we build it
  const savedRot = turntable.rotation.y;
  turntable.rotation.y = 0;
  turntable.updateMatrixWorld(true);
  const mat = decalMaterial(tex);
  let first = true;
  for (const m of current.meshes) {
    const g = keepFacing(new DecalGeometry(m, pos, orient, size), dir);
    if (!g) continue;
    // bring world-space geometry back into turntable space so it rotates with the model
    const dm = new THREE.Mesh(g, first ? mat : mat.clone());
    first = false;
    dm.renderOrder = 2;
    dm.receiveShadow = true;
    turntable.add(dm);
    current.decals.push(dm);
  }
  turntable.rotation.y = savedRot;
  turntable.updateMatrixWorld(true);
}

// Drop decal triangles that face away from the projection (stops prints bleeding round the sides).
function keepFacing(g, dir) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  if (!p || !p.count) { g.dispose(); return null; }
  const keep = [];
  for (let i = 0; i < p.count; i += 3) {
    let d = 0;
    for (let k = 0; k < 3; k++) d += n.getX(i + k) * dir.x + n.getY(i + k) * dir.y + n.getZ(i + k) * dir.z;
    if (d / 3 > -0.05) keep.push(i);
  }
  if (!keep.length) { g.dispose(); return null; }
  const out = new THREE.BufferGeometry();
  const copy = (attr) => {
    const arr = new Float32Array(keep.length * 3 * attr.itemSize);
    let o = 0;
    for (const i of keep) for (let k = 0; k < 3; k++) for (let c = 0; c < attr.itemSize; c++) arr[o++] = attr.array[(i + k) * attr.itemSize + c];
    return new THREE.BufferAttribute(arr, attr.itemSize);
  };
  out.setAttribute('position', copy(p));
  out.setAttribute('normal', copy(n));
  out.setAttribute('uv', copy(uv));
  g.dispose();
  return out;
}

async function refreshArt() {
  if (!current) return;
  disposeDecals();
  const A = api();
  if (!A) return;
  const printKey = current.def.print || A.productId;
  const frame = FRAMES[printKey] || FRAMES[A.productId] || FRAMES.custom;
  let any = false;
  for (const view of Object.keys(current.def.views)) {
    const c = A.getPrint(printKey, view);
    if (isEmpty(c)) continue;
    any = true;
    projectView(view, c, frame);
  }
  $('#v3dEmpty').hidden = any;
  if (current.def.colorable) {
    for (const m of current.meshes) m.material.color.set(A.garment);
  }
}

/* ---------------- variants (sneaker colorways) ---------------- */
function buildVariantUI() {
  const box = $('#v3dColors');
  box.innerHTML = '';
  if (current.variants) {
    current.variants.names.forEach((n, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (i === 0 ? ' active' : '');
      b.textContent = n;
      b.addEventListener('click', () => {
        for (const e of current.variants.perMesh) if (e.byVariant[i]) e.mesh.material = e.byVariant[i];
        [...box.children].forEach((c) => c.classList.toggle('active', c === b));
      });
      box.appendChild(b);
    });
    for (const e of current.variants.perMesh) if (e.byVariant[0]) e.mesh.material = e.byVariant[0];
    box.hidden = false;
  } else if (current.def.colorable && api()) {
    api().garmentColors.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (c === api().garment ? ' active' : '');
      b.style.background = c;
      b.title = c;
      b.addEventListener('click', () => {
        api().setGarment(c);
        for (const m of current.meshes) m.material.color.set(c);
        [...box.children].forEach((x) => x.classList.toggle('active', x === b));
      });
      box.appendChild(b);
    });
    box.hidden = false;
  } else box.hidden = true;
}

/* ---------------- UI ---------------- */
function setStatus(t) {
  const s = $('#v3dStatus');
  s.textContent = t;
  s.hidden = !t;
}

function setProductButtons(key) {
  document.querySelectorAll('#v3dProducts [data-model]').forEach((b) => b.classList.toggle('active', b.dataset.model === key));
}

async function selectModel(key) {
  const def = MODELS[key];
  if (!def) return;
  setProductButtons(key);
  try { await loadModel(key, def.data, def); }
  catch (e) { console.error(e); setStatus('Could not load the 3D model'); }
}

async function loadCustomGlb(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const A = api();
  const def = {
    name: file.name, print: A ? A.productId : 'custom', colorable: true, fabric: false,
    views: { front: { dir: [0, 0, 1], right: [1, 0, 0] }, back: { dir: [0, 0, -1], right: [-1, 0, 0] } },
    upload: { view: 'front', x: 300, y: 260, size: 180 },
  };
  setProductButtons('glb');
  try { await loadModel('glb', buf, def); }
  catch (e) { console.error(e); setStatus('That file is not a valid .glb model'); }
}

function snap(angle) {
  autoRotate = false;
  $('#v3dSpin').classList.remove('active');
  snapTarget = angle;
  frameCamera();
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function fileBase() {
  const n = (document.querySelector('#designName')?.value || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
  return `${n}-${current ? current.key : '3d'}`;
}

function screenshot() {
  renderer.render(scene, camera);
  renderer.domElement.toBlob((b) => download(b, fileBase() + '-3d.png'), 'image/png');
}

async function record360() {
  if (recording || !current) return;
  const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const type = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!type) { setStatus('Video recording is not supported in this browser'); setTimeout(() => setStatus(''), 2500); return; }
  recording = true;
  const btn = $('#v3dRecord');
  btn.disabled = true;
  frameCamera();
  const stream = renderer.domElement.captureStream(60);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => { rec.onstop = r; });
  const start = performance.now();
  const DUR = 6000;
  const startRot = 0;
  turntable.rotation.y = startRot;
  rec.start();
  await new Promise((resolve) => {
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / DUR);
      turntable.rotation.y = startRot + p * Math.PI * 2;
      btn.textContent = `Recording ${Math.round(p * 100)}%`;
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  rec.stop();
  await done;
  recording = false;
  btn.disabled = false;
  btn.textContent = 'Record 360° video';
  download(new Blob(chunks, { type }), fileBase() + '-360.' + (type.startsWith('video/mp4') ? 'mp4' : 'webm'));
}

async function uploadDrawing(file) {
  if (!current || !api()) return;
  const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const u = current.def.upload;
  await api().placeImage(current.def.print || api().productId, u.view, src, u.x, u.y, u.size);
  await refreshArt();
  snap(u.view === 'back' ? Math.PI : 0);
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  document.querySelectorAll('#v3dProducts [data-model]').forEach((b) => {
    if (b.dataset.model === 'glb') b.addEventListener('click', () => $('#v3dGlbFile').click());
    else b.addEventListener('click', () => selectModel(b.dataset.model));
  });
  $('#v3dGlbFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) loadCustomGlb(f); });
  $('#v3dDrawFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) uploadDrawing(f); });
  $('#v3dUpload').addEventListener('click', () => $('#v3dDrawFile').click());
  $('#v3dSpin').addEventListener('click', (e) => { autoRotate = !autoRotate; snapTarget = null; e.currentTarget.classList.toggle('active', autoRotate); });
  document.querySelectorAll('#v3dAngles [data-angle]').forEach((b) => b.addEventListener('click', () => snap(+b.dataset.angle * Math.PI / 180)));
  $('#v3dShot').addEventListener('click', screenshot);
  $('#v3dRecord').addEventListener('click', record360);
  $('#v3dClose').addEventListener('click', close);
  const stage = $('#v3dStage');
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dropping'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    stage.classList.remove('dropping');
    const f = [...e.dataTransfer.files][0];
    if (!f) return;
    if (/\.glb$/i.test(f.name)) loadCustomGlb(f);
    else if (f.type.startsWith('image/')) uploadDrawing(f);
  });
  document.addEventListener('keydown', (e) => { if (opened && e.key === 'Escape') close(); });
}

async function open(preferred) {
  $('#v3d').hidden = false;
  document.body.classList.add('v3d-open');
  opened = true;
  wire();
  if (!renderer) initRenderer();
  resize();
  autoRotate = true;
  $('#v3dSpin').classList.add('active');
  const key = MODELS[preferred] ? preferred : (current ? current.key : 'tee');
  if (!current || current.key !== key) await selectModel(key);
  else await refreshArt();
  const note = $('#v3dNote');
  const pid = api() ? api().productId : 'tee';
  if (!MODELS[pid] && pid !== 'custom') {
    note.textContent = `No 3D model for ${api().productName} yet — showing your front/back artwork on the T-shirt. Load a .glb of the real item to see it on that.`;
    note.hidden = false;
  } else note.hidden = true;
}

function close() {
  opened = false;
  $('#v3d').hidden = true;
  document.body.classList.remove('v3d-open');
}

window.Viewer3D = { open, close, refresh: refreshArt, models: Object.keys(MODELS) };
