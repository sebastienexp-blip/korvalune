"""Textures HD (profil « Ultra ») — agrandit les textures du jeu et leur ajoute du détail fin propre à chaque matière.

Les textures d'origine sont procédurales et lisses (512–1024 px). Ici chacune est :
  1. agrandie (interpolation bicubique, SANS COUTURE : l'image est prolongée par enroulement avant le calcul) ;
  2. enrichie d'un détail synthétisé à l'échelle fine (grain de pierre, fibres de bois, tissage, pores du cuir, rayures du métal…),
     modulant la couleur d'origine (même teinte, même composition, plus de relief) ;
  3. pour les cartes de normales : le détail devient un micro-relief ajouté à la normale d'origine ;
     pour les cartes métal/rugosité : la rugosité varie légèrement avec le grain.
Ce n'est PAS de la photo : c'est un détail procédural ajouté par script, déterministe (graine fixe), reproductible.

  python3 tools/models/hd_textures.py public/models/tex public/models/tex_hd [nom ...]
Écrit tex_hd/<nom>.webp et tex_hd/index.json {nom d'origine : fichier HD, taille}.
"""
import sys, os, json, re, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFile
ImageFile.MAXBLOCK = 1 << 28

# ---------------------------------------------------------------------------------------------- tailles
# (cartes de couleur, cartes normales / métal-rugosité) selon la famille
WORLD = (4096, 2560)       # sol, murs, nature : ce qu'on voit tout le temps
CHARS = (2560, 2048)       # armures, vêtements, poils, os


def divisor_near(n, k):
    best = 1
    for d in range(1, n + 1):
        if n % d == 0 and abs(d - k) < abs(best - k): best = d
    return best


def snoise(h, w, fy, fx, rng):
    """Bruit lisse SANS COUTURE, de taille de motif (fy, fx) pixels, écart-type ≈ 1."""
    if fy <= 1.6 and fx <= 1.6:
        n = rng.standard_normal((h, w)).astype(np.float32)
        return n
    gh = divisor_near(h, max(2, h / fy)); gw = divisor_near(w, max(2, w / fx))
    g = rng.standard_normal((gh, gw)).astype(np.float32)
    p = 2
    gp = np.pad(g, p, mode='wrap')
    sy, sx = h // gh, w // gw
    im = Image.fromarray(gp, mode='F').resize(((gw + 2 * p) * sx, (gh + 2 * p) * sy), Image.BICUBIC)
    a = np.asarray(im)[p * sy:p * sy + h, p * sx:p * sx + w].copy()
    a /= max(float(a.std()), 1e-6)
    return a


def fbm(h, w, octs, rng):
    """octs : [(fy, fx, amplitude)…] → bruit multi-échelle, écart-type ≈ 1."""
    out = np.zeros((h, w), np.float32)
    for fy, fx, a in octs:
        out += a * snoise(h, w, fy, fx, rng)
    return out / max(float(out.std()), 1e-6)


def scratches(h, w, rng, n, length, width=1, dark=False):
    """Fines rayures (lignes aléatoires, enroulées aux bords) → carte 0..1."""
    im = Image.new('L', (w, h), 0); d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        L = rng.uniform(*length) * w; ang = rng.normal(0, 0.45) + (np.pi / 2 if rng.random() < 0.22 else 0)
        dx, dy = np.cos(ang) * L, np.sin(ang) * L
        v = int(rng.uniform(90, 255))
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                d.line([(x + ox, y + oy), (x + ox + dx, y + oy + dy)], fill=v, width=width)
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255.0
    return a


