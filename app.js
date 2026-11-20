'use strict';

/* ============================================================
   DRIPLAB — streetwear designer
   Logical space is 600x700; every canvas is rendered at 2x.
   ============================================================ */

const W = 600, H = 700, S = 2, WS = W * S, HS = H * S;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// Standard blank colors, named the way blank suppliers name them.
const GARMENT_LIST = [
  ['#f4f3ef', 'White'], ['#161616', 'Black'], ['#9a9a9e', 'Heather grey'], ['#d9d8d3', 'Ash'],
  ['#1e2a44', 'Navy'], ['#2546b8', 'Royal'], ['#2f4a35', 'Forest'], ['#5b5b3a', 'Military green'],
  ['#5c1f2b', 'Maroon'], ['#c4262e', 'Red'], ['#d8c7a8', 'Sand'], ['#5a4232', 'Brown'],
  ['#f2b8c6', 'Light pink'], ['#b9a7e8', 'Lavender'],
];
const GARMENT_COLORS = GARMENT_LIST.map((g) => g[0]);
const garmentName = (c) => (GARMENT_LIST.find((g) => g[0] === c) || [c, 'Custom'])[1];
const PAINT_COLORS = ['#111111', '#ffffff', '#ff4f12', '#e0262f', '#ffc21a', '#2bb673', '#1f6fff', '#6b4cff', '#ff5fa2', '#8a8a86', '#d8c7a8', '#5a4232'];
const EMOJI_FONTS = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"';
const LS_DESIGNS = 'driplab.designs.v1';
const LS_DRAFT = 'driplab.draft.v1';

const HINTS = {
  select: 'Move — drag to place, corners to scale, top handle to rotate (Shift snaps 15°).',
  brush: 'Brush — draw on the product. [ and ] change size. M toggles mirror.',
  spray: 'Spray — hold and drag for a spray-paint effect.',
  eraser: 'Eraser — removes painted artwork (not text or images; select and delete those).',
  fill: 'Fill — fills an enclosed area of the product, pocket or seam region.',
  line: 'Line — drag. Shift snaps to 45°.',
  rect: 'Rectangle — drag. Shift for a square. Toggle "Filled shapes" in Paint.',
  ellipse: 'Ellipse — drag. Shift for a circle.',
  text: 'Text — click on the product to place text, or pick a style under Add text.',
  area: 'Print area — drag inside to move it, drag a corner to resize (Shift keeps the shape). Press Done when finished.',
  picker: 'Picker — click anywhere to grab a color.',
};

/* ---------------- canvases ---------------- */
const cv = $('#canvas');
cv.width = WS; cv.height = HS;
const ctx = cv.getContext('2d');

function makeCanvas(scaled = true) {
  const c = document.createElement('canvas');
  c.width = WS; c.height = HS;
  const x = c.getContext('2d', { willReadFrequently: false });
  if (scaled) x.setTransform(S, 0, 0, S, 0, 0);
  return c;
}
const maskCv = makeCanvas(false);
const tmpCv = makeCanvas(false);
const strokeCv = makeCanvas();
const scratchCv = makeCanvas(false);
const measureCtx = document.createElement('canvas').getContext('2d');

function clearCanvas(c) {
  const x = c.getContext('2d');
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, c.width, c.height); x.restore();
}

/* ---------------- state ---------------- */
const state = {
  productId: 'tee',
  garment: '#f4f3ef',
  view: 'front',
  layers: {},          // viewKey -> { art, actx, objects, undo, redo }
  custom: null,        // { src, canvas, fit }
  tool: 'brush',
  color: '#111111',
  size: 14,
  opacity: 1,
  fillShapes: false,
  clip: true,
  guides: true,
  areaOverrides: {},    // productId -> view -> [x, y, w, h] in editor units
  areaClip: false,      // print only inside the print area
  mirror: false,
  selectedId: null,
  designId: null,
  hover: null,
};
let nextId = 1;
let drag = null;       // active pointer interaction
let dirty = false;

/* ---------------- geometry ---------------- */
const geomCache = new Map();
function product() {
  if (state.productId === 'custom') return { id: 'custom', name: 'Your own', views: [{ key: 'front', label: 'Front' }, { key: 'back', label: 'Back' }] };
  return PRODUCTS.find((p) => p.id === state.productId) || PRODUCTS[0];
}
function viewDef() {
  const p = product();
  return p.views.find((v) => v.key === state.view) || p.views[0];
}
function geom() {
  if (state.productId === 'custom') return null;
  const key = state.productId + ':' + state.view;
  if (geomCache.has(key)) return geomCache.get(key);
  const v = viewDef();
  const bk = bakedView();
  if (bk) {
    const g = { shape: new Path2D(bk.shape), details: [], baked: bk };
    geomCache.set(key, g);
    return g;
  }
  const m = v.mirror ? new DOMMatrix([-1, 0, 0, 1, W, 0]) : new DOMMatrix();
  const xf = (d) => { const p = new Path2D(); p.addPath(new Path2D(d), m); return p; };
  const shape = new Path2D();
  v.shape.forEach((d) => shape.addPath(new Path2D(d), m));
  const g = { shape, details: v.details.map((d) => ({ ...d, path: xf(d.d) })) };
  geomCache.set(key, g);
  return g;
}

// Real 3D models rendered into editor space (products-baked.js): silhouette, fabric shading, base colors.
const bakedImages = {};
function bakedView(pid = state.productId, view = state.view) {
  const b = typeof BAKED !== 'undefined' && BAKED[pid] && BAKED[pid][view];
  if (!b) return null;
  const k = pid + ':' + view;
  if (!bakedImages[k]) {
    const mk = (src) => { if (!src) return null; const i = new Image(); i.onload = render; i.src = src; return i; };
    bakedImages[k] = { shape: b.shape, shade: mk(b.shade), base: mk(b.base) };
  }
  return bakedImages[k];
}
const ready = (img) => img && img.complete && img.naturalWidth;
const shadeCv = makeCanvas(false);

function layer(key = state.view) {
  if (!state.layers[key]) {
    const art = makeCanvas();
    state.layers[key] = { art, actx: art.getContext('2d'), objects: [], undo: [], redo: [] };
  }
  return state.layers[key];
}
function selected() {
  return layer().objects.find((o) => o.id === state.selectedId) || null;
}

function buildMask() {
  const m = maskCv.getContext('2d');
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.clearRect(0, 0, WS, HS);
  m.setTransform(S, 0, 0, S, 0, 0);
  if (state.productId === 'custom') {
    if (state.custom) { const f = state.custom.fit; m.drawImage(state.custom.canvas, f.x, f.y, f.w, f.h); }
    else m.fillRect(0, 0, W, H);
  } else {
    m.fillStyle = '#fff';
    m.fill(geom().shape);
  }
}

/* ---------------- objects (text / images) ---------------- */
function fontString(o) {
  return `${o.size}px "${o.font}", ${EMOJI_FONTS}, sans-serif`;
}
function textWidth(c, o) {
  const sp = o.spacing || 0;
  if (!sp) return c.measureText(o.text).width;
  return [...o.text].reduce((a, ch) => a + c.measureText(ch).width + sp, -sp);
}
function objSize(o) {
  if (o.type === 'image') return { w: o.w, h: o.h };
  measureCtx.font = fontString(o);
  const tw = Math.max(textWidth(measureCtx, o), o.size * 0.3);
  const th = o.size * 1.2;
  const A = Math.abs(o.arc || 0) * Math.PI / 180;
  if (A < 0.02) return { w: tw + 8, h: th };
  const r = tw / A;
  const sag = r * (1 - Math.cos(Math.min(A, Math.PI) / 2));
  const chord = A >= Math.PI ? 2 * r : 2 * r * Math.sin(A / 2);
  return { w: chord + o.size * 0.6, h: th + sag + (A > Math.PI ? r * 0.5 : 0) };
}

function drawTextLine(c, o, mode) {
  const sp = o.spacing || 0;
  const A = (o.arc || 0) * Math.PI / 180;
  const draw = (t, x, y) => (mode === 'stroke' ? c.strokeText(t, x, y) : c.fillText(t, x, y));
  if (Math.abs(A) < 0.02) {
    if (!sp) { draw(o.text, 0, 0); return; }
    const total = textWidth(c, o);
    let x = -total / 2;
    c.textAlign = 'left';
    for (const ch of o.text) { draw(ch, x, 0); x += c.measureText(ch).width + sp; }
    c.textAlign = 'center';
    return;
  }
  const total = Math.max(textWidth(c, o), 1);
  const absA = Math.abs(A);
  const r = total / absA;
  const sag = r * (1 - Math.cos(Math.min(absA, Math.PI) / 2));
  const up = A > 0;
  const cy = up ? r - sag / 2 : -(r - sag / 2);
  let off = 0;
  for (const ch of o.text) {
    const cw = c.measureText(ch).width;
    const phi = -absA / 2 + ((off + cw / 2) / total) * absA;
    c.save();
    if (up) { c.translate(r * Math.sin(phi), cy - r * Math.cos(phi)); c.rotate(phi); }
    else { c.translate(r * Math.sin(phi), cy + r * Math.cos(phi)); c.rotate(-phi); }
    draw(ch, 0, 0);
    c.restore();
    off += cw + sp;
  }
}

