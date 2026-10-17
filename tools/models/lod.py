"""Réduction de maillage par regroupement de sommets (clustering), poids de squelette conservés.
Sert à produire des versions LOD des personnages (foules, loin de la caméra)."""
import numpy as np
from glbkit import Mesh

def cluster_decimate(m, cell=0.03, uv_cell=None):
    uv_cell = uv_cell or cell * 3.5
    key = np.floor(m.V / cell).astype(np.int64)
    ukey = np.floor(m.UV / uv_cell).astype(np.int64)
    k = np.hstack([key, ukey])
    _, inv, cnt = np.unique(k, axis=0, return_inverse=True, return_counts=True)
    inv = inv.reshape(-1); n = len(cnt)
    def avg(a):
        out = np.zeros((n, a.shape[1])); np.add.at(out, inv, a); return out / cnt[:, None]
    # positions moyennées par cellule d'espace seule : les sommets dupliqués d'une couture (UV différents) restent soudés, pas de fente
    _, pinv, pcnt = np.unique(key, axis=0, return_inverse=True, return_counts=True); pinv = pinv.reshape(-1)
    pp = np.zeros((len(pcnt), 3)); np.add.at(pp, pinv, m.V); pp /= pcnt[:, None]
    V, UV, C = pp[pinv] if False else None, avg(m.UV), avg(m.C)
    Vc = np.zeros((n, 3)); np.add.at(Vc, inv, pp[pinv]); V = Vc / cnt[:, None]
    # poids : somme par os dans chaque groupe, on garde les 4 plus forts
    nb = max(4, int(m.J.max()) + 1)
    acc = np.zeros((n, nb))
    for c in range(4): np.add.at(acc, (inv, m.J[:, c]), m.W[:, c])
    J = np.argsort(-acc, axis=1)[:, :4]; W = np.take_along_axis(acc, J, axis=1)
    s = W.sum(1, keepdims=True); W = W / np.maximum(s, 1e-9); W[s[:, 0] <= 0] = [1.0, 0, 0, 0]
    F = inv[m.F]
    ok = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    F = F[ok]
    srt = np.sort(F, axis=1)
    _, first = np.unique(srt, axis=0, return_index=True)
    F = F[np.sort(first)]
    used = np.unique(F); remap = -np.ones(n, np.int64); remap[used] = np.arange(len(used))
    return Mesh(V[used], remap[F], UV[used], J[used], W[used], C[used])
