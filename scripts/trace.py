# Traces the outer silhouette of a baked mask (RGBA PNG at 2x) into an SVG path in editor units.
import sys
import cv2
import numpy as np

img = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED)
alpha = img[:, :, 3]
m = (alpha > 127).astype(np.uint8) * 255
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
parts = []
for c in sorted(contours, key=cv2.contourArea, reverse=True):
    if cv2.contourArea(c) < 400:
        continue
    ap = cv2.approxPolyDP(c, 1.6, True)[:, 0, :] / 2.0
    parts.append('M ' + ' L '.join(f'{x:g} {y:g}' for x, y in ap) + ' Z')
print(' '.join(parts))
