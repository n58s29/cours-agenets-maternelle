/* ==========================================================================
   view.js — Caméra du plan : zoom, déplacement, conversions écran ↔ mètres
   ========================================================================== */
(function (C) {
  "use strict";
  const G = C.GEO, U = C.util, F = G.FIT;
  const MIN_K = .6, MAX_K = 12;    // zoom mini / maxi relatif à la vue d'ensemble

  let host = null, svg = null, endTimer = 0;

  const V = C.view = {
    cx: (F[0] + F[2]) / 2,
    cy: (F[1] + F[3]) / 2,
    sc: 10,               // pixels écran par mètre
    fitSc: 10,
    userZoom: false,

    init(hostEl, svgEl) { host = hostEl; svg = svgEl; },

    rect() { return host.getBoundingClientRect(); },

    apply() {
      const r = V.rect();
      if (!r.width || !r.height) return false;
      V.fitSc = Math.min(r.width / (F[2] - F[0]), r.height / (F[3] - F[1]));
      V.sc = U.clamp(V.sc, V.fitSc * MIN_K, V.fitSc * MAX_K);
      V.cx = U.clamp(V.cx, 0, G.VBW);
      V.cy = U.clamp(V.cy, 0, G.VBH);
      const w = r.width / V.sc, h = r.height / V.sc;
      svg.setAttribute("viewBox", `${(V.cx - w / 2).toFixed(3)} ${(V.cy - h / 2).toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}`);
      if (C.ui && C.ui.positionBar) C.ui.positionBar();   // la mini-barre suit le plan
      return true;
    },

    fit() {
      const r = V.rect();
      if (!r.width || !r.height) return false;
      V.sc = Math.min(r.width / (F[2] - F[0]), r.height / (F[3] - F[1]));
      V.cx = (F[0] + F[2]) / 2;
      V.cy = (F[1] + F[3]) / 2;
      V.userZoom = false;
      return V.apply();
    },

    // Coordonnées écran → mètres
    toWorld(clientX, clientY) {
      const r = V.rect();
      return [V.cx + (clientX - r.left - r.width / 2) / V.sc, V.cy + (clientY - r.top - r.height / 2) / V.sc];
    },

    zoomAt(clientX, clientY, k) {
      const r = V.rect(), w = V.toWorld(clientX, clientY);
      V.sc = U.clamp(V.sc * k, V.fitSc * MIN_K, V.fitSc * MAX_K);
      V.cx = w[0] - (clientX - r.left - r.width / 2) / V.sc;
      V.cy = w[1] - (clientY - r.top - r.height / 2) / V.sc;
      V.userZoom = true;
      V.apply();
      V.changed();
    },

    zoomBy(k) {
      const r = V.rect();
      V.zoomAt(r.left + r.width / 2, r.top + r.height / 2, k);
    },

    panTo(cx, cy) {
      V.cx = cx; V.cy = cy; V.userZoom = true;
      V.apply();
      V.changed();
    },

    // Centre la vue sur un point s'il sort de l'écran
    ensureVisible(x, y, margin = 3) {
      const r = V.rect();
      if (!r.width) return;
      const hw = r.width / 2 / V.sc - margin, hh = r.height / 2 / V.sc - margin;
      if (Math.abs(x - V.cx) > hw || Math.abs(y - V.cy) > hh) V.panTo(x, y);
    },

    // Les poignées dépendent du zoom : on redessine une fois le geste terminé
    changed() {
      clearTimeout(endTimer);
      endTimer = setTimeout(() => C.schedule({ scene: true }), 90);
    },

    ppm: () => V.sc
  };
})(window.Cour);
