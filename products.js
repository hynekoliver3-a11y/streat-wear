// Product silhouettes, drawn in a 600 x 700 coordinate space.
// shape:   SVG path strings filled with the garment color (also the clip mask).
// details: seams / pockets / ribbing drawn on top of the artwork.
//          { d, dash?: true, w?: lineWidth, fill?: css color }
'use strict';

const TEE_BODY = 'M 215 70 Q 300 125 385 70 L 470 95 Q 520 115 560 205 L 480 250 L 455 215 L 458 640 Q 300 652 142 640 L 145 215 L 120 250 L 40 205 Q 80 115 130 95 Z';
const TEE_BACK = 'M 215 70 Q 300 92 385 70 L 470 95 Q 520 115 560 205 L 480 250 L 455 215 L 458 640 Q 300 652 142 640 L 145 215 L 120 250 L 40 205 Q 80 115 130 95 Z';
const TEE_HEMS = [
  { d: 'M 49 194 L 129 239', dash: true },
  { d: 'M 551 194 L 471 239', dash: true },
  { d: 'M 143 624 Q 300 636 457 624', dash: true },
  { d: 'M 145 215 Q 140 150 130 95' },
  { d: 'M 455 215 Q 460 150 470 95' },
];

const SNEAKER = 'M 70 520 L 62 360 Q 62 330 95 328 Q 150 330 200 350 Q 235 300 275 288 Q 300 285 310 305 L 360 345 Q 430 390 510 405 Q 575 418 582 470 L 585 515 Q 585 548 552 548 L 95 548 Q 66 548 70 520 Z';
const SNEAKER_DETAILS = [
  { d: 'M 66 492 L 584 492 L 585 515 Q 585 548 552 548 L 95 548 Q 66 548 70 520 Z', fill: 'rgba(255,255,255,0.55)' },
  { d: 'M 68 506 L 584 506', dash: true },
  { d: 'M 470 492 Q 478 425 540 412' },
  { d: 'M 64 400 Q 140 398 152 492' },
  { d: 'M 285 300 Q 380 382 470 398' },
  { d: 'M 300 318 L 328 300', w: 4 },
  { d: 'M 325 338 L 353 318', w: 4 },
  { d: 'M 350 356 L 378 336', w: 4 },
  { d: 'M 378 372 L 404 352', w: 4 },
  { d: 'M 95 328 Q 150 336 200 350', dash: true },
];

// Real 3D blanks only. Their 2D silhouettes and shading come from products-baked.js.
const PRODUCTS = [
  {
    id: 'tee', name: 'T-shirt', blurb: 'Short sleeve', kind: 'top',
    // print areas in editor units; ppi = editor units per inch on this blank
    ppi: 14,
    print: { front: [216, 140, 168, 224], back: [216, 122, 168, 224] },
    views: [
      { key: 'front', label: 'Front', shape: [TEE_BODY], details: [
        { d: 'M 222 74 Q 300 140 378 74' }, ...TEE_HEMS ] },
      { key: 'back', label: 'Back', shape: [TEE_BACK], details: [
        { d: 'M 220 73 Q 300 108 380 73' }, ...TEE_HEMS ] },
    ],
  },
  {
    // shape comes from the real 3D model (products-baked.js)
    id: 'crewneck', name: 'Crewneck', blurb: 'Sweatshirt', kind: 'top',
    ppi: 13.6,
    print: { front: [218, 165, 164, 218], back: [218, 140, 164, 218] },
    views: [
      { key: 'front', label: 'Front', shape: [], details: [] },
      { key: 'back', label: 'Back', shape: [], details: [] },
    ],
  },
  {
    id: 'sneaker', name: 'Sneaker', blurb: 'Knit runner', kind: 'shoe',
    ppi: 48,
    print: { front: [200, 392, 240, 84], back: [160, 392, 240, 84] },
    views: [
      { key: 'front', label: 'Outer', shape: [SNEAKER], details: SNEAKER_DETAILS },
      { key: 'back', label: 'Inner', mirror: true, shape: [SNEAKER], details: SNEAKER_DETAILS },
    ],
  },
];

// Print-area presets (inches). anchor: where the area sits relative to the blank's default area.
const PRINT_PRESETS = {
  top: [
    { id: 'standard', name: 'Standard 12 × 16 in', w: 12, h: 16 },
    { id: 'large', name: 'Large 14 × 16 in', w: 14, h: 16 },
    { id: 'max', name: 'Maximum 15 × 18 in', w: 15, h: 18 },
    { id: 'chest', name: 'Left chest 4 × 4 in', w: 4, h: 4, anchor: 'leftchest', views: ['front'] },
    { id: 'strip', name: 'Chest strip 11 × 3 in', w: 11, h: 3 },
    { id: 'yoke', name: 'Upper back 12 × 4 in', w: 12, h: 4, views: ['back'] },
  ],
  bottom: [
    { id: 'leg', name: 'Leg 4 × 12 in', w: 4, h: 12, anchor: 'leftleg' },
    { id: 'thigh', name: 'Thigh 4 × 4 in', w: 4, h: 4, anchor: 'leftleg' },
    { id: 'hip', name: 'Hip 3 × 3 in', w: 3, h: 3, anchor: 'leftleg' },
  ],
  shorts: [
    { id: 'thigh', name: 'Thigh 4 × 4 in', w: 4, h: 4, anchor: 'leftleg' },
    { id: 'legs', name: 'Leg 4 × 6 in', w: 4, h: 6, anchor: 'leftleg' },
    { id: 'hip', name: 'Hip 3 × 3 in', w: 3, h: 3, anchor: 'leftleg' },
  ],
  other: [
    { id: 'large', name: 'Large 10 × 10 in', w: 10, h: 10 },
    { id: 'medium', name: 'Medium 6 × 6 in', w: 6, h: 6 },
    { id: 'small', name: 'Small 3 × 3 in', w: 3, h: 3 },
  ],
  shoe: [
    { id: 'side', name: 'Side panel 5 × 1.75 in', w: 5, h: 1.75 },
    { id: 'small', name: 'Small logo 2 × 1 in', w: 2, h: 1 },
  ],
};