function drawObject(c, o) {
  c.save();
  c.translate(o.x, o.y);
  c.rotate(o.rot);
  c.scale(o.scale * (o.flip ? -1 : 1), o.scale);
  c.globalAlpha = o.opacity ?? 1;
  if (o.type === 'image') {
    if (o.img && o.img.complete && o.img.naturalWidth) c.drawImage(o.img, -o.w / 2, -o.h / 2, o.w, o.h);
  } else {
    c.font = fontString(o);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (o.strokeW > 0) {
      c.lineJoin = 'round';
      c.lineWidth = o.strokeW * 2;
      c.strokeStyle = o.stroke;
      drawTextLine(c, o, 'stroke');
    }
    c.fillStyle = o.color;
    drawTextLine(c, o, 'fill');
  }
  c.restore();
}

function toLocal(o, p) {
  const dx = p.x - o.x, dy = p.y - o.y;
  const cs = Math.cos(-o.rot), sn = Math.sin(-o.rot);
  return { x: dx * cs - dy * sn, y: dx * sn + dy * cs };
}
function halfExtents(o) {
  const s = objSize(o);
  return { hw: (s.w * o.scale) / 2, hh: (s.h * o.scale) / 2 };
}
function uiUnit() {
  const r = cv.getBoundingClientRect();
  return r.width ? W / r.width : 1;
}
function hitHandle(o, p) {
  const u = uiUnit();
  const l = toLocal(o, p);
  const { hw, hh } = halfExtents(o);
  const tol = 12 * u;
  if (Math.hypot(l.x, l.y - (-hh - 30 * u)) < tol + 2 * u) return 'rotate';
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    if (Math.abs(l.x - sx * hw) < tol && Math.abs(l.y - sy * hh) < tol) return 'scale';
  }
  return null;
}
function hitObject(p) {
  const objs = layer().objects;
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    const l = toLocal(o, p);
    const { hw, hh } = halfExtents(o);
    if (Math.abs(l.x) <= hw && Math.abs(l.y) <= hh) return o;
  }
  return null;
}

/* ---------------- rendering ---------------- */
function composeArt(includeLive = true) {
  const L = layer();
  const t = tmpCv.getContext('2d');
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-over';
  t.globalAlpha = 1;
  t.clearRect(0, 0, WS, HS);
  t.drawImage(L.art, 0, 0);
  if (includeLive && drag && drag.live) {
    t.globalAlpha = state.opacity;
    t.drawImage(strokeCv, 0, 0);
    t.globalAlpha = 1;
  }
  t.setTransform(S, 0, 0, S, 0, 0);
  for (const o of L.objects) drawObject(t, o);
  t.setTransform(1, 0, 0, 1, 0, 0);
  if (state.clip) {
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(maskCv, 0, 0);
    t.globalCompositeOperation = 'source-over';
  }
  const pa = state.areaClip ? printArea() : null;
  if (pa) {
    t.globalCompositeOperation = 'destination-in';
    t.fillStyle = '#000';
    t.fillRect(pa.x * S, pa.y * S, pa.w * S, pa.h * S);
    t.globalCompositeOperation = 'source-over';
  }
  return tmpCv;
}

function drawScene(c, ui, flat = false) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, WS, HS);
  c.setTransform(S, 0, 0, S, 0, 0);
  const g = geom();

  // base garment
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)';
  c.shadowBlur = 40;
  c.shadowOffsetY = 18;
  if (g && g.baked && g.baked.base && !flat) {
    c.fillStyle = '#fff';
    c.fill(g.shape);
    c.shadowColor = 'transparent';
    c.clip(g.shape);
    if (ready(g.baked.base)) c.drawImage(g.baked.base, 0, 0, W, H);
  } else if (g) {
    c.fillStyle = state.garment;
    c.fill(g.shape);
    if (g.baked && !flat && ready(g.baked.shade)) {
      c.shadowColor = 'transparent';
      c.clip(g.shape);
      c.globalCompositeOperation = 'multiply';
      c.drawImage(g.baked.shade, 0, 0, W, H);
    }
  } else if (state.custom) {
    const f = state.custom.fit;
    c.drawImage(state.custom.canvas, f.x, f.y, f.w, f.h);
  }
  c.restore();

  // artwork (on real garments it picks up the fabric's folds and shadows)
  let art = composeArt();
  if (g && g.baked && !flat && ready(g.baked.shade)) {
    const s = shadeCv.getContext('2d');
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, WS, HS);
    s.drawImage(art, 0, 0);
    s.globalCompositeOperation = 'multiply';
    s.drawImage(g.baked.shade, 0, 0, WS, HS);
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(art, 0, 0);
    s.globalCompositeOperation = 'source-over';
    art = shadeCv;
  }
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(art, 0, 0);
  c.restore();

  if (g && !g.baked) {
    // fabric shading
    c.save();
    c.clip(g.shape);
    const lg = c.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0.16)');
    lg.addColorStop(0.22, 'rgba(0,0,0,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    lg.addColorStop(0.78, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.16)');
    c.fillStyle = lg;
    c.fillRect(0, 0, W, H);
    const vg = c.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(255,255,255,0.07)');
    vg.addColorStop(1, 'rgba(0,0,0,0.10)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    c.restore();

    // seams & details
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const d of g.details) {
      c.save();
      if (d.fill) {
        c.fillStyle = d.fill;
        c.fill(d.path);
        c.strokeStyle = 'rgba(0,0,0,0.25)';
        c.lineWidth = 1.5;
        c.stroke(d.path);
      } else {
        c.lineWidth = d.w || 2;
        c.setLineDash(d.dash ? [6, 5] : []);
        c.strokeStyle = 'rgba(0,0,0,0.30)';
        c.stroke(d.path);
        c.translate(0, 1.3);
        c.strokeStyle = 'rgba(255,255,255,0.16)';
        c.stroke(d.path);
      }
      c.restore();
    }
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.stroke(g.shape);
  }

  if (ui) drawUI(c);
}

const ACCENT = '#ff4f12';
function defaultArea(pid, view) {
  const p = PRODUCTS.find((x) => x.id === pid);
  if (!p || !p.print || !p.print[view]) return null;
  return { p, rect: p.print[view] };
}
function printArea(pid = state.productId, view = state.view) {
  const d = defaultArea(pid, view);
  if (!d) return null;
  const o = state.areaOverrides[pid] && state.areaOverrides[pid][view];
  const [x, y, w, h] = o || d.rect;
  return { x, y, w, h, ppi: d.p.ppi };
}
function setArea(rect, pid = state.productId, view = state.view) {
  if (!state.areaOverrides[pid]) state.areaOverrides[pid] = {};
  state.areaOverrides[pid][view] = rect.map((v) => Math.round(v * 10) / 10);
  markDirty();
  syncAreaPanel();
  render();
}
// Rect for a preset, placed relative to the blank's default area.
function presetRect(preset, pid = state.productId, view = state.view) {
  const d = defaultArea(pid, view);
  const [dx, dy, dw] = d.rect;
  const w = preset.w * d.p.ppi, h = preset.h * d.p.ppi;
  let cx = dx + dw / 2, top = dy;
  if (preset.anchor === 'leftchest') { cx = dx + dw / 2 + 3.5 * d.p.ppi; top = dy + 0.5 * d.p.ppi; }
  if (preset.anchor === 'leftleg') { cx = dx + dw / 2; }
  return [cx - w / 2, top, w, h];
}
const areaCorners = (pa) => [[pa.x, pa.y], [pa.x + pa.w, pa.y], [pa.x, pa.y + pa.h], [pa.x + pa.w, pa.y + pa.h]];
const inches = (v, ppi) => (v / ppi).toFixed(v / ppi < 10 ? 1 : 0);
function drawUI(c) {
  const u = uiUnit();
  const o = selected();
  const pa = state.guides || state.tool === 'area' ? printArea() : null;
  if (pa && state.tool === 'area') {
    c.save();
    c.fillStyle = 'rgba(255,79,18,0.07)';
    c.fillRect(pa.x, pa.y, pa.w, pa.h);
    c.fillStyle = '#fff';
    c.strokeStyle = ACCENT;
    c.lineWidth = 1.5 * u;
    const hs = 11 * u;
    for (const [hx, hy] of areaCorners(pa)) { c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs); }
    c.restore();
  }
  if (pa) {
    c.save();
    c.lineWidth = 1.2 * u;
    c.setLineDash([5 * u, 4 * u]);
    c.strokeStyle = 'rgba(255,79,18,0.75)';
    c.strokeRect(pa.x, pa.y, pa.w, pa.h);
    c.setLineDash([]);
    const label = `Print area ${inches(pa.w, pa.ppi)} × ${inches(pa.h, pa.ppi)} in`;
    c.font = `600 ${11 * u}px Inter, system-ui, sans-serif`;
    const tw = c.measureText(label).width;
    c.fillStyle = 'rgba(255,79,18,0.92)';
    c.fillRect(pa.x, pa.y - 18 * u, tw + 12 * u, 16 * u);
    c.fillStyle = '#fff';
    c.textBaseline = 'middle';
    c.fillText(label, pa.x + 6 * u, pa.y - 10 * u);
    c.restore();
  }
  if (o && state.tool === 'select') {
    const { hw, hh } = halfExtents(o);
    c.save();
    c.translate(o.x, o.y);
    c.rotate(o.rot);
    c.lineWidth = 1.5 * u;
    c.strokeStyle = ACCENT;
    c.setLineDash([6 * u, 4 * u]);
    c.strokeRect(-hw, -hh, hw * 2, hh * 2);
    c.setLineDash([]);
    c.beginPath(); c.moveTo(0, -hh); c.lineTo(0, -hh - 30 * u); c.stroke();
    c.fillStyle = '#fff';
    c.strokeStyle = ACCENT;
    c.lineWidth = 1.5 * u;
    const hs = 10 * u;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      c.fillRect(sx * hw - hs / 2, sy * hh - hs / 2, hs, hs);
      c.strokeRect(sx * hw - hs / 2, sy * hh - hs / 2, hs, hs);
    }
    c.beginPath(); c.arc(0, -hh - 30 * u, 7 * u, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }
  if (state.mirror && ['brush', 'spray', 'eraser', 'line', 'rect', 'ellipse'].includes(state.tool)) {
    c.save();
    c.setLineDash([4 * u, 6 * u]);
    c.strokeStyle = 'rgba(255,79,18,0.6)';
    c.lineWidth = 1 * u;
    c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke();
    c.restore();
  }
  const hp = state.hover;
  if (hp && ['brush', 'spray', 'eraser'].includes(state.tool)) {
    const r = state.tool === 'spray' ? state.size * 1.5 : state.size / 2;
    c.save();
    c.lineWidth = 1 * u;
    for (const x of state.mirror ? [hp.x, W - hp.x] : [hp.x]) {
      c.beginPath(); c.arc(x, hp.y, Math.max(r, 1), 0, Math.PI * 2);
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.stroke();
      c.beginPath(); c.arc(x, hp.y, Math.max(r, 1) + u, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke();
    }
    c.restore();
  }
}

