"""V10.78 : textures de sol « standard » (hors profil Ultra) plus riches : le détail d'origine était presque uniforme (écart-type ≈ 9 %)."""
import sys, os, numpy as np
from PIL import Image
import hd_textures as H
dst = sys.argv[1]
rng = np.random.default_rng(H.seed_of('terrain_detail.jpg'))
d, amp = H.detail('terrain', 2048, 2048, rng)
mod = 1.0 + amp * np.clip(d, -3.2, 3.2) * 0.42
g = np.clip(0.653 * mod, 0, 1)
Image.fromarray(np.clip(g * 255 + .5, 0, 255).astype(np.uint8), 'L').convert('RGB').save(os.path.join(dst, 'terrain_detail.jpg'), quality=86)
dn, _ = H.detail('terrain', 1024, 1024, np.random.default_rng(H.seed_of('terrain_detail.jpg')))
gy, gx = np.gradient(np.clip(dn, -3, 3).astype(np.float32))
n = np.zeros((1024, 1024, 3), np.float32); n[:, :, 2] = 1
n[:, :, 0] -= 0.9 * 1.6 * gx; n[:, :, 1] -= 0.9 * 1.6 * gy
n /= np.linalg.norm(n, axis=2, keepdims=True)
Image.fromarray(np.clip((n * .5 + .5) * 255 + .5, 0, 255).astype(np.uint8)).save(os.path.join(dst, 'terrain_normal.png'), optimize=True)
