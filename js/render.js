/* ==========================================================================
   render.js — Dessin SVG du plan
   Couches : fond fixe (rues, cour, bâtiments, arbres) dessiné une seule fois,
   puis sols peints, éléments, poignées. Pendant un geste, seul l'élément
   manipulé est redessiné. La même fonction sert à l'export image.
   ========================================================================== */
(function (C) {
  "use strict";
  const G = C.GEO, T = C.TYPES, S = C.state, el = C.svg.el, NS = C.svg.NS;
  const FONT = "Avenir, 'Avenir Next', 'Nunito Sans', 'Segoe UI', Roboto, Arial, sans-serif";
  const CYAN = "#0084D4", BLEU = "#00205B";

  // Type de pointeur courant (doigt ou souris) : règle la taille des poignées
  C.input = { coarse: !!(window.matchMedia && matchMedia("(pointer: coarse)").matches) };

  function text(parent, x, y, s, fs, fill, extra) {
    const e = el("text", Object.assign({ x, y, "font-size": fs, "text-anchor": "middle", "dominant-baseline": "central", "aria-hidden": "true", "pointer-events": "none" }, extra || {}), parent);
    if (fill) e.setAttribute("fill", fill);
    e.textContent = s;
    return e;
  }
  const pts = p => p.map(q => q[0].toFixed(2) + "," + q[1].toFixed(2)).join(" ");
  const strokeD = p => p.length === 1
    ? `M${p[0][0]},${p[0][1]}L${p[0][0] + .01},${p[0][1]}`
    : "M" + p.map(q => q[0] + "," + q[1]).join("L");

  /* ---------- Cadre de sélection (taille mini à l'écran) ---------- */
  function frameOf(o, ppm) {
    const t = T[o.type], coarse = C.input.coarse;
    const minF = (coarse ? 76 : 48) / ppm;
    const w = o.w, h = t.round ? o.w : o.h;
    const fw = Math.max(w, minF), fh = Math.max(h, minF);
    const stem = (coarse ? 34 : 26) / ppm;
    return { fw, fh, rotY: -fh / 2 - stem, round: !!t.round, exact: fw === w && fh === h };
  }

  /* ---------- Fond fixe ---------- */
  function drawBase(root, prefix) {
    const defs = el("defs", {}, root);
    const clipId = prefix + "-cour";
    el("polygon", { points: pts(G.COUR) }, el("clipPath", { id: clipId }, defs));
    C.art.patterns(defs, prefix);
    const clip = `url(#${clipId})`;

    el("rect", { x: -60, y: -60, width: G.VBW + 120, height: G.VBH + 120, fill: "#EEF1F4" }, root);
    el("polygon", { points: pts(G.VERGE), fill: "#DDD6BC" }, root);
    el("polygon", { points: pts(G.ROAD), fill: "#2E3034" }, root);
    G.LABELS.forEach(l => text(root, l.x, l.y, l.t, l.fs, l.fill, { transform: `rotate(${l.a} ${l.x} ${l.y})` }));

    el("polygon", { points: pts(G.COUR), fill: "#DADDE2" }, root);
    el("polygon", { points: pts(G.TERRE), fill: "#E9DDB4", "clip-path": clip }, root);
    const grid = el("g", { "clip-path": clip, stroke: "#fff", "stroke-width": .08, opacity: .7 }, root);
    for (let x = 0; x < G.VBW; x += 5) el("line", { x1: x, y1: 0, x2: x, y2: G.VBH }, grid);
    for (let y = 0; y < G.VBH; y += 5) el("line", { x1: 0, y1: y, x2: G.VBW, y2: y }, grid);

    const zones = el("g", { "clip-path": clip }, root);

    el("polygon", { points: pts(G.BLD0), fill: "#E0A08C" }, root);
    el("polygon", { points: pts(G.BLD1), fill: "#B5523B" }, root);

    // Arbres existants (conservés). Ils laissent passer les clics.
    const trees = el("g", { "pointer-events": "none" }, root);
    G.TREES.forEach(([x, y, r]) => C.art.tree(trees, x, y, r, .6));

    el("polygon", { points: pts(G.COUR), fill: "none", stroke: "#EC5B4B", "stroke-width": .25, "pointer-events": "none" }, root);
    el("line", { x1: G.GATE[0][0], y1: G.GATE[0][1], x2: G.GATE[1][0], y2: G.GATE[1][1], stroke: "#8374D1", "stroke-width": .7 }, root);
    text(root, G.GATE[0][0] + 3.5, G.GATE[0][1] + 1.8, "Portail", 1.3, BLEU);
    el("rect", { x: 2, y: G.VBH - 4, width: 10, height: .5, fill: BLEU }, root);
    text(root, 7, G.VBH - 2.6, "10 m", 1.3, BLEU);

    const items = el("g", {}, root);
    const overlay = el("g", {}, root);
    return { zones, items, overlay, prefix };
  }

  /* ---------- Sols peints ---------- */
  function drawZones(layer, list, opt) {
    list.forEach(z => {
      const t = T[z.type];
      if (!t) return;
      const d = strokeD(z.pts);
      const isSel = !opt.exportMode && z.id != null && z.id === S.sel;
      const common = { d, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
      if (isSel) el("path", Object.assign({ stroke: CYAN, "stroke-width": z.w + .6, opacity: .45, "pointer-events": "none" }, common), layer);
      const paint = C.art.zonePaint(z.type, opt.prefix);
      el("path", Object.assign({
        stroke: paint || t.fill, opacity: paint ? .95 : t.op, "stroke-width": z.w,
        "data-k": z.id != null && !opt.exportMode ? "zone" : null,
        "data-id": z.id != null ? z.id : null
      }, common), layer);
      if (z.type === "circuit" && z.pts.length > 1) {
        el("path", Object.assign({ stroke: "#fff", "stroke-width": Math.max(.08, z.w * .06), "stroke-dasharray": ".6 .5", opacity: .9, "pointer-events": "none" }, common), layer);
      }
    });
  }

  /* ---------- Éléments ---------- */
  function drawItem(parent, o, opt) {
    const t = T[o.type];
    if (!t) return null;
    const isSel = o.id === S.sel;
    const attrs = { transform: `translate(${o.x} ${o.y}) rotate(${o.rot})` };
    if (!opt.exportMode) Object.assign(attrs, {
      class: "it" + (o.id === S.justAdded ? " pop" : ""),
      "data-k": "item", "data-id": o.id, tabindex: "0", role: "button",
      "aria-label": `${C.label(o)}, ${C.dimText(o)}${isSel ? ", sélectionné" : ""}`,
      style: "cursor:grab"
    });
    const g = el("g", attrs, parent);
    const w = o.w, h = t.round ? o.w : o.h;
    if (!opt.exportMode) {
      // Zone de toucher agrandie pour les petits éléments
      const hitMin = (C.input.coarse ? 44 : 28) / opt.ppm;
      const hw = Math.max(w, hitMin), hh = Math.max(h, hitMin);
      if (t.round) el("circle", { r: Math.max(hw, hh) / 2, fill: "#000", "fill-opacity": 0 }, g);
      else el("rect", { x: -hw / 2, y: -hh / 2, width: hw, height: hh, fill: "#000", "fill-opacity": 0 }, g);
    }
    const body = el("g", { class: "body", "pointer-events": "none" }, g);
    if (t.c === "exist") body.setAttribute("opacity", ".9");
    if (!C.art.draw(body, o.type, w, h)) {
      if (t.round) el("circle", { r: w / 2, fill: C.COL[t.c] }, body);
      else el("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: Math.min(.4, h / 4), fill: C.COL[t.c] }, body);
      text(el("g", { transform: `rotate(${-o.rot})` }, body), 0, 0, t.e, Math.max(.9, Math.min(Math.min(w, h) * .75, 4.2)), null);
    }
    // Contour pour le focus clavier
    if (!opt.exportMode) {
      if (t.round) el("circle", { class: "shape", r: w / 2, fill: "none", "pointer-events": "none" }, g);
      else el("rect", { class: "shape", x: -w / 2, y: -h / 2, width: w, height: h, rx: .2, fill: "none", "pointer-events": "none" }, g);
    }
    return g;
  }

  function drawItems(layer, list, opt) {
    // L'élément sélectionné passe au premier plan
    list.slice().sort((a, b) => (a.id === S.sel) - (b.id === S.sel)).forEach(o => drawItem(layer, o, opt));
  }

  /* ---------- Poignées de l'élément sélectionné ---------- */
  function handle(parent, cx, cy, rv, rh, k, extra, cursor) {
    el("circle", { cx, cy, r: rv, fill: "#fff", "pointer-events": "none" }, parent);
    el("circle", { cx, cy, r: rv * .66, fill: CYAN, "pointer-events": "none" }, parent);
    el("circle", Object.assign({ cx, cy, r: rh, fill: "#000", "fill-opacity": 0, "data-k": k, style: `cursor:${cursor}` }, extra), parent);
  }

  function drawOverlay(layer) {
    layer.replaceChildren();
    const ppm = C.view.ppm(), coarse = C.input.coarse;
    const o = C.store.selected();
    if (o && o.kind === "item") {
      const F = frameOf(o, ppm);
      const rv = (coarse ? 10 : 6.5) / ppm, rh = (coarse ? 21 : 11) / ppm, sw = 1.5 / ppm;
      const g = el("g", { transform: `translate(${o.x} ${o.y}) rotate(${o.rot})` }, layer);
      const dash = { fill: "none", stroke: CYAN, "stroke-width": sw, "stroke-dasharray": `${6 / ppm} ${4 / ppm}`, "pointer-events": "none" };
      if (F.round && F.exact) el("circle", Object.assign({ r: F.fw / 2 }, dash), g);
      else el("rect", Object.assign({ x: -F.fw / 2, y: -F.fh / 2, width: F.fw, height: F.fh, rx: 4 / ppm }, dash), g);

      // Bords (allonger) : seulement si le côté est assez long pour ne pas gêner les coins
      if (!F.round) {
        const need = (coarse ? 80 : 56) / ppm;
        [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]].forEach(([sx, sy, i]) => {
          const horiz = sx === 0;
          if ((horiz ? F.fw : F.fh) < need) return;
          const cx = sx * F.fw / 2, cy = sy * F.fh / 2;
          const lw = horiz ? rv * 2.6 : rv * 1.3, lh = horiz ? rv * 1.3 : rv * 2.6;
          el("rect", { x: cx - lw / 2, y: cy - lh / 2, width: lw, height: lh, rx: Math.min(lw, lh) / 2, fill: "#fff", "pointer-events": "none" }, g);
          el("rect", { x: cx - lw * .33, y: cy - lh * .33, width: lw * .66, height: lh * .66, rx: Math.min(lw, lh) * .33, fill: CYAN, "pointer-events": "none" }, g);
          el("rect", { x: cx - (horiz ? rh * .9 : rh * .8), y: cy - (horiz ? rh * .8 : rh * .9), width: horiz ? rh * 1.8 : rh * 1.6, height: horiz ? rh * 1.6 : rh * 1.8, fill: "#000", "fill-opacity": 0, "data-k": "re", "data-e": i, style: horiz ? "cursor:ns-resize" : "cursor:ew-resize" }, g);
        });
      }
      // Coins (agrandir en gardant les proportions)
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) =>
        handle(g, sx * F.fw / 2, sy * F.fh / 2, rv, rh, "rs", { "data-c": i }, (sx * sy > 0) ? "nwse-resize" : "nesw-resize"));
      // Rotation
      el("line", { x1: 0, y1: -F.fh / 2, x2: 0, y2: F.rotY, stroke: CYAN, "stroke-width": sw, "pointer-events": "none" }, g);
      el("circle", { cx: 0, cy: F.rotY, r: rv * 1.5, fill: BLEU, "pointer-events": "none" }, g);
      text(g, 0, F.rotY, "↻", rv * 1.9, "#fff", { transform: `rotate(${-o.rot} 0 ${F.rotY})` });
      el("circle", { cx: 0, cy: F.rotY, r: Math.max(rh, rv * 1.5), fill: "#000", "fill-opacity": 0, "data-k": "rot", style: "cursor:grab" }, g);
    }
    const hover = C.interact && C.interact.hover;
    if (S.brush && hover) {
      el("circle", { cx: hover[0], cy: hover[1], r: S.brushSize / 2, fill: S.brush === "erase" ? "rgba(242,130,127,.18)" : "rgba(0,32,91,.08)", stroke: BLEU, "stroke-width": 1.5 / ppm, "stroke-dasharray": `${5 / ppm} ${4 / ppm}`, "pointer-events": "none" }, layer);
    }
  }

  /* ---------- API ---------- */
  let svg = null, L = null;
  const liveOpt = () => ({ exportMode: false, ppm: C.view.ppm(), prefix: "plan" });

  function zonesOnly() {
    const drawing = C.interact && C.interact.drawing;
    L.zones.replaceChildren();
    drawZones(L.zones, S.objs.filter(o => o.kind === "zone").concat(drawing ? [drawing] : []), liveOpt());
  }
  function refocus() {
    if (S.refocus == null) return;
    const g = L.items.querySelector(`[data-id="${S.refocus}"]`);
    S.refocus = null;
    if (g) g.focus({ preventScroll: true });
  }

  C.render = {
    frameOf,
    init(svgEl) {
      svg = svgEl;
      svg.setAttribute("font-family", FONT);
      L = drawBase(svg, "plan");
    },
    dynamic() {
      if (!L) return;
      zonesOnly();
      L.items.replaceChildren();
      drawItems(L.items, S.objs.filter(o => o.kind === "item"), liveOpt());
      S.justAdded = null;
      drawOverlay(L.overlay);
      refocus();
    },
    zones() { if (L) zonesOnly(); },
    // Redessine un seul élément (pendant un geste)
    item(id) {
      if (!L) return;
      const o = C.store.find(id);
      const old = L.items.querySelector(`[data-id="${id}"]`);
      if (!o || o.kind !== "item") { if (old) old.remove(); return; }
      const frag = document.createElementNS(NS, "g");
      const g = drawItem(frag, o, liveOpt());
      if (old && g) old.replaceWith(g); else if (g) L.items.appendChild(g);
      refocus();
    },
    overlay() { if (L) drawOverlay(L.overlay); },

    // SVG autonome (chaîne) pour l'export image
    exportSVG(crop, pxPerM) {
      const root = document.createElementNS(NS, "svg");
      root.setAttribute("viewBox", crop.join(" "));
      root.setAttribute("width", Math.round(crop[2] * pxPerM));
      root.setAttribute("height", Math.round(crop[3] * pxPerM));
      root.setAttribute("font-family", FONT);
      const X = drawBase(root, "export");
      drawZones(X.zones, S.objs.filter(o => o.kind === "zone"), { exportMode: true, prefix: "export" });
      drawItems(X.items, S.objs.filter(o => o.kind === "item"), { exportMode: true, ppm: pxPerM, prefix: "export" });
      return new XMLSerializer().serializeToString(root);
    }
  };
})(window.Cour);