let rafPending = false;
function render() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; drawScene(ctx, true); });
}

/* ---------------- history ---------------- */
function snapshot(L) {
  return { art: L.actx.getImageData(0, 0, WS, HS), objects: L.objects.map((o) => ({ ...o })) };
}
function pushHistory() {
  const L = layer();
  L.undo.push(snapshot(L));
  if (L.undo.length > 40) L.undo.shift();
  L.redo.length = 0;
  markDirty();
}
function restoreSnap(L, s) {
  L.actx.putImageData(s.art, 0, 0);
  L.objects = s.objects.map((o) => ({ ...o }));
  if (!selected()) state.selectedId = null;
  markDirty();
  syncObjectPanel();
  render();
}
function undo() {
  const L = layer();
  if (!L.undo.length) return;
  L.redo.push(snapshot(L));
  restoreSnap(L, L.undo.pop());
}
function redo() {
  const L = layer();
  if (!L.redo.length) return;
  L.undo.push(snapshot(L));
  restoreSnap(L, L.redo.pop());
}
function updateHistoryButtons() {
  const L = layer();
  $('#undoBtn').disabled = !L.undo.length;
  $('#redoBtn').disabled = !L.redo.length;
}

/* ---------------- painting helpers ---------------- */
const mx = (x) => W - x;
function eachMirror(fn) { fn(false); if (state.mirror) fn(true); }

function strokeCtx() {
  const s = strokeCv.getContext('2d');
  s.lineCap = 'round';
  s.lineJoin = 'round';
  s.strokeStyle = state.color;
  s.fillStyle = state.color;
  s.lineWidth = state.size;
  return s;
}

