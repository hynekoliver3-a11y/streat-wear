# DRIPLAB — streetwear designer

Pick a product (T-shirt, crewneck, hoodie, joggers, cap, sneaker, tote) or upload your own, draw on it, then see it on a real 3D blank in a 360° view.

Real 3D blanks: **T-shirt, crewneck sweatshirt and sneaker**. The hoodie, joggers, cap and tote are 2D-only until a 3D model is added; you can load your own .glb of any product in the 360° view.

**Run it:** open `index.html` in a browser. No server or install needed; it works straight from disk.

## 360° view
Click **360° view** in the top bar.
- Your front and back artwork is projected onto a real 3D T-shirt or sneaker model, with fabric texture, folds and studio lighting.
- **Upload drawing:** add a photo or scan of a drawing. Plain paper backgrounds are removed automatically, so only the ink is printed.
- Drag to rotate, scroll or pinch to zoom, and use the Front / Left / Back / Right buttons, or let it spin.
- **Record 360° video** saves a 6-second turntable clip (MP4 or WebM, depending on the browser). **Screenshot** saves a PNG.
- **Download 3D file:** your designed product as a `.glb` 3D file. It opens in Blender, Windows 3D Viewer and most 3D apps.
- **Download all (.zip):** the 3D file, 5 studio renders, the print files and the flat mockups in one zip. The editor's Export menu also has this as **Product pack**.
- **Your 3D model (.glb):** load a real 3D model of any product (a scan or a bought model) and your artwork is printed on it.

In the 2D editor, the T-shirt and sneaker are renders of those same 3D models, so what you draw lines up with the 360° view.

## Editor features
- **Tools:** brush, spray, eraser, fill, line, rectangle, ellipse, color picker and mirror-symmetry drawing.
- **Text:** 9 fonts, with outline, curved (arc) text and letter spacing.
- **Images and stickers:** move, scale, rotate, flip, reorder, fade and duplicate them.
- **Saving:** undo and redo, automatic save of your current work, and a gallery of saved designs.
- **Export:** a mockup PNG, or a print file with a transparent background that holds only the artwork.

## Shortcuts
V move · B brush · S spray · E eraser · G fill · L line · R rect · O ellipse · T text · I picker · M mirror · `[` `]` size · Ctrl+Z / Ctrl+Shift+Z · Ctrl+S save · Ctrl+D duplicate · Delete · arrows nudge

## Development
- `npm install`, then `npm run build` rebuilds `viewer3d.bundle.js` from `src/viewer3d.js`. The bundle includes three.js and the models, so it works without a server.
- `npm run bake` re-renders the models into `products-baked.js` for the 2D editor. It needs Playwright with Chromium and Python 3 with `opencv-python-headless`.
- Model sources and licenses are listed in `models/README.md`.
