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

const HOODIE_BODY = 'M 205 105 C 195 25 405 25 395 105 L 470 125 Q 525 150 540 270 L 578 560 L 512 574 L 468 320 L 464 612 Q 300 628 136 612 L 132 320 L 88 574 L 22 560 L 60 270 Q 75 150 130 125 Z';
const HOODIE_COMMON = [
  { d: 'M 136 590 Q 300 606 464 590' },
  { d: 'M 136 600 Q 300 616 464 600', dash: true },
  { d: 'M 27 532 L 92 546' },
  { d: 'M 573 532 L 508 546' },
  { d: 'M 132 320 Q 128 200 130 125' },
  { d: 'M 468 320 Q 472 200 470 125' },
];

const JOGGER_BODY = 'M 165 60 L 435 60 L 452 330 L 468 625 Q 470 650 445 650 L 345 650 Q 325 650 324 630 L 305 270 L 295 270 L 276 630 Q 275 650 255 650 L 155 650 Q 130 650 132 625 L 148 330 Z';
const JOGGER_COMMON = [
  { d: 'M 167 100 L 433 100' },
  { d: 'M 167 92 L 433 92', dash: true },
  { d: 'M 136 600 L 272 600' },
  { d: 'M 328 600 L 464 600' },
];

const CAP_CROWN = 'M 130 390 C 120 170 480 170 470 390 Z';
const CAP_BRIM = 'M 95 385 Q 300 345 505 385 Q 525 455 300 465 Q 75 455 95 385 Z';

const TOTE_BAG = 'M 120 260 L 480 260 L 500 640 Q 500 652 488 652 L 112 652 Q 100 652 100 640 Z';
const TOTE_HANDLE = 'M 190 262 C 185 70 415 70 410 262 L 380 262 C 382 110 218 110 220 262 Z';

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

const PRODUCTS = [
  {
    id: 'tee', name: 'T-Shirt',
    views: [
      { key: 'front', label: 'Front', shape: [TEE_BODY], details: [
        { d: 'M 222 74 Q 300 140 378 74' }, ...TEE_HEMS ] },
      { key: 'back', label: 'Back', shape: [TEE_BACK], details: [
        { d: 'M 220 73 Q 300 108 380 73' }, ...TEE_HEMS ] },
    ],
  },
  {
    // shape comes from the real 3D model (products-baked.js)
    id: 'crewneck', name: 'Crewneck',
    views: [
      { key: 'front', label: 'Front', shape: [], details: [] },
      { key: 'back', label: 'Back', shape: [], details: [] },
    ],
  },
  {
    id: 'hoodie', name: 'Hoodie',
    views: [
      { key: 'front', label: 'Front', shape: [HOODIE_BODY], details: [
        { d: 'M 228 108 C 230 58 370 58 372 108 Q 300 160 228 108 Z', fill: 'rgba(0,0,0,0.22)' },
        { d: 'M 228 108 Q 300 160 372 108' },
        { d: 'M 272 140 L 264 255', w: 3 },
        { d: 'M 328 140 L 336 255', w: 3 },
        { d: 'M 195 455 L 405 455 L 435 575 L 165 575 Z' },
        { d: 'M 203 465 L 397 465', dash: true },
        ...HOODIE_COMMON ] },
      { key: 'back', label: 'Back', shape: [HOODIE_BODY], details: [
        { d: 'M 205 105 C 225 215 375 215 395 105' },
        { d: 'M 300 35 L 300 188', dash: true },
        ...HOODIE_COMMON ] },
    ],
  },
  {
    id: 'joggers', name: 'Joggers',
    views: [
      { key: 'front', label: 'Front', shape: [JOGGER_BODY], details: [
        { d: 'M 288 100 L 280 170', w: 3 },
        { d: 'M 312 100 L 320 170', w: 3 },
        { d: 'M 170 112 Q 212 150 224 205' },
        { d: 'M 430 112 Q 388 150 376 205' },
        { d: 'M 300 100 L 300 262', dash: true },
        ...JOGGER_COMMON ] },
      { key: 'back', label: 'Back', shape: [JOGGER_BODY], details: [
        { d: 'M 190 145 L 262 145 L 260 205 L 192 205 Z' },
        { d: 'M 338 145 L 410 145 L 408 205 L 340 205 Z' },
        { d: 'M 300 100 L 300 262' },
        ...JOGGER_COMMON ] },
    ],
  },
  {
    id: 'cap', name: 'Cap',
    views: [
      { key: 'front', label: 'Front', shape: [CAP_CROWN, CAP_BRIM], details: [
        { d: 'M 300 214 L 300 372' },
        { d: 'M 300 214 C 232 230 196 300 190 378' },
        { d: 'M 300 214 C 368 230 404 300 410 378' },
        { d: 'M 288 214 a 12 7 0 1 0 24 0 a 12 7 0 1 0 -24 0', fill: 'rgba(0,0,0,0.28)' },
        { d: 'M 130 388 Q 300 352 470 388' },
        { d: 'M 112 398 Q 300 362 488 398', dash: true },
        { d: 'M 108 418 Q 300 380 492 418', dash: true },
      ] },
      { key: 'back', label: 'Back', shape: [CAP_CROWN], details: [
        { d: 'M 300 214 L 300 330' },
        { d: 'M 300 214 C 232 230 196 300 190 388' },
        { d: 'M 300 214 C 368 230 404 300 410 388' },
        { d: 'M 288 214 a 12 7 0 1 0 24 0 a 12 7 0 1 0 -24 0', fill: 'rgba(0,0,0,0.28)' },
        { d: 'M 250 390 L 250 345 Q 250 318 300 318 Q 350 318 350 345 L 350 390 Z', fill: 'rgba(0,0,0,0.35)' },
        { d: 'M 236 366 L 364 366 L 364 384 L 236 384 Z', fill: 'rgba(0,0,0,0.25)' },
      ] },
    ],
  },
  {
    id: 'sneaker', name: 'Sneaker',
    views: [
      { key: 'front', label: 'Outer', shape: [SNEAKER], details: SNEAKER_DETAILS },
      { key: 'back', label: 'Inner', mirror: true, shape: [SNEAKER], details: SNEAKER_DETAILS },
    ],
  },
  {
    id: 'tote', name: 'Tote',
    views: [
      { key: 'front', label: 'Front', shape: [TOTE_BAG, TOTE_HANDLE], details: [
        { d: 'M 118 288 L 482 288', dash: true },
        { d: 'M 190 262 L 190 300 L 220 300 L 220 262', dash: true },
        { d: 'M 380 262 L 380 300 L 410 300 L 410 262', dash: true },
      ] },
      { key: 'back', label: 'Back', shape: [TOTE_BAG, TOTE_HANDLE], details: [
        { d: 'M 118 288 L 482 288', dash: true },
      ] },
    ],
  },
];