function segment(c, a, b, ctrl) {
  eachMirror((m) => {
    const f = (p) => (m ? { x: mx(p.x), y: p.y } : p);
    const A = f(a), B = f(b);
    c.beginPath();
    c.moveTo(A.x, A.y);
    if (ctrl) { const C = f(ctrl); c.quadraticCurveTo(C.x, C.y, B.x, B.y); }
    else c.lineTo(B.x, B.y);
    c.stroke();
  });
}
function dot(c, p, r) {
  eachMirror((m) => {
    c.beginPath();
    c.arc(m ? mx(p.x) : p.x, p.y, r, 0, Math.PI * 2);
    c.fill();
  });
}
function spray(p) {
  const s = strokeCtx();
  const R = state.size * 1.5;
  const n = Math.max(12, Math.round(R * 1.6));
  const dr = Math.max(0.8, state.size / 16);
  eachMirror((m) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = R * Math.sqrt(Math.random()) * (Math.random() < 0.85 ? 1 : 1.25);
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      s.beginPath();
      s.arc(m ? mx(x) : x, y, dr * (0.5 + Math.random()), 0, Math.PI * 2);
      s.fill();
    }
  });
}
function shapePreview(a, b, shift) {
  clearCanvas(strokeCv);
  const s = strokeCtx();
  let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
  if (shift) {
    if (state.tool === 'line') {
      const ang = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(x1 - x0, y1 - y0);
      x1 = x0 + Math.cos(ang) * len; y1 = y0 + Math.sin(ang) * len;
    } else {
      const d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + Math.sign(x1 - x0 || 1) * d; y1 = y0 + Math.sign(y1 - y0 || 1) * d;
    }
  }
  eachMirror((m) => {
    const X0 = m ? mx(x0) : x0, X1 = m ? mx(x1) : x1;
    s.beginPath();
    if (state.tool === 'line') { s.moveTo(X0, y0); s.lineTo(X1, y1); s.stroke(); return; }
    if (state.tool === 'rect') s.rect(Math.min(X0, X1), Math.min(y0, y1), Math.abs(X1 - X0), Math.abs(y1 - y0));
    else s.ellipse((X0 + X1) / 2, (y0 + y1) / 2, Math.abs(X1 - X0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    if (state.fillShapes) s.fill(); else s.stroke();
  });
}
function commitStroke() {
  pushHistory();
  const a = layer().actx;
  a.save();
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.globalAlpha = state.opacity;
  a.drawImage(strokeCv, 0, 0);
  a.restore();
  clearCanvas(strokeCv);
}

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function floodFill(p) {
  drawScene(scratchCv.getContext('2d'), false, true);
  const sx = Math.floor(p.x * S), sy = Math.floor(p.y * S);
  if (sx < 0 || sy < 0 || sx >= WS || sy >= HS) return;
  const src = scratchCv.getContext('2d').getImageData(0, 0, WS, HS).data;
  const mask = state.clip ? maskCv.getContext('2d').getImageData(0, 0, WS, HS).data : null;
  const start = (sy * WS + sx) * 4;
  if (mask && mask[start + 3] < 128) return;
  const t = [src[start], src[start + 1], src[start + 2], src[start + 3]];
  const TOL = 48;
  const same = (i) => {
    const k = i * 4;
    if (mask && mask[k + 3] < 128) return false;
    return Math.abs(src[k] - t[0]) + Math.abs(src[k + 1] - t[1]) + Math.abs(src[k + 2] - t[2]) + Math.abs(src[k + 3] - t[3]) <= TOL;
  };
  const filled = new Uint8Array(WS * HS);
  const stack = [sy * WS + sx];
  while (stack.length) {
    const i = stack.pop();
    const y = (i / WS) | 0;
    let x = i - y * WS;
    while (x > 0 && !filled[y * WS + x - 1] && same(y * WS + x - 1)) x--;
    let up = false, down = false;
    for (; x < WS; x++) {
      const j = y * WS + x;
      if (filled[j] || !same(j)) break;
      filled[j] = 1;
      if (y > 0) {
        const u = j - WS;
        if (!filled[u] && same(u)) { if (!up) { stack.push(u); up = true; } } else up = false;
      }
      if (y < HS - 1) {
        const d = j + WS;
        if (!filled[d] && same(d)) { if (!down) { stack.push(d); down = true; } } else down = false;
      }
    }
  }
  // dilate 1px to cover anti-aliased edges
  const [r, g, b] = hexToRgb(state.color);
  const out = new ImageData(WS, HS);
  const od = out.data;
  let any = false;
  for (let y = 0; y < HS; y++) {
    for (let x = 0; x < WS; x++) {
      const i = y * WS + x;
      if (filled[i] || (x > 0 && filled[i - 1]) || (x < WS - 1 && filled[i + 1]) || (y > 0 && filled[i - WS]) || (y < HS - 1 && filled[i + WS])) {
        const k = i * 4;
        od[k] = r; od[k + 1] = g; od[k + 2] = b; od[k + 3] = 255;
        any = true;
      }
    }
  }
  if (!any) return;
  pushHistory();
  const fc = scratchCv.getContext('2d');
  fc.setTransform(1, 0, 0, 1, 0, 0);
  fc.clearRect(0, 0, WS, HS);
  fc.putImageData(out, 0, 0);
  const a = layer().actx;
  a.save();
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.globalAlpha = state.opacity;
  a.drawImage(scratchCv, 0, 0);
  a.restore();
  render();
}

function pickColor(p) {
  drawScene(scratchCv.getContext('2d'), false);
  const d = scratchCv.getContext('2d').getImageData(Math.floor(p.x * S), Math.floor(p.y * S), 1, 1).data;
  if (d[3] === 0) return;
  setPaintColor(rgbToHex(d[0], d[1], d[2]));
  toast('Picked ' + state.color);
}

/* ---------------- objects actions ---------------- */
// Where new items go: the print area, stepping down a little for each item already there.
function areaCenter() {
  const pa = printArea();
  const n = layer().objects.length % 4;
  const c = pa ? { x: pa.x + pa.w / 2, y: pa.y + pa.h * 0.28, w: pa.w, h: pa.h } : { x: W / 2, y: 260, w: 260, h: 300 };
  c.y += n * Math.min(46, c.h * 0.2);
  return c;
}
const TEXT_STYLES = [
  { label: 'Headline', font: 'Anton', text: 'NO DAYS OFF', size: 64 },
  { label: 'Wide', font: 'Archivo', text: 'STUDIO', size: 56, spacing: 6 },
  { label: 'Gothic', font: 'UnifrakturMaguntia', text: 'Hometown', size: 64 },
  { label: 'Script', font: 'Pacifico', text: 'Sunday', size: 60 },
  { label: 'Marker', font: 'Permanent Marker', text: 'handmade', size: 56 },
  { label: 'Varsity arc', font: 'Bungee', text: 'EST. 2026', size: 46, arc: 70 },
];
function addText(p, text = 'YOUR TEXT', style = {}) {
  pushHistory();
  const o = { id: nextId++, type: 'text', text, font: style.font || 'Anton', size: style.size || 72, color: state.color, stroke: '#ffffff', strokeW: 0, arc: style.arc || 0, spacing: style.spacing || 0, x: p.x, y: p.y, rot: 0, scale: 1, flip: false, opacity: 1 };
  layer().objects.push(o);
  selectObject(o);
  setTool('select');
  const focusText = () => { const ti = $('#textInput'); if (document.activeElement !== ti) { ti.focus(); ti.select(); } };
  focusText();
  setTimeout(focusText, 0);
  if (document.fonts) document.fonts.load(`72px "${o.font}"`).then(render).catch(() => {});
}
function addTextStyle(s) {
  const c = areaCenter();
  addText({ x: c.x, y: c.y }, s.text, s);
  const o = selected();
  if (o) {
    // fit the line inside the print area
    const { w } = objSize(o);
    if (w > c.w) { o.scale = c.w / w; render(); }
  }
}
function addGraphic(g) {
  const c = areaCenter();
  const src = graphicDataUrl(g, state.color);
  loadImage(src).then((img) => {
    pushHistory();
    const size = Math.min(150, c.w * 0.8);
    const o = { id: nextId++, type: 'image', src, img, w: size, h: size, x: c.x, y: c.y + size * 0.3, rot: 0, scale: 1, flip: false, opacity: 1, graphic: g.id, tint: state.color };
    layer().objects.push(o);
    selectObject(o);
    setTool('select');
  });
}
function tintGraphic(o, color) {
  const g = GRAPHICS.find((x) => x.id === o.graphic);
  if (!g) return;
  o.tint = color;
  o.src = graphicDataUrl(g, color);
  const img = new Image();
  img.onload = render;
  img.src = o.src;
  o.img = img;
}
// Drawings photographed or scanned on paper: if the image's border is plain paper,
// turn the paper transparent so only the ink/paint is printed.
function removePaper(src) {
  return loadImage(src).then((img) => {
    const max = 1600;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height);
    const a = d.data, w = c.width, h = c.height;
    // already has transparency? leave it alone
    let transparent = 0;
    for (let i = 3; i < a.length; i += 4 * 97) if (a[i] < 250) transparent++;
    if (transparent > (a.length / (4 * 97)) * 0.02) return src;
    const R = [], G = [], B = [];
    const push = (px, py) => { const i = (py * w + px) * 4; R.push(a[i]); G.push(a[i + 1]); B.push(a[i + 2]); };
    for (let px = 0; px < w; px += 3) { push(px, 0); push(px, h - 1); }
    for (let py = 0; py < h; py += 3) { push(0, py); push(w - 1, py); }
    const med = (arr) => arr.slice().sort((p, q) => p - q)[arr.length >> 1];
    const pr = med(R), pg = med(G), pb = med(B);
    // how much of the border is close to the paper colour
    let near = 0;
    for (let i = 0; i < R.length; i++) if (Math.max(Math.abs(R[i] - pr), Math.abs(G[i] - pg), Math.abs(B[i] - pb)) < 40) near++;
    if (Math.min(pr, pg, pb) < 140 || near / R.length < 0.85) return src; // not a light, plain background
    for (let i = 0; i < a.length; i += 4) {
      const dist = Math.max(Math.abs(a[i] - pr), Math.abs(a[i + 1] - pg), Math.abs(a[i + 2] - pb));
      a[i + 3] = Math.max(0, Math.min(255, Math.round(((dist - 22) / 40) * 255)));
    }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  }).catch(() => src);
}

function addImage(src) {
  removePaper(src).then(placeNewImage);
}
function placeNewImage(src) {
  const img = new Image();
  img.onload = () => {
    pushHistory();
    const c = areaCenter();
    const max = Math.min(260, c.w);
    const k = Math.min(max / img.naturalWidth, max / img.naturalHeight, 1);
    const o = { id: nextId++, type: 'image', src, img, w: img.naturalWidth * k, h: img.naturalHeight * k, x: c.x, y: c.y + 30, rot: 0, scale: 1, flip: false, opacity: 1 };
    layer().objects.push(o);
    selectObject(o);
    setTool('select');
  };
  img.onerror = () => toast('Could not load that image');
  img.src = src;
}
function selectObject(o) {
  const changed = (o ? o.id : null) !== state.selectedId;
  state.selectedId = o ? o.id : null;
  if (o && changed) requestAnimationFrame(() => $('#panel').scrollTo({ top: 0, behavior: 'smooth' }));
  syncObjectPanel();
  render();
}
function objAction(kind) {
  const L = layer();
  const o = selected();
  if (!o) return;
  const i = L.objects.indexOf(o);
  pushHistory();
  if (kind === 'delete') { L.objects.splice(i, 1); state.selectedId = null; }
  if (kind === 'duplicate') { const c = { ...o, id: nextId++, x: o.x + 20, y: o.y + 20 }; L.objects.push(c); state.selectedId = c.id; }
  if (kind === 'forward' && i < L.objects.length - 1) { L.objects.splice(i, 1); L.objects.splice(i + 1, 0, o); }
  if (kind === 'backward' && i > 0) { L.objects.splice(i, 1); L.objects.splice(i - 1, 0, o); }
  if (kind === 'flip') o.flip = !o.flip;
  if (kind === 'center') { const pa = printArea(); o.x = pa ? pa.x + pa.w / 2 : W / 2; }
  syncObjectPanel();
  render();
}

/* ---------------- pointer handling ---------------- */
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

cv.addEventListener('pointerdown', (e) => {
  if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cv.setPointerCapture(e.pointerId);
  const p = toLogical(e);
  state.hover = p;
  const t = state.tool;
  drag = { id: e.pointerId, start: p, last: p, lastMid: p };

  if (t === 'select' || t === 'text') {
    const o = selected();
    const h = o && t === 'select' ? hitHandle(o, p) : null;
    if (h) {
      pushHistory();
      Object.assign(drag, { mode: h, obj: o, orig: { ...o }, d0: Math.hypot(p.x - o.x, p.y - o.y) || 1 });
      return;
    }
    const hit = hitObject(p);
    if (hit) {
      if (t === 'text') setTool('select');
      selectObject(hit);
      pushHistory();
      Object.assign(drag, { mode: 'move', obj: hit, orig: { ...hit } });
      return;
    }
    if (t === 'text') { drag = null; addText(p); return; }
    selectObject(null);
    drag = null;
    return;
  }
  if (t === 'area') {
    const pa = printArea();
    if (!pa) { drag = null; return; }
    const tol = 14 * uiUnit();
    const ci = areaCorners(pa).findIndex(([hx, hy]) => Math.abs(p.x - hx) < tol && Math.abs(p.y - hy) < tol);
    if (ci >= 0) { Object.assign(drag, { mode: 'area-resize', corner: ci, orig: pa }); return; }
    if (p.x >= pa.x && p.x <= pa.x + pa.w && p.y >= pa.y && p.y <= pa.y + pa.h) { Object.assign(drag, { mode: 'area-move', orig: pa }); return; }
    drag = null;
    return;
  }
  if (t === 'fill') { drag = null; floodFill(p); return; }
  if (t === 'picker') { drag = null; pickColor(p); return; }
  if (t === 'eraser') {
    pushHistory();
    const a = layer().actx;
    a.save();
    a.globalCompositeOperation = 'destination-out';
    a.lineCap = 'round'; a.lineJoin = 'round';
    a.lineWidth = state.size;
    dot(a, p, state.size / 2);
    a.restore();
    render();
    return;
  }
  clearCanvas(strokeCv);
  drag.live = true;
  if (t === 'brush') dot(strokeCtx(), p, state.size / 2);
  if (t === 'spray') {
    spray(p);
    drag.timer = setInterval(() => { spray(drag.last); render(); }, 40);
  }
  render();
});

cv.addEventListener('pointermove', (e) => {
  const p = toLogical(e);
  state.hover = p;
  if (!drag || e.pointerId !== drag.id) {
    if (state.tool === 'area') {
      const pa = printArea();
      const tol = 14 * uiUnit();
      const onCorner = pa && areaCorners(pa).some(([hx, hy]) => Math.abs(p.x - hx) < tol && Math.abs(p.y - hy) < tol);
      const inside = pa && p.x >= pa.x && p.x <= pa.x + pa.w && p.y >= pa.y && p.y <= pa.y + pa.h;
      cv.style.cursor = onCorner ? 'nwse-resize' : inside ? 'move' : 'default';
    }
    if (state.tool === 'select') {
      const o = selected();
      const h = o && hitHandle(o, p);
      cv.style.cursor = h === 'rotate' ? 'grab' : h === 'scale' ? 'nwse-resize' : hitObject(p) ? 'move' : 'default';
    }
    render();
    return;
  }
  const t = state.tool;
  const { mode, obj, orig } = drag;
  if (mode === 'area-move') {
    setArea([orig.x + p.x - drag.start.x, orig.y + p.y - drag.start.y, orig.w, orig.h]);
    drag.last = p;
    return;
  }
  if (mode === 'area-resize') {
    const min = orig.ppi; // 1 inch
    const ax = drag.corner % 2 === 0 ? orig.x + orig.w : orig.x;   // fixed opposite corner
    const ay = drag.corner < 2 ? orig.y + orig.h : orig.y;
    let w = Math.max(min, Math.abs(p.x - ax)), h = Math.max(min, Math.abs(p.y - ay));
    if (e.shiftKey) { const k = Math.max(w / orig.w, h / orig.h); w = orig.w * k; h = orig.h * k; }
    const x = p.x < ax ? ax - w : ax, y = p.y < ay ? ay - h : ay;
    setArea([x, y, w, h]);
    drag.last = p;
    return;
  }
  if (mode === 'move') { obj.x = orig.x + p.x - drag.start.x; obj.y = orig.y + p.y - drag.start.y; }
  else if (mode === 'scale') { obj.scale = Math.max(0.05, orig.scale * (Math.hypot(p.x - obj.x, p.y - obj.y) / drag.d0)); }
  else if (mode === 'rotate') {
    let r = Math.atan2(p.y - obj.y, p.x - obj.x) + Math.PI / 2;
    if (e.shiftKey) r = Math.round(r / (Math.PI / 12)) * (Math.PI / 12);
    obj.rot = r;
  }
  else if (t === 'brush') {
    const mid = { x: (drag.last.x + p.x) / 2, y: (drag.last.y + p.y) / 2 };
    segment(strokeCtx(), drag.lastMid, mid, drag.last);
    drag.lastMid = mid;
  }
  else if (t === 'spray') spray(p);
  else if (t === 'eraser') {
    const a = layer().actx;
    a.save();
    a.globalCompositeOperation = 'destination-out';
    a.lineCap = 'round'; a.lineJoin = 'round';
    a.lineWidth = state.size;
    segment(a, drag.last, p);
    a.restore();
  }
  else if (['line', 'rect', 'ellipse'].includes(t)) shapePreview(drag.start, p, e.shiftKey);
  drag.last = p;
  render();
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.timer) clearInterval(drag.timer);
  const t = state.tool;
  if (drag.live) {
    if (t === 'brush') segment(strokeCtx(), drag.lastMid, drag.last);
    drag.live = false;
    commitStroke();
  }
  drag = null;
  syncObjectPanel();
  render();
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => { if (!drag) { state.hover = null; render(); } });

// drag & drop images onto the canvas
const stage = $('#stage');
stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dropping'); });
stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
stage.addEventListener('drop', (e) => {
  e.preventDefault();
  stage.classList.remove('dropping');
  const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
  if (f) readFile(f).then(addImage);
});

/* ---------------- UI wiring ---------------- */
function setTool(t) {
  if (drag) return;
  state.tool = t;
  $$('#toolbar [data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  $('#hint').textContent = HINTS[t] || '';
  cv.style.cursor = { select: 'default', text: 'text', picker: 'copy', fill: 'cell', area: 'default' }[t] || 'crosshair';
  syncObjectPanel();
  syncAreaPanel();
  render();
}
$$('#toolbar [data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

function setMirror(v) {
  state.mirror = v;
  $('#mirrorBtn').classList.toggle('active', v);
  render();
}
$('#mirrorBtn').addEventListener('click', () => setMirror(!state.mirror));

function setPaintColor(c) {
  state.color = c;
  $('#paintColor').value = c;
  $$('#paintSwatches button').forEach((b) => b.classList.toggle('active', b.dataset.color === c));
}

function buildSwatches(el, colors, onPick, getActive, names) {
  el.innerHTML = '';
  colors.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.dataset.color = c;
    b.title = names ? names(c) : c;
    b.setAttribute('aria-label', (names ? names(c) : 'Color') + ' ' + c);
    b.addEventListener('click', () => onPick(c));
    el.appendChild(b);
  });
  if (getActive) $$(`#${el.id} button`).forEach((b) => b.classList.toggle('active', b.dataset.color === getActive()));
}

function setGarment(c) {
  state.garment = c;
  const gn = $('#garmentName');
  if (gn) gn.textContent = garmentName(c);
  $$('#garmentSwatches .swatch').forEach((b) => b.classList.toggle('active', b.dataset.color === c));
  const ci = $('#garmentCustom');
  if (ci) ci.value = c;
  markDirty();
  render();
}

function buildGarmentSwatches() {
  const el = $('#garmentSwatches');
  buildSwatches(el, GARMENT_COLORS, setGarment, null, garmentName);
  const lab = document.createElement('label');
  lab.className = 'swatch custom';
  lab.title = 'Custom color';
  lab.innerHTML = '<input type="color" id="garmentCustom" aria-label="Custom garment color">';
  el.appendChild(lab);
  $('#garmentCustom').addEventListener('input', (e) => setGarment(e.target.value));
}

// Thumbnail of the real blank (the baked render of its 3D model).
function productThumb(p) {
  const b = typeof BAKED !== 'undefined' && BAKED[p.id] && BAKED[p.id].front;
  if (!b) return '';
  return `<img alt="" src="${b.base || b.shade}" class="${b.base ? '' : 'shade'}" draggable="false">`;
}
const UPLOAD_ICON = '<svg viewBox="0 0 24 24" class="upload" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>';
function productCards(el, onPick, onCustom) {
  el.innerHTML = '';
  PRODUCTS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'product';
    b.dataset.id = p.id;
    b.innerHTML = `<span class="thumb">${productThumb(p)}</span><span class="pname"></span><span class="pmeta">${p.blurb || ''} · 3D${p.user ? ' · yours' : ''}</span>`;
    b.querySelector('.pname').textContent = p.name;
    b.addEventListener('click', () => onPick(p.id));
    el.appendChild(b);
  });
  const c = document.createElement('button');
  c.className = 'product';
  c.dataset.id = 'custom';
  c.innerHTML = `<span class="thumb">${UPLOAD_ICON}</span><span class="pname">Your own</span><span class="pmeta">Photo or PNG</span>`;
  c.title = 'Upload a photo or PNG of your own product';
  c.addEventListener('click', onCustom);
  el.appendChild(c);
}
function buildProductGrid() {
  productCards($('#productGrid'), setProduct, () => {
    if (state.custom && state.productId !== 'custom') setProduct('custom');
    else $('#productFile').click();
  });
}

