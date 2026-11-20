# DRIPLAB Studio

Design streetwear on real 3D blanks, check it from every angle, then download print files and the 3D file.

**Use it:** open `index.html` in a browser (it works straight from disk, no install), or publish it with GitHub Pages (below).

## What you can do
1. **Pick a blank.** The T-shirt, crewneck sweatshirt and sneaker are real 3D garment models; the editor shows renders of the same models, tinted to any of 14 standard blank colors. **Your own** takes a photo or PNG of any product.
2. **Design it.**
   - Tools: brush, spray, eraser, fill, shapes, color picker and mirror drawing.
   - **Add text:** 6 ready-made styles (headline, wide, gothic, script, marker, varsity arc), with outline, arc and letter spacing.
   - **Graphics:** 16 vector graphics that take your paint color, and can be recolored later.
   - **Upload:** a logo, image, or a photo or scan of a drawing. Plain paper backgrounds are removed automatically.
   - **Print-area guide:** a dashed box shows the real printable area (12 × 16 in on shirts), and the panel shows each element's size in inches.
3. **3D Preview.** Spin the product, snap to front, left, back or right, change the garment color or sneaker colorway, and record a 6-second 360° video.
4. **Download.**
   - **Product pack (.zip):** the 3D file, 5 studio renders, print files and mockups.
   - **3D file (.glb):** opens in Blender, Windows 3D Viewer and most 3D apps.
   - **Print file:** artwork only on a transparent background, 1200 × 1400 px.
   - **Mockups:** flat product images, PNG.

Designs autosave in the browser, and **Save** keeps them in **File → My designs**. Press `?` in the app for keyboard shortcuts.

## Publish with GitHub Pages
The workflow in `.github/workflows/pages.yml` deploys the app on every push to `main`. Turn it on once: repository **Settings → Pages → Source: GitHub Actions**. The app is then at `https://<user>.github.io/streat-wear/`.

## Development
- `npm install`, then `npm run build` rebuilds `viewer3d.bundle.js` from `src/viewer3d.js`. The bundle includes three.js and the models, so it works without a server.
- `npm run bake` re-renders the 3D models into `products-baked.js` for the 2D editor. It needs Playwright with Chromium and Python 3 with `opencv-python-headless`.
- Model sources and licenses are listed in `models/README.md`. The T-shirt and crewneck models have no documented original author, so replace them before any commercial use.
