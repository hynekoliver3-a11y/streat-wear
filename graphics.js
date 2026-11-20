// Vector graphics for the "Graphics" library. {{c}} is replaced by the chosen color.
'use strict';

const GRAPHICS = [
  { id: 'star', name: 'Star', svg: '<polygon fill="{{c}}" points="50,4 61,37 96,37 68,58 79,93 50,72 21,93 32,58 4,37 39,37"/>' },
  { id: 'sparkle', name: 'Sparkle', svg: '<path fill="{{c}}" d="M50 2C53 33 67 47 98 50C67 53 53 67 50 98C47 67 33 53 2 50C33 47 47 33 50 2Z"/>' },
  { id: 'bolt', name: 'Bolt', svg: '<polygon fill="{{c}}" points="60,2 16,58 46,58 34,98 84,38 54,38 68,2"/>' },
  { id: 'heart', name: 'Heart', svg: '<path fill="{{c}}" d="M50 90C20 68 4 52 4 31C4 15 16 5 30 5C40 5 47 11 50 18C53 11 60 5 70 5C84 5 96 15 96 31C96 52 80 68 50 90Z"/>' },
  { id: 'crown', name: 'Crown', svg: '<path fill="{{c}}" d="M8 78L4 22L30 46L50 10L70 46L96 22L92 78Z"/><rect fill="{{c}}" x="8" y="83" width="84" height="11" rx="2"/>' },
  { id: 'flame', name: 'Flame', svg: '<path fill="{{c}}" d="M50 98C25 98 11 81 13 61C15 44 29 35 31 17C41 27 43 37 41 47C49 37 54 21 51 2C73 18 90 42 88 64C86 84 73 98 50 98Z"/>' },
  { id: 'smiley', name: 'Smiley', svg: '<defs><mask id="m"><rect width="100" height="100" fill="#fff"/><ellipse cx="35" cy="38" rx="6" ry="10" fill="#000"/><ellipse cx="65" cy="38" rx="6" ry="10" fill="#000"/><path d="M26 58Q50 84 74 58" stroke="#000" stroke-width="8" fill="none" stroke-linecap="round"/></mask></defs><circle cx="50" cy="50" r="47" fill="{{c}}" mask="url(#m)"/>' },
  { id: 'peace', name: 'Peace', svg: '<g fill="none" stroke="{{c}}" stroke-width="9" stroke-linecap="round"><circle cx="50" cy="50" r="42"/><path d="M50 8V92M50 52L21 81M50 52L79 81"/></g>' },
  { id: 'cross', name: 'Cross', svg: '<path fill="{{c}}" d="M42 3H58V29H82V45H58V97H42V45H18V29H42Z"/>' },
  { id: 'flower', name: 'Flower', svg: '<defs><mask id="f"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="9" fill="#000"/></mask></defs><g fill="{{c}}" mask="url(#f)"><circle cx="50" cy="22" r="20"/><circle cx="76" cy="41" r="20"/><circle cx="66" cy="73" r="20"/><circle cx="34" cy="73" r="20"/><circle cx="24" cy="41" r="20"/><circle cx="50" cy="50" r="18"/></g>' },
  { id: 'checker', name: 'Checker', svg: '<g fill="{{c}}"><rect x="0" y="0" width="25" height="25"/><rect x="50" y="0" width="25" height="25"/><rect x="25" y="25" width="25" height="25"/><rect x="75" y="25" width="25" height="25"/><rect x="0" y="50" width="25" height="25"/><rect x="50" y="50" width="25" height="25"/><rect x="25" y="75" width="25" height="25"/><rect x="75" y="75" width="25" height="25"/></g>' },
  { id: 'barcode', name: 'Barcode', svg: '<g fill="{{c}}"><rect x="4" y="12" width="5" height="76"/><rect x="12" y="12" width="2" height="76"/><rect x="17" y="12" width="7" height="76"/><rect x="27" y="12" width="3" height="76"/><rect x="33" y="12" width="2" height="76"/><rect x="38" y="12" width="8" height="76"/><rect x="49" y="12" width="3" height="76"/><rect x="55" y="12" width="5" height="76"/><rect x="63" y="12" width="2" height="76"/><rect x="68" y="12" width="7" height="76"/><rect x="78" y="12" width="3" height="76"/><rect x="84" y="12" width="2" height="76"/><rect x="89" y="12" width="7" height="76"/></g>' },
  { id: 'arrow', name: 'Arrow', svg: '<polygon fill="{{c}}" points="2,38 58,38 58,14 98,50 58,86 58,62 2,62"/>' },
  { id: 'ring', name: 'Badge ring', svg: '<g fill="none" stroke="{{c}}"><circle cx="50" cy="50" r="45" stroke-width="5"/><circle cx="50" cy="50" r="34" stroke-width="2"/></g>' },
  { id: 'wings', name: 'Wing', svg: '<path fill="{{c}}" d="M96 30C70 26 44 30 20 46C30 46 38 45 46 43C34 51 24 58 12 70C26 68 38 63 48 57C42 65 36 72 28 80C48 74 66 64 80 50C88 42 94 36 96 30Z"/>' },
  { id: 'splat', name: 'Splat', svg: '<path fill="{{c}}" d="M50 14C58 14 60 4 66 6C72 8 66 20 72 24C78 28 88 18 92 24C96 30 84 36 86 44C88 52 98 52 96 60C94 68 82 62 78 70C74 78 82 90 74 94C66 98 62 84 54 86C46 88 44 98 36 96C28 94 34 82 28 76C22 70 8 76 6 68C4 60 16 58 16 50C16 42 4 38 8 30C12 22 24 30 30 24C36 18 30 8 38 6C44 4 44 14 50 14Z"/><circle fill="{{c}}" cx="88" cy="8" r="5"/><circle fill="{{c}}" cx="10" cy="90" r="4"/><circle fill="{{c}}" cx="94" cy="86" r="3"/>' },
];

function graphicSvg(g, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400">${g.svg.split('{{c}}').join(color)}</svg>`;
}
function graphicDataUrl(g, color) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(graphicSvg(g, color));
}