function setProduct(id) {
  state.productId = id;
  const p = product();
  if (!p.views.some((v) => v.key === state.view)) state.view = p.views[0].key;
  $$('#productGrid .product').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  syncAreaPanel();
  $('#garmentCard').hidden = id === 'custom' || !!(bakedView(id, 'front') && bakedView(id, 'front').base);
  $('#removeBgRow').hidden = id !== 'custom';
  buildViewTabs();
  buildMask();
  markDirty();
  render();
}

function buildViewTabs() {
  const el = $('#viewTabs');
  el.innerHTML = '';
  product().views.forEach((v) => {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.setAttribute('role', 'tab');
    b.classList.toggle('active', v.key === state.view);
    b.addEventListener('click', () => setView(v.key));
    el.appendChild(b);
  });
}
function setView(key) {
  state.view = key;
  state.selectedId = null;
  syncAreaPanel();
  buildViewTabs();
  buildMask();
  syncObjectPanel();
  render();
}

// Custom product upload
function readFile(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
async function setCustomProduct(src, removeWhite) {
  const img = await loadImage(src);
  const maxDim = 1400;
  const k = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, c.width, c.height);
  if (removeWhite) {
    const d = x.getImageData(0, 0, c.width, c.height);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const m = Math.min(a[i], a[i + 1], a[i + 2]);
      if (m > 238) a[i + 3] = 0;
      else if (m > 220) a[i + 3] = Math.min(a[i + 3], Math.round(((238 - m) / 18) * 255));
    }
    x.putImageData(d, 0, 0);
  }
  const pad = 30;
  const f = Math.min((W - pad * 2) / c.width, (H - pad * 2) / c.height);
  const fw = c.width * f, fh = c.height * f;
  state.custom = { src, removeWhite, canvas: c, fit: { x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh } };
  setProduct('custom');
}
$('#productFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try { await setCustomProduct(await readFile(f), $('#removeBg').checked); }
  catch { toast('Could not load that image'); }
});
$('#removeBg').addEventListener('change', (e) => {
  if (state.custom) setCustomProduct(state.custom.src, e.target.checked);
});

$('#addImageBtn').addEventListener('click', () => $('#imageFile').click());
$('#imageFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) addImage(await readFile(f));
});

// paint controls
$('#paintColor').addEventListener('input', (e) => setPaintColor(e.target.value));
const sizeIn = $('#size'), opIn = $('#opacity');
function setSize(v) {
  state.size = Math.max(1, Math.min(120, Math.round(v)));
  sizeIn.value = state.size;
  $('#sizeVal').textContent = state.size + 'px';
  render();
}
sizeIn.addEventListener('input', () => setSize(+sizeIn.value));
opIn.addEventListener('input', () => { state.opacity = +opIn.value / 100; $('#opacityVal').textContent = opIn.value + '%'; });
$('#fillShapes').addEventListener('change', (e) => { state.fillShapes = e.target.checked; });
$('#clipToggle').addEventListener('change', (e) => { state.clip = e.target.checked; markDirty(); render(); });

$('#guidesToggle').addEventListener('change', (e) => { state.guides = e.target.checked; render(); });

