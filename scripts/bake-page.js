// Renders the real 3D models orthographically into the 600x700 editor space so the
// 2D editor shows the same garment as the 360° view. Run via scripts/bake-2d.cjs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import tshirt from '../models/tshirt.glb';
import sneaker from '../models/sneaker.glb';

const S = 2, W = 600, H = 700;
const JOBS = {
  tee: { data: tshirt, frame: [40, 560, 66, 650], base: false },
  sneaker: { data: sneaker, frame: [58, 585, 285, 548], base: true },
};
const VIEWS = { front: { dir: [0, 0, 1], right: [1, 0, 0] }, back: { dir: [0, 0, -1], right: [-1, 0, 0] } };

const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true, alpha: true });
renderer.setPixelRatio(1);
renderer.setSize(W * S, H * S);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

async function load(data) {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const g = await new Promise((r, j) => new GLTFLoader().parse(buf, '', r, j));
  g.scene.updateMatrixWorld(true);
  return g.scene;
}

function camFor(root, frame, v) {
  const b = new THREE.Box3().setFromObject(root);
  const dir = new THREE.Vector3(...v.dir), right = new THREE.Vector3(...v.right);
  const up = new THREE.Vector3(0, 1, 0);
  const pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
  const ext = (a) => { const s = pts.map((p) => p.dot(a)); return [Math.min(...s), Math.max(...s)]; };
  const [r0, r1] = ext(right), [u0, u1] = ext(up);
  const [fx0, fx1, fy0, fy1] = frame;
  const kx = (r1 - r0) / (fx1 - fx0), ky = (u1 - u0) / (fy1 - fy0);
  const left = r0 - fx0 * kx, top = u1 + fy0 * ky;
  const cam = new THREE.OrthographicCamera(left, left + W * kx, top, top - H * ky, -20, 20);
  cam.position.copy(dir.clone().multiplyScalar(5));
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  // make the camera's screen-right match the editor's right axis
  cam.updateMatrixWorld(true);
  return cam;
}

function sceneWith(root, mode, v) {
  const dz = v ? v.dir[2] : 1;
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = mode === 'mask' ? 0 : 0.9;
  const key = new THREE.DirectionalLight(0xffffff, mode === 'mask' ? 0 : 1.2);
  key.position.set(1.2 * dz, 2.4, 3 * dz);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, mode === 'mask' ? 0 : 0.5);
  fill.position.set(-1.2 * dz, 1, -3 * dz);
  scene.add(fill);
  const r = root.clone(true);
  r.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (mode === 'mask') o.material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    else if (mode === 'shade') o.material = new THREE.MeshStandardMaterial({ color: 0xffffff, normalMap: m.normalMap, aoMap: m.aoMap, aoMapIntensity: 0.5, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    else { o.material = m.clone(); o.material.side = THREE.DoubleSide; }
  });
  scene.add(r);
  return scene;
}

function grab() {
  const c = document.createElement('canvas');
  c.width = W * S; c.height = H * S;
  c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  return c;
}

window.bake = async () => {
  const out = {};
  for (const [id, job] of Object.entries(JOBS)) {
    const root = await load(job.data);
    out[id] = {};
    for (const [vk, v] of Object.entries(VIEWS)) {
      const cam = camFor(root, job.frame, v);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.render(sceneWith(root, 'mask', v), cam);
      const mask = grab();
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.render(sceneWith(root, 'shade', v), cam);
      const shade = grab();
      // normalise shading so flat lit fabric is pure white (multiply keeps colours true)
      const mx = mask.getContext('2d').getImageData(0, 0, W * S, H * S).data;
      const sx = shade.getContext('2d');
      const sd = sx.getImageData(0, 0, W * S, H * S);
      const lum = [];
      for (let i = 0; i < mx.length; i += 4) if (mx[i + 3] > 200) lum.push(sd.data[i]);
      lum.sort((a, b) => a - b);
      const p = lum[Math.floor(lum.length * 0.8)] || 255;
      for (let i = 0; i < sd.data.length; i += 4) {
        const g = mx[i + 3] > 10 ? Math.min(255, Math.round((sd.data[i] * 255) / p)) : 255;
        sd.data[i] = sd.data[i + 1] = sd.data[i + 2] = g;
        sd.data[i + 3] = 255;
      }
      sx.putImageData(sd, 0, 0);
      const view = { mask: mask.toDataURL('image/png'), shade: shade.toDataURL('image/jpeg', 0.86) };
      if (job.base) {
        renderer.setClearColor(0xffffff, 1);
        renderer.render(sceneWith(root, 'color', v), cam);
        // brighten: base gets multiplied by shade again in the editor
        const bc = grab();
        view.base = bc.toDataURL('image/jpeg', 0.88);
      }
      out[id][vk] = view;
    }
  }
  return out;
};