def upscale(arr, size, wrap=True):
    """arr : float32 H×W×C (0..1) → size×size (ou proportionnel). Sans couture si wrap."""
    h, w = arr.shape[:2]
    tw = size; th = int(round(size * h / w))
    p = max(8, h // 32) if wrap else 0
    a = np.pad(arr, ((p, p), (p, p), (0, 0)), mode='wrap' if wrap else 'edge') if p else arr
    out = []
    for c in range(arr.shape[2]):
        im = Image.fromarray(np.ascontiguousarray(a[:, :, c]), mode='F')
        im = im.resize((int(round((w + 2 * p) * tw / w)), int(round((h + 2 * p) * th / h))), Image.BICUBIC)
        out.append(np.asarray(im))
    o = np.stack(out, -1)
    if p:
        py, px = int(round(p * th / h)), int(round(p * tw / w))
        o = o[py:py + th, px:px + tw]
    return np.ascontiguousarray(o)


def unsharp(arr, radius, amount):
    """Netteté légère (les arêtes agrandies redeviennent franches)."""
    out = np.empty_like(arr)
    for c in range(arr.shape[2]):
        im = Image.fromarray(np.clip(arr[:, :, c] * 255, 0, 255).astype(np.uint8))
        out[:, :, c] = np.asarray(im.filter(ImageFilter.UnsharpMask(radius=radius, percent=int(amount * 100), threshold=0)), np.float32) / 255.0
    return out


# ---------------------------------------------------------------------------------------------- recettes de matière
# chaque recette renvoie (d, amp) : d = détail (écart-type 1, moyenne 0) ; amp = amplitude de modulation de la couleur
def detail(kind, h, w, rng):
    S = w / 1024.0                       # les motifs gardent la même taille *physique* quelle que soit la définition
    f = lambda px: max(1.0, px * S)
    if kind == 'terrain':                # sol : gravillons, terre, brindilles
        d = fbm(h, w, [(f(70), f(70), .5), (f(26), f(26), .7), (f(9), f(9), .8), (f(3.2), f(3.2), .8), (1, 1, .55)], rng)
        pits = (snoise(h, w, f(2.2), f(2.2), rng) > 1.9).astype(np.float32)
        return d - 1.2 * pits, 0.30
    if kind == 'pierre':                 # pierre de taille : grain, porosité, éclats
        d = fbm(h, w, [(f(48), f(48), .6), (f(16), f(16), .7), (f(5), f(5), .8), (f(2), f(2), .8), (1, 1, .6)], rng)
        pits = (snoise(h, w, f(1.8), f(1.8), rng) > 2.0).astype(np.float32)
        return d - 1.4 * pits, 0.30
    if kind == 'bois':                   # planches : fil du bois, nœuds fins
        d = fbm(h, w, [(f(300), f(3.0), .8), (f(120), f(1.6), .8), (f(40), f(1.2), .6), (f(6), f(6), .3)], rng)
        cracks = (snoise(h, w, f(260), f(1.2), rng) > 2.0).astype(np.float32)
        return d - 1.2 * cracks, 0.20
    if kind == 'plaster':                # crépi : sable fin
        d = fbm(h, w, [(f(40), f(40), .3), (f(8), f(8), .5), (f(2.6), f(2.6), .9), (1, 1, .8)], rng)
        return d, 0.16
    if kind == 'tuile':                  # tuiles : grain minéral, mousse claire
        d = fbm(h, w, [(f(36), f(36), .5), (f(10), f(10), .7), (f(3), f(3), .9), (1, 1, .6)], rng)
        return d, 0.26
    if kind in ('steel', 'trim'):        # métal : rayures de polissage, micro-piqûres, grain directionnel
        d = fbm(h, w, [(f(160), f(5), .8), (f(60), f(2.2), .8), (f(20), f(10), .5), (1, 1, .35)], rng)
        sc = scratches(h, w, rng, int(260 * S * S * 4) + 120, (0.01, 0.12))
        sc2 = scratches(h, w, rng, int(60 * S * S * 4) + 30, (0.03, 0.2))
        pits = (snoise(h, w, f(1.6), f(1.6), rng) > 2.3).astype(np.float32)
        return d + 2.2 * sc + 1.6 * sc2 - 1.4 * pits, (0.17 if kind == 'steel' else 0.12)
    if kind == 'leather':                # cuir : pores, plis, usure
        pores = np.abs(snoise(h, w, f(5), f(5), rng)); creases = np.abs(snoise(h, w, f(90), f(22), rng))
        d = fbm(h, w, [(f(40), f(40), .4), (f(12), f(12), .6), (f(3.4), f(3.4), .7), (1, 1, .5)], rng)
        d = d - 1.6 * (pores < 0.18) - 1.0 * (creases < 0.12)
        return d + 1.4 * scratches(h, w, rng, int(80 * S * S * 4) + 40, (0.02, 0.1)), 0.24
    if kind == 'cloth':                  # tissu : tissage chaîne/trame + fibres
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        p = max(3.0, 5.0 * S)
        warp = np.sin(2 * np.pi * xx / p) * (np.sin(2 * np.pi * yy / (2 * p)) > 0)
        weft = np.sin(2 * np.pi * yy / p) * (np.sin(2 * np.pi * xx / (2 * p)) <= 0)
        weave = (warp + weft).astype(np.float32)
        fib = fbm(h, w, [(f(14), f(1.4), .7), (f(1.4), f(14), .7), (1, 1, .4)], rng)
        return 0.9 * weave + 0.7 * fib, 0.16
    if kind == 'hair':                   # cheveux : mèches très fines
        d = fbm(h, w, [(f(220), f(2.0), .8), (f(80), f(1.2), .9), (f(20), f(5), .4)], rng)
        return d, 0.34
    if kind == 'fur':                    # fourrure : poils et touffes
        d = fbm(h, w, [(f(120), f(3.0), .7), (f(60), f(1.4), .9), (f(14), f(1.1), .8), (1, 1, .4)], rng)
        return d, 0.38
    if kind == 'bone':                   # os : fibres, fissures
        d = fbm(h, w, [(f(70), f(7), .6), (f(18), f(2.6), .7), (f(4), f(4), .5), (1, 1, .4)], rng)
        sc = scratches(h, w, rng, int(70 * S * S * 4) + 30, (0.02, 0.14))
        return d - 1.2 * sc, 0.20
    return fbm(h, w, [(f(16), f(16), .5), (f(4), f(4), .8), (1.5, 1.5, .6)], rng), 0.10


KINDS = [('terrain', 'terrain'), ('pierre', 'pierre'), ('bois', 'bois'), ('plaster', 'plaster'), ('tuile', 'tuile'), ('steel', 'steel'), ('trim', 'trim'),
         ('leather', 'leather'), ('cloth', 'cloth'), ('hair', 'hair'), ('fur', 'fur'), ('bone', 'bone')]
FAMILY_WORLD = ('terrain', 'pierre', 'bois', 'plaster', 'tuile', 'nature')


def classify(name):
    base = re.sub(r'^[0-9a-f]{6}_', '', name)
    for key, kind in KINDS:
        if key in base: return kind
    if base.startswith('nature'): return 'nature'
    return None


def role_of(name):
    return 'normal' if '_normal' in name else 'orm' if 'metalrough' in name else 'base'


def seed_of(name):
    s = 2166136261
    for ch in name:
        s = ((s ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return s


def process(src, dst_dir, name):
    kind = classify(name); role = role_of(name)
    if kind is None: return None
    world = kind in FAMILY_WORLD
    csize, nsize = WORLD if world else CHARS
    size = csize if role == 'base' else nsize
    img = Image.open(os.path.join(src, name))
    atlas = kind == 'nature'
    has_alpha = img.mode in ('RGBA', 'LA')
    arr = np.asarray(img.convert('RGBA' if has_alpha else 'RGB'), np.float32) / 255.0
    rng = np.random.default_rng(seed_of(name))
    big = upscale(arr, size, wrap=not atlas)
    H, W = big.shape[:2]
    rgb = big[:, :, :3]
    if role == 'base':
        rgb = unsharp(rgb, radius=max(1.2, size / 1024 * 0.9), amount=0.7)
        if atlas:                         # atlas de nature : 4 cases de matière en haut (écorce, bouleau, roche, bois mort), feuillages en bas
            d = np.zeros((H, W), np.float32); amp = np.zeros((H, W), np.float32)
            cw, ch = W // 4, H // 2
            for i, k in enumerate(['bois', 'plaster', 'pierre', 'bois']):
                dd, a = detail(k, ch, cw, np.random.default_rng(seed_of(name) + i))
                d[:ch, i * cw:(i + 1) * cw] = dd; amp[:ch, i * cw:(i + 1) * cw] = a * (0.9 if i != 1 else 0.7)
            dd, a = detail('plaster', ch, W, np.random.default_rng(seed_of(name) + 9))
            d[ch:, :] = dd; amp[ch:, :] = 0.07
        else:
            d, amp0 = detail(kind, H, W, rng); amp = amp0
        mod = 1.0 + amp * np.clip(d, -3.2, 3.2) * 0.42
        rgb = np.clip(rgb * (mod[:, :, None] if not np.isscalar(amp) or True else mod), 0, 1)
        lum = rgb.mean(2, keepdims=True)
        rgb = np.clip(lum + (rgb - lum) * (1.0 + 0.04 * np.clip(d, -2, 2)[:, :, None]), 0, 1)   # très légère variation de teinte avec le grain
        big[:, :, :3] = rgb
        out = np.clip(big * 255 + 0.5, 0, 255).astype(np.uint8)
        im = Image.fromarray(out, 'RGBA' if has_alpha else 'RGB')
        fn = os.path.splitext(name)[0] + '.webp'
        im.save(os.path.join(dst_dir, fn), 'WEBP', quality=88, alpha_quality=100, method=4)
        return fn, im.size
    # normales / métal-rugosité : même détail que la couleur (même graine de recette → même relief)
    d, amp = detail(kind, H, W, np.random.default_rng(seed_of(re.sub(r'_(normal|metalrough)', '_basecolor', name))))
    if role == 'normal':
        n = big[:, :, :3] * 2 - 1
        k = {'terrain': 0.9, 'pierre': 1.0, 'bois': 0.8, 'plaster': 0.5, 'tuile': 0.8, 'steel': 0.7, 'trim': 0.5, 'leather': 0.9, 'cloth': 0.8, 'hair': 0.6, 'fur': 0.7, 'bone': 0.7}.get(kind, 0.6)
        gy, gx = np.gradient(np.clip(d, -3, 3).astype(np.float32))
        sc = 1.6 * (size / 1024.0)
        n[:, :, 0] -= k * sc * gx; n[:, :, 1] -= k * sc * gy
        n /= np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-6)
        big[:, :, :3] = n * 0.5 + 0.5
        quality, sub = 92, 0
    else:
        g = big[:, :, 1] + 0.07 * np.clip(d, -3, 3) * (1 if kind != 'cloth' else 1.3)
        big[:, :, 1] = np.clip(g, 0, 1)
        quality, sub = 90, 0
    out = np.clip(big[:, :, :3] * 255 + 0.5, 0, 255).astype(np.uint8)
    im = Image.fromarray(out, 'RGB')
    fn = os.path.splitext(name)[0] + '.webp'
    im.save(os.path.join(dst_dir, fn), 'WEBP', quality=quality - 2, method=4)
    return fn, im.size


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    only = sys.argv[3:]
    os.makedirs(dst, exist_ok=True)
    idx_path = os.path.join(dst, 'index.json')
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    names = sorted(f for f in os.listdir(src) if f.lower().endswith(('.jpg', '.png')))
    for n in names:
        if only and not any(o in n for o in only): continue
        t0 = time.time()
        r = process(src, dst, n)
        if not r: continue
        index[n] = {'f': r[0], 'w': r[1][0], 'h': r[1][1]}
        json.dump(index, open(idx_path, 'w'), indent=0)
        print(f'{n:34s} -> {r[0]:30s} {r[1][0]}x{r[1][1]}  {os.path.getsize(os.path.join(dst, r[0])) // 1024:6d} Ko  {time.time() - t0:4.0f}s', flush=True)