// print area panel
function areaPresets(pid = state.productId, view = state.view) {
  const p = PRODUCTS.find((x) => x.id === pid);
  return ((p && PRINT_PRESETS[p.kind]) || []).filter((s) => !s.views || s.views.includes(view));
}
function syncAreaPanel() {
  const pa = printArea();
  $('#areaBox').hidden = !pa;
  if (!pa) return;
  const presets = areaPresets();
  const sel = $('#areaPreset');
  const same = (r) => Math.abs(r[0] - pa.x) < 0.6 && Math.abs(r[1] - pa.y) < 0.6 && Math.abs(r[2] - pa.w) < 0.6 && Math.abs(r[3] - pa.h) < 0.6;
  const match = presets.find((s) => same(presetRect(s)));
  sel.innerHTML = presets.map((s) => `<option value="${s.id}">${s.name}</option>`).join('') + '<option value="custom">Custom</option>';
  sel.value = match ? match.id : 'custom';
  const W_ = $('#areaW'), H_ = $('#areaH');
  if (document.activeElement !== W_) W_.value = +(pa.w / pa.ppi).toFixed(2);
  if (document.activeElement !== H_) H_.value = +(pa.h / pa.ppi).toFixed(2);
  $('#areaSize').textContent = `${inches(pa.w, pa.ppi)} × ${inches(pa.h, pa.ppi)} in`;
  $('#areaClip').checked = state.areaClip;
  const editing = state.tool === 'area';
  $('#areaAdjust').classList.toggle('active', editing);
  $('#areaAdjust').textContent = editing ? 'Done' : 'Adjust on canvas';
  $('#printFileInfo').textContent = `Artwork only, transparent PNG, ${inches(pa.w, pa.ppi)} × ${inches(pa.h, pa.ppi)} in at 300 DPI`;
}
$('#areaPreset').addEventListener('change', (e) => {
  const s = areaPresets().find((x) => x.id === e.target.value);
  if (s) setArea(presetRect(s));
});
function sizeArea() {
  const pa = printArea();
  if (!pa) return;
  const w = Math.max(1, Math.min(30, +$('#areaW').value || 1)) * pa.ppi;
  const h = Math.max(1, Math.min(30, +$('#areaH').value || 1)) * pa.ppi;
  setArea([pa.x + pa.w / 2 - w / 2, pa.y, w, h]);
}
$('#areaW').addEventListener('change', sizeArea);
$('#areaH').addEventListener('change', sizeArea);
$('#areaAdjust').addEventListener('click', () => setTool(state.tool === 'area' ? 'select' : 'area'));
$('#areaReset').addEventListener('click', () => {
  const o = state.areaOverrides[state.productId];
  if (o) delete o[state.view];
  markDirty();
  syncAreaPanel();
  render();
});
$('#areaClip').addEventListener('change', (e) => { state.areaClip = e.target.checked; markDirty(); render(); });

// text styles
TEXT_STYLES.forEach((s) => {
  const b = document.createElement('button');
  b.className = 'text-style';
  b.textContent = s.label;
  b.style.fontFamily = `"${s.font}", sans-serif`;
  if (s.font === 'Archivo') b.style.fontStretch = '125%';
  b.title = 'Add ' + s.label.toLowerCase() + ' text';
  b.addEventListener('click', () => addTextStyle(s));
  $('#textStyles').appendChild(b);
});

