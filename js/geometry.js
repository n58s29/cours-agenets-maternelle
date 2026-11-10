/* ==========================================================================
   geometry.js — Outils de calcul, positions autorisées, bilan des surfaces
   Le bilan est calculé sur une grille de 0,5 m posée sur la cour.
   ========================================================================== */
(function (C) {
  "use strict";
  const G = C.GEO, T = C.TYPES, CFG = C.CONFIG;

  /* ---------- Utilitaires ---------- */
  const U = C.util = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    r1: v => Math.round(v * 10) / 10,
    r2: v => Math.round(v * 100) / 100,
    fr: (v, d = 1) => Number(v).toFixed(d).replace(".", ","),
    num: v => typeof v === "number" && isFinite(v),
    inPoly(x, y, p) {
      let c = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i], [xj, yj] = p[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    },
    dseg(x, y, a, b) {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
      let t = l ? ((x - a[0]) * dx + (y - a[1]) * dy) / l : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
    },
    bbox(p) {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      p.forEach(([x, y]) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); });
      return [a, b, c, d];
    }
  };

  /* ---------- Libellés ---------- */
  C.label = o => {
    const t = T[o.type];
    return t ? t.n + (t.c === "exist" ? " (existant)" : "") : "Élément";
  };
  C.dimText = (o, areas) => {
    if (o.kind === "item") {
      const t = T[o.type];
      return t.round ? `⌀ ${U.fr(o.w)} m` : `${U.fr(o.w)} × ${U.fr(o.h)} m`;
    }
    const a = areas && areas.get(o.id);
    return a != null ? `≈ ${Math.round(a)} m²` : "zone peinte";
  };

  /* ---------- Positions autorisées ---------- */
  const okPos = (x, y) => U.inPoly(x, y, G.COUR) && !U.inPoly(x, y, G.BLD1) && !U.inPoly(x, y, G.BLD0);

  function nearStroke(o, x, y, r) {
    const p = o.pts;
    if (!p || !p.length) return false;
    if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]) <= r;
    for (let i = 1; i < p.length; i++) if (U.dseg(x, y, p[i - 1], p[i]) <= r) return true;
    return false;
  }

  function covers(o, x, y) {
    if (o.kind === "zone") return nearStroke(o, x, y, o.w / 2);
    const dx = x - o.x, dy = y - o.y, a = o.rot * Math.PI / 180;
    const lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
    return T[o.type].round ? lx * lx + ly * ly <= o.w * o.w / 4 : Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.h / 2;
  }

  /* ---------- Grille de calcul ---------- */
  const CS = .5, NX = Math.ceil(G.VBW / CS), NY = Math.ceil(G.VBH / CS), N = NX * NY;
  const mask = new Uint8Array(N), shade0 = new Float32Array(N);
  let area = 0, shade0Area = 0;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const x = (i + .5) * CS, y = (j + .5) * CS;
      if (!U.inPoly(x, y, G.COUR)) continue;
      mask[j * NX + i] = 1;
      area += CS * CS;
      if (G.TREES.some(([tx, ty, r]) => (x - tx) ** 2 + (y - ty) ** 2 <= r * r)) {
        shade0[j * NX + i] = 1;
        shade0Area += CS * CS;
      }
    }
  }
  const PERM0 = CFG.permInitial.m2 * area / CFG.permInitial.sur;

  function stats(objs) {
    const perm = new Float32Array(N), shade = new Float32Array(N);
    shade.set(shade0);
    const areas = new Map();
    objs.forEach(o => {
      const t = T[o.type];
      if (!t) return;
      const pv = t.perm || 0, sv = t.shade || 0;
      let b;
      if (o.kind === "zone") {
        b = U.bbox(o.pts);
        const h = o.w / 2;
        b = [b[0] - h, b[1] - h, b[2] + h, b[3] + h];
      } else {
        const r = Math.hypot(o.w, o.h) / 2;
        b = [o.x - r, o.y - r, o.x + r, o.y + r];
      }
      const i0 = Math.max(0, Math.floor(b[0] / CS)), i1 = Math.min(NX - 1, Math.floor(b[2] / CS));
      const j0 = Math.max(0, Math.floor(b[1] / CS)), j1 = Math.min(NY - 1, Math.floor(b[3] / CS));
      let n = 0;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * NX + i;
          if (!mask[k] || !covers(o, (i + .5) * CS, (j + .5) * CS)) continue;
          n++;
          if (pv > perm[k]) perm[k] = pv;
          if (sv > shade[k]) shade[k] = sv;
        }
      }
      areas.set(o.id, n * CS * CS);
    });
    let p = 0, s = 0;
    for (let k = 0; k < N; k++) { p += perm[k]; s += shade[k]; }
    const permM2 = PERM0 + p * CS * CS, shadeM2 = s * CS * CS;
    return {
      area,
      permM2, shadeM2,
      permPct: Math.min(100, permM2 / area * 100),
      shadePct: Math.min(100, shadeM2 / area * 100),
      areas
    };
  }

  C.geo = { okPos, nearStroke, covers, stats, area, PERM0, shade0Area };
})(window.Cour);