// graphics library
GRAPHICS.forEach((g) => {
  const b = document.createElement('button');
  b.className = 'graphic';
  b.title = g.name;
  b.setAttribute('aria-label', 'Add ' + g.name);
  b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${g.svg.split('{{c}}').join('currentColor').replace(/id="(\w+)"/g, 'id="$1-' + g.id + '"').replace(/url\(#(\w+)\)/g, 'url(#$1-' + g.id + ')')}</svg>`;
  b.addEventListener('click', () => addGraphic(g));
  $('#graphicGrid').appendChild(b);
});

// object panel
const textInput = $('#textInput');
function syncObjectPanel() {
  const o = state.tool === 'select' || state.tool === 'text' ? selected() : null;
  updateHistoryButtons();
  $('#objectCard').hidden = !o;
  if (!o) return;
  const isText = o.type === 'text';
  $('#objectTitle').textContent = o.graphic ? 'Graphic' : o.type === 'image' ? 'Image' : o.sticker ? 'Sticker' : 'Text';
  $('#textProps').hidden = !isText;
  $('#tintRow').hidden = !o.graphic;
  if (o.graphic) $('#tintColor').value = o.tint || '#111111';
  const pa = printArea();
  if (pa) {
    const s = objSize(o);
    $('#objSize').textContent = `${inches(s.w * o.scale, pa.ppi)} × ${inches(s.h * o.scale, pa.ppi)} in`;
  } else $('#objSize').textContent = '';
  if (isText) {
    $$('#textProps > *').forEach((n) => { n.hidden = false; });
    if (o.sticker) {
      // stickers only need size-agnostic props
      ['#fontSelect', '#textColor', '#textStroke', '#textStrokeW', '#textSpacing'].forEach((s) => { $(s).closest('label').hidden = true; });
    }
    if (document.activeElement !== textInput) textInput.value = o.text;
    $('#fontSelect').value = o.font;
    $('#textColor').value = o.color;
    $('#textStroke').value = o.stroke;
    $('#textStrokeW').value = o.strokeW;
    $('#textStrokeWVal').textContent = o.strokeW + 'px';
    $('#textArc').value = o.arc;
    $('#textArcVal').textContent = o.arc + '°';
    $('#textSpacing').value = o.spacing;
    $('#textSpacingVal').textContent = o.spacing + 'px';
  }
  $('#objOpacity').value = Math.round((o.opacity ?? 1) * 100);
  $('#objOpacityVal').textContent = Math.round((o.opacity ?? 1) * 100) + '%';
}

function bindProp(sel, apply, evt = 'input') {
  const el = $(sel);
  el.addEventListener('focus', () => { if (selected()) pushHistory(); });
  el.addEventListener(evt, () => {
    const o = selected();
    if (!o) return;
    apply(o, el);
    markDirty();
    syncObjectPanel();
    render();
  });
}
bindProp('#textInput', (o, el) => { o.text = el.value || ' '; });
bindProp('#fontSelect', (o, el) => {
  o.font = el.value;
  if (document.fonts) document.fonts.load(`${o.size}px "${o.font}"`).then(render).catch(() => {});
}, 'change');
bindProp('#textColor', (o, el) => { o.color = el.value; });
bindProp('#textStroke', (o, el) => { o.stroke = el.value; if (!o.strokeW) o.strokeW = 4; });
bindProp('#textStrokeW', (o, el) => { o.strokeW = +el.value; });
bindProp('#textArc', (o, el) => { o.arc = +el.value; });
bindProp('#textSpacing', (o, el) => { o.spacing = +el.value; });
bindProp('#objOpacity', (o, el) => { o.opacity = +el.value / 100; });
bindProp('#tintColor', (o, el) => { if (o.graphic) tintGraphic(o, el.value); });
$$('[data-obj]').forEach((b) => b.addEventListener('click', () => objAction(b.dataset.obj)));

// top bar
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#clearBtn').addEventListener('click', () => {
  const L = layer();
  pushHistory();
  clearCanvas(L.art);
  L.objects = [];
  state.selectedId = null;
  syncObjectPanel();
  render();
  toast('Cleared — Ctrl+Z to undo');
});
$('#newBtn').addEventListener('click', () => {
  const hasWork = Object.values(state.layers).some((L) => L.objects.length || !isBlank(L.art));
  const go = () => openWelcome(true);
  if (!hasWork) { go(); return; }
  askConfirm('Start a new design? Anything you have not saved will be lost.', 'Start new').then((ok) => { if (ok) go(); });
});
const helpDlg = $('#helpDlg');
$('#helpBtn').addEventListener('click', () => helpDlg.showModal());
$('#closeHelp').addEventListener('click', () => helpDlg.close());
helpDlg.addEventListener('click', (e) => { if (e.target === helpDlg) helpDlg.close(); });
$('#designName').addEventListener('input', markDirty);

const exportMenu = $('#exportMenu');
const MENUS = [['#fileBtn', '#fileMenu'], ['#exportBtn', '#exportMenu']];
function closeMenus() { MENUS.forEach(([, m]) => { $(m).hidden = true; $(m).previousElementSibling.setAttribute('aria-expanded', 'false'); }); }
MENUS.forEach(([b, m]) => {
  $(b).addEventListener('click', (e) => {
    e.stopPropagation();
    const open = $(m).hidden;
    closeMenus();
    $(m).hidden = !open;
    $(b).setAttribute('aria-expanded', String(open));
  });
});
document.addEventListener('click', closeMenus);
$$('[data-export]').forEach((b) => b.addEventListener('click', () => doExport(b.dataset.export)));

/* ---------------- export ---------------- */
function slug() {
  return ($('#designName').value.trim() || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
}
// Save a file. Inside a claude.ai artifact the page must go through the viewer's
// `downloads` capability; everywhere else (file://, GitHub Pages) a normal link download.
let downloadsApi;
function hostDownloads() {
  if (downloadsApi === undefined) {
    downloadsApi = window.claude && typeof window.claude.use === 'function'
      ? window.claude.use('downloads').catch(() => null)
      : Promise.resolve(null);
  }
  return downloadsApi;
}
async function saveFile(blob, name) {
  const dl = await hostDownloads();
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return 'saved'; }
    catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (e && e.code === 'rejected_extension') throw e;
      if (e && e.code === 'rate_limited') { toast('Another download is waiting for your OK'); return 'declined'; }
      // unavailable here: fall back to a link download
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}
hostDownloads();
function download(canvas, name) {
  canvas.toBlob((blob) => { saveFile(blob, name).catch((e) => toast('Download failed: ' + (e.message || e.code))); }, 'image/png');
}

// In-page confirm (native confirm() is blocked inside sandboxed frames).
function askConfirm(message, okLabel = 'OK') {
  return new Promise((resolve) => {
    const d = $('#confirmDlg');
    $('#confirmMsg').textContent = message;
    $('#confirmOk').textContent = okLabel;
    const done = (v) => { d.close(); $('#confirmOk').onclick = $('#confirmCancel').onclick = null; resolve(v); };
    $('#confirmOk').onclick = () => done(true);
    $('#confirmCancel').onclick = () => done(false);
    d.oncancel = () => done(false);
    d.showModal();
  });
}
function copyCanvas(src) {
  const c = document.createElement('canvas');
  c.width = WS; c.height = HS;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
// Print-ready file: the print area only, re-rendered at 300 DPI (text and graphics stay sharp).
function printFile(pid = state.productId, view = state.view, dpi = 300) {
  const saved = { p: state.productId, v: state.view };
  state.productId = pid; state.view = view; buildMask();
  try {
    const pa = printArea();
    if (!pa) return copyCanvas(composeArt(false));
    let k = dpi / pa.ppi;                            // pixels per editor unit
    const maxPx = 40e6;                               // keep huge areas within browser limits
    if (pa.w * k * pa.h * k > maxPx) k = Math.sqrt(maxPx / (pa.w * pa.h));
    const c = document.createElement('canvas');
    c.width = Math.round(pa.w * k); c.height = Math.round(pa.h * k);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    const L = layer();
    x.drawImage(L.art, pa.x * S, pa.y * S, pa.w * S, pa.h * S, 0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, -pa.x * k, -pa.y * k);
    for (const o of L.objects) drawObject(x, o);
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (state.clip) {
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(maskCv, pa.x * S, pa.y * S, pa.w * S, pa.h * S, 0, 0, c.width, c.height);
    }
    c.dpi = Math.round(k * pa.ppi);
    c.inches = `${inches(pa.w, pa.ppi)}x${inches(pa.h, pa.ppi)}in`;
    return c;
  } finally {
    state.productId = saved.p; state.view = saved.v; buildMask();
  }
}
function doExport(kind) {
  const base = slug() + '-' + (state.productId === 'custom' ? 'custom' : state.productId);
  if (kind === 'mockup') {
    drawScene(scratchCv.getContext('2d'), false);
    download(copyCanvas(scratchCv), `${base}-${viewDef().label.toLowerCase()}.png`);
  } else if (kind === 'print') {
    const pf = printFile();
    download(pf, `${base}-${viewDef().label.toLowerCase()}-print${pf.inches ? '-' + pf.inches + '-' + pf.dpi + 'dpi' : ''}.png`);
  } else if (kind === 'pack') {
    open3D(() => window.Viewer3D.downloadPack());
  } else if (kind === 'glb') {
    open3D(() => window.Viewer3D.downloadGlb());
  } else if (kind === 'all') {
    const cur = state.view;
    product().views.forEach((v, i) => {
      state.view = v.key;
      buildMask();
      drawScene(scratchCv.getContext('2d'), false);
      const c = copyCanvas(scratchCv);
      setTimeout(() => download(c, `${base}-${v.label.toLowerCase()}.png`), i * 350);
    });
    state.view = cur;
    buildMask();
    render();
  }
  closeMenus();
}

/* ---------------- save / load ---------------- */
function serialize() {
  const views = {};
  for (const [k, L] of Object.entries(state.layers)) {
    const blank = !L.objects.length && isBlank(L.art);
    if (blank) continue;
    views[k] = {
      art: L.art.toDataURL('image/png'),
      objects: L.objects.map(({ img, ...rest }) => rest),
    };
  }
  return {
    id: state.designId,
    name: $('#designName').value.trim() || 'Untitled drop',
    productId: state.productId,
    garment: state.garment,
    clip: state.clip,
    areas: state.areaOverrides,
    areaClip: state.areaClip,
    custom: state.custom ? { src: state.custom.src, removeWhite: state.custom.removeWhite } : null,
    views,
  };
}
function isBlank(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 64) if (d[i]) return false;
  return true;
}
function thumbnail() {
  drawScene(scratchCv.getContext('2d'), false);
  const t = document.createElement('canvas');
  t.width = 300; t.height = 350;
  t.getContext('2d').drawImage(scratchCv, 0, 0, 300, 350);
  return t.toDataURL('image/png');
}
function readDesigns() {
  try { return JSON.parse(localStorage.getItem(LS_DESIGNS)) || []; } catch { return []; }
}
function writeDesigns(list) {
  try { localStorage.setItem(LS_DESIGNS, JSON.stringify(list)); return true; }
  catch { toast('Browser storage is full — delete old designs or export PNGs instead'); return false; }
}
function saveDesign() {
  const d = serialize();
  if (!d.id) d.id = 'd' + Date.now().toString(36);
  d.updated = Date.now();
  d.thumb = thumbnail();
  const list = readDesigns().filter((x) => x.id !== d.id);
  list.unshift(d);
  if (writeDesigns(list)) {
    state.designId = d.id;
    dirty = false;
    setSaveState('Saved');
    toast('Saved to My designs');
  }
}
$('#saveBtn').addEventListener('click', saveDesign);

async function loadDesign(d) {
  resetDesign(true);
  state.designId = d.id || null;
  $('#designName').value = d.name || 'Untitled drop';
  state.garment = d.garment || state.garment;
  state.clip = d.clip !== false;
  $('#clipToggle').checked = state.clip;
  state.areaOverrides = d.areas || {};
  state.areaClip = !!d.areaClip;
  setGarment(state.garment);
  if (d.custom) {
    $('#removeBg').checked = d.custom.removeWhite;
    try { await setCustomProduct(d.custom.src, d.custom.removeWhite); } catch { /* ignore */ }
  }
  const known = PRODUCTS.some((p) => p.id === d.productId) || (d.productId === 'custom' && state.custom);
  setProduct(known ? d.productId : 'tee');
  for (const [k, v] of Object.entries(d.views || {})) {
    const L = layer(k);
    try {
      const img = await loadImage(v.art);
      L.actx.save(); L.actx.setTransform(1, 0, 0, 1, 0, 0); L.actx.drawImage(img, 0, 0); L.actx.restore();
    } catch { /* blank */ }
    L.objects = (v.objects || []).map((o) => {
      const c = { ...o, id: nextId++ };
      if (c.type === 'image') { c.img = new Image(); c.img.onload = render; c.img.src = c.src; }
      return c;
    });
  }
  buildViewTabs();
  syncObjectPanel();
  syncAreaPanel();
  render();
  dirty = false;
  setSaveState(state.designId ? 'Saved' : 'Draft');
}

function resetDesign(silent) {
  state.layers = {};
  state.areaOverrides = {};
  state.areaClip = false;
  state.selectedId = null;
  state.designId = null;
  state.view = 'front';
  $('#designName').value = 'Untitled drop';
  setProduct(state.productId === 'custom' && !state.custom ? 'tee' : state.productId);
  syncObjectPanel();
  updateHistoryButtons();
  if (!silent) markDirty();
  render();
}

// gallery
const gallery = $('#gallery');
function openGallery() {
  const grid = $('#galleryGrid');
  const list = readDesigns();
  grid.innerHTML = list.length ? '' : '<p class="empty">No saved designs yet. Press Save in the top bar and your design appears here.</p>';
  list.forEach((d) => {
    const card = document.createElement('div');
    card.className = 'g-card';
    const date = new Date(d.updated || Date.now()).toLocaleString();
    card.innerHTML = `<img alt="" src="${d.thumb}"><div class="g-meta"><strong></strong><small>${date}</small></div><div class="g-actions"><button class="btn sm" data-a="open">Open</button><button class="btn danger sm" data-a="del">Delete</button></div>`;
    card.querySelector('strong').textContent = d.name;
    card.querySelector('[data-a=open]').addEventListener('click', async () => { gallery.close(); if (welcome.open) welcome.close(); await loadDesign(d); toast('Opened “' + d.name + '”'); });
    card.querySelector('[data-a=del]').addEventListener('click', () => {
      askConfirm('Delete “' + d.name + '”?', 'Delete').then((ok) => {
        if (!ok) return;
        writeDesigns(readDesigns().filter((x) => x.id !== d.id));
        if (state.designId === d.id) state.designId = null;
        openGallery();
      });
    });
    grid.appendChild(card);
  });
  if (!gallery.open) gallery.showModal();
}
$('#galleryBtn').addEventListener('click', openGallery);
$('#closeGallery').addEventListener('click', () => gallery.close());
gallery.addEventListener('click', (e) => { if (e.target === gallery) gallery.close(); });

// draft autosave
let draftTimer = null;
function setSaveState(t) { const s = $('#saveState'); if (s) s.textContent = t; }
function markDirty() {
  dirty = true;
  setSaveState(state.designId ? 'Unsaved changes' : 'Draft');
  updateHistoryButtons();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try { localStorage.setItem(LS_DRAFT, JSON.stringify(serialize())); } catch { /* quota — skip draft */ }
  }, 1200);
}

/* ---------------- keyboard ---------------- */
const KEYS = { v: 'select', b: 'brush', s: 'spray', e: 'eraser', g: 'fill', l: 'line', r: 'rect', o: 'ellipse', t: 'text', i: 'picker' };
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveDesign(); return; }
  if (mod && e.key.toLowerCase() === 'd' && selected()) { e.preventDefault(); objAction('duplicate'); return; }
  if (typing || mod || e.altKey) return;
  const o = state.tool === 'select' ? selected() : null;
  if ((e.key === 'Delete' || e.key === 'Backspace') && o) { e.preventDefault(); objAction('delete'); return; }
  if (o && e.key.startsWith('Arrow')) {
    e.preventDefault();
    if (!e.repeat) pushHistory();
    const n = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') o.x -= n;
    if (e.key === 'ArrowRight') o.x += n;
    if (e.key === 'ArrowUp') o.y -= n;
    if (e.key === 'ArrowDown') o.y += n;
    render();
    return;
  }
  if (e.key === 'Escape') { closeMenus(); selectObject(null); return; }
  if (e.key === '?') { helpDlg.showModal(); return; }
  if (e.key === '[') { setSize(state.size - (state.size > 20 ? 4 : 1)); return; }
  if (e.key === ']') { setSize(state.size + (state.size >= 20 ? 4 : 1)); return; }
  if (e.key.toLowerCase() === 'm') { setMirror(!state.mirror); return; }
  const t = KEYS[e.key.toLowerCase()];
  if (t) setTool(t);
});

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------------- your own blanks (IndexedDB) ---------------- */
const KIND_LABEL = { top: 'Top', bottom: 'Pants', shorts: 'Shorts', other: 'Product' };
const userBlanks = [];   // records incl. .glb bytes, also handed to the 3D studio
function idb() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('driplab', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blanks', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
async function idbAll() {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('blanks').objectStore('blanks').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); });
}
async function idbPut(rec) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('blanks', 'readwrite'); t.objectStore('blanks').put(rec); t.oncomplete = res; t.onerror = () => rej(t.error); });
}
async function idbDel(id) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('blanks', 'readwrite'); t.objectStore('blanks').delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); });
}
// Sensible starting print area for a blank, in editor units, from its outline frame and size.
function defaultBlankPrint(rec) {
  const [x0, x1, y0, y1] = rec.frame;
  const fw = x1 - x0, fh = y1 - y0, ppi = rec.ppi;
  let w, h, cx = 300, top;
  if (rec.kind === 'bottom') { w = Math.min(4 * ppi, fw * 0.3); h = Math.min(12 * ppi, fh * 0.35); cx = 300 - fw * 0.22; top = y0 + fh * 0.2; }
  else if (rec.kind === 'shorts') { w = Math.min(4 * ppi, fw * 0.3); h = Math.min(4 * ppi, fh * 0.3); cx = 300 - fw * 0.22; top = y0 + fh * 0.3; }
  else if (rec.kind === 'top') { w = Math.min(12 * ppi, fw * 0.45); h = Math.min(16 * ppi, fh * 0.55); top = y0 + fh * 0.16; }
  else { w = fw * 0.45; h = fh * 0.45; top = y0 + fh * 0.2; }
  return { front: [cx - w / 2, top, w, h], back: [600 - cx - w / 2, top, w, h] };
}
function registerBlank(rec) {
  if (!rec.print) rec.print = defaultBlankPrint(rec);
  if (PRODUCTS.some((p) => p.id === rec.id)) return;
  PRODUCTS.push({
    id: rec.id, name: rec.name, blurb: KIND_LABEL[rec.kind] || 'Product', kind: rec.kind, ppi: rec.ppi, user: true,
    print: rec.print,
    views: [{ key: 'front', label: 'Front', shape: [], details: [] }, { key: 'back', label: 'Back', shape: [], details: [] }],
  });
  BAKED[rec.id] = rec.baked;
  userBlanks.push(rec);
  if (window.Viewer3D) window.Viewer3D.addBlankModel(rec);
}
async function loadUserBlanks() {
  try { (await idbAll()).forEach(registerBlank); } catch { /* storage unavailable */ }
}

/* ---------------- 3D / 360° bridge ---------------- */
window.DripLab = {
  saveFile,
  get garment() { return state.garment; },
  get productId() { return state.productId; },
  get productName() { return product().name; },
  garmentColors: GARMENT_COLORS,
  garmentName,
  setGarment,
  setProduct(id) { if (id !== state.productId && PRODUCTS.some((p) => p.id === id)) setProduct(id); },
  async addBlank(rec) {
    rec.print = defaultBlankPrint(rec);
    let stored = true;
    try { await idbPut(rec); } catch { stored = false; }
    registerBlank(rec);
    buildProductGrid();
    setProduct(rec.id);
    toast(stored ? `Saved “${rec.name}” to your blanks` : `Added “${rec.name}” for this session (browser storage is unavailable)`);
    return true;
  },
  removeBlank(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    askConfirm(`Remove “${p.name}” from your blanks?`, 'Remove').then(async (ok) => {
      if (!ok) return;
      try { await idbDel(id); } catch { /* ignore */ }
      PRODUCTS.splice(PRODUCTS.indexOf(p), 1);
      delete BAKED[id];
      const i = userBlanks.findIndex((r) => r.id === id);
      if (i >= 0) userBlanks.splice(i, 1);
      if (window.Viewer3D) window.Viewer3D.removeBlankModel(id);
      if (state.productId === id) setProduct('tee');
      buildProductGrid();
      toast('Blank removed');
    });
  },
  // Artwork-only print for a product side, clipped to that product's shape.
  getPrint(pid, view) {
    const saved = { p: state.productId, v: state.view };
    state.productId = pid === 'custom' && !state.custom ? 'custom' : pid;
    state.view = view;
    buildMask();
    const c = copyCanvas(composeArt(false));
    state.productId = saved.p;
    state.view = saved.v;
    buildMask();
    return c;
  },
  // Flat editor mockup of a product side.
  getPrintFile(pid, view) { return printFile(pid, view); },
  getMockup(pid, view) {
    const saved = { p: state.productId, v: state.view, sel: state.selectedId };
    state.productId = pid;
    state.view = view;
    state.selectedId = null;
    buildMask();
    drawScene(scratchCv.getContext('2d'), false);
    const c = copyCanvas(scratchCv);
    state.productId = saved.p;
    state.view = saved.v;
    state.selectedId = saved.sel;
    buildMask();
    return c;
  },
  // Add an uploaded drawing to a side, centred at (x, y) and fitted to `size`.
  placeImage(pid, view, src, x, y, size) {
    return removePaper(src).then((clean) => { src = clean; return loadImage(src); }).then((img) => {
      const L = layer(view);
      L.undo.push(snapshot(L));
      L.redo.length = 0;
      const k = Math.min(size / img.naturalWidth, size / img.naturalHeight);
      const o = { id: nextId++, type: 'image', src, img, w: img.naturalWidth * k, h: img.naturalHeight * k, x, y, rot: 0, scale: 1, flip: false, opacity: 1 };
      L.objects.push(o);
      if (view === state.view) state.selectedId = o.id;
      markDirty();
      render();
    });
  },
};

function showDesignMode() {
  $('#v3d').hidden = true;
}
function open3D(then) {
  const v = $('#v3d');
  const status = $('#v3dStatus');
  v.hidden = false;
  const go = () => window.Viewer3D.open(window.Viewer3D.models.includes(state.productId) ? state.productId : undefined)
    .then(() => then && then())
    .catch((e) => { console.error(e); toast('3D preview could not start. WebGL may be turned off in this browser.'); showDesignMode(); });
  if (window.Viewer3D) { go(); return; }
  status.textContent = 'Loading 3D studio…';
  status.hidden = false;
  const s = document.createElement('script');
  s.src = 'viewer3d.bundle.js';
  s.onload = () => { userBlanks.forEach((r) => window.Viewer3D.addBlankModel(r)); go(); };
  s.onerror = () => { status.hidden = true; showDesignMode(); toast('The 3D studio file is missing (viewer3d.bundle.js).'); };
  document.body.appendChild(s);
}
$('#modePreview').addEventListener('click', () => { if ($('#v3d').hidden) open3D(); });
$('#modeDesign').addEventListener('click', () => {
  if (window.Viewer3D && !$('#v3d').hidden) window.Viewer3D.close();
  else showDesignMode();
});
function syncMode() {
  const preview = !$('#v3d').hidden;
  $('#designView').hidden = preview;
  $('#modeDesign').classList.toggle('active', !preview);
  $('#modePreview').classList.toggle('active', preview);
  $('#modeDesign').setAttribute('aria-selected', String(!preview));
  $('#modePreview').setAttribute('aria-selected', String(preview));
}
const v3dObserver = new MutationObserver(() => { syncMode(); if ($('#v3d').hidden) { syncObjectPanel(); render(); } });
v3dObserver.observe($('#v3d'), { attributes: true, attributeFilter: ['hidden'] });

/* ---------------- boot ---------------- */
buildProductGrid();
buildGarmentSwatches();
buildSwatches($('#paintSwatches'), PAINT_COLORS, setPaintColor);
setPaintColor(state.color);
setSize(state.size);
$('#opacityVal').textContent = '100%';
setGarment(state.garment);
setProduct('tee');
setTool('brush');
dirty = false;

// start screen
const welcome = $('#welcome');
function openWelcome(fresh) {
  productCards($('#welcomeGrid'), (id) => {
    resetDesign(true);
    setProduct(id);
    setTool('brush');
    welcome.close();
    setSaveState('Draft');
  }, () => { welcome.close(); resetDesign(true); $('#productFile').click(); });
  $('#welcomeSkip').hidden = fresh || !hasDraft;
  $('#welcomeOpen').hidden = !readDesigns().length;
  if (!welcome.open) welcome.showModal();
}
let hasDraft = false;
$('#welcomeSkip').addEventListener('click', () => welcome.close());
$('#welcomeOpen').addEventListener('click', () => { openGallery(); });
welcome.addEventListener('cancel', (e) => { if (!hasDraft) e.preventDefault(); });

(async () => {
  await loadUserBlanks();
  if (userBlanks.length) buildProductGrid();
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(LS_DRAFT) || 'null'); } catch { /* no draft */ }
  hasDraft = !!(draft && Object.keys(draft.views || {}).length);
  if (hasDraft) {
    try { await loadDesign(draft); toast('Restored your last design'); return; } catch { hasDraft = false; }
  }
  openWelcome(false);
})();

if (document.fonts) document.fonts.ready.then(render);
window.addEventListener('resize', render);
