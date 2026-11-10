/* ==========================================================================
   art.js — Illustrations des éléments, vue légèrement plongeante
   Chaque dessin tient dans l'emprise réelle de l'objet (w × h mètres) :
   u, v vont de 0 à 1 (gauche → droite, fond → devant). Le « devant » est en bas,
   on voit donc le dessus et la face avant des objets. Aplats tonaux, sans contour.
   ========================================================================== */
(function (C) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  C.svg = { el, NS };

  /* ---------- Couleurs ---------- */
  const P = {
    wood: "#C99A6B", woodD: "#9C6E45", woodL: "#E6CDA8",
    roof: "#B5523B", roofD: "#8E3C2A",
    green: "#00B388", greenD: "#00805F", greenDD: "#0B5E46", greenL: "#7FD1B3", leaf: "#6CC24A",
    sand: "#E5CF85", sandD: "#CDB060", sandL: "#F5E9C4",
    bleu: "#0084D4", bleuD: "#00609B", bleuC: "#A4C8E1",
    ink: "#00205B", lilas: "#C7B2DE", menthe: "#A1D6CA", violet: "#8374D1", corail: "#F2827F", orange: "#F0913A",
    grey: "#AEB6C1", greyD: "#6B7480", greyL: "#DCE1E8", white: "#FFFFFF",
    soil: "#8B5E3C", soilD: "#6E4A2E", board: "#2F5246",
    shadow: "rgba(0,32,91,.13)"
  };

  /* ---------- Crayon : coordonnées normalisées → mètres ---------- */
  const f = n => Math.round(n * 1000) / 1000;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  function pen(g, w, h) {
    const X = u => -w / 2 + u * w, Y = v => -h / 2 + v * h, S = Math.min(w, h);
    const ex = (base, extra) => Object.assign(base, extra || {});
    return {
      S,
      rect: (u, v, uw, vh, fill, r, extra) => el("rect", ex({ x: f(X(u)), y: f(Y(v)), width: f(uw * w), height: f(vh * h), rx: r ? f(r * S) : null, fill }, extra), g),
      poly: (pts, fill, extra) => el("polygon", ex({ points: pts.map(([u, v]) => f(X(u)) + "," + f(Y(v))).join(" "), fill }, extra), g),
      circ: (u, v, r, fill, extra) => el("circle", ex({ cx: f(X(u)), cy: f(Y(v)), r: f(r * S), fill }, extra), g),
      ell: (u, v, ru, rv, fill, extra) => el("ellipse", ex({ cx: f(X(u)), cy: f(Y(v)), rx: f(ru * w), ry: f(rv * h), fill }, extra), g),
      line: (u1, v1, u2, v2, stroke, sw, extra) => el("line", ex({ x1: f(X(u1)), y1: f(Y(v1)), x2: f(X(u2)), y2: f(Y(v2)), stroke, "stroke-width": f(sw * S), "stroke-linecap": "round" }, extra), g),
      // Ombre portée discrète, décalée vers le bas à droite
      shadow: r => el("rect", { x: f(X(.07)), y: f(Y(.12)), width: f(.95 * w), height: f(.9 * h), rx: f((r == null ? .12 : r) * S), fill: P.shadow }, g)
    };
  }

  /* ---------- Dessins ---------- */
  const A = {};

  A.cabane = p => {
    p.shadow(.1);
    p.rect(.14, .44, .72, .48, P.wood, .03);
    p.rect(.14, .84, .72, .08, P.woodD, .02);
    p.rect(.42, .58, .17, .32, P.woodD, .03);
    p.rect(.2, .57, .14, .13, P.bleuC, .02);
    p.rect(.66, .57, .14, .13, P.bleuC, .02);
    p.poly([[.03, .52], [.5, .05], [.5, .52]], P.roof);
    p.poly([[.5, .05], [.97, .52], [.5, .52]], P.roofD);
    p.rect(.03, .49, .94, .06, P.roofD, .02);
  };

  A.filets = p => {
    p.ell(.54, .7, .46, .3, P.shadow);
    p.ell(.5, .64, .48, .34, P.woodL);
    const top = [.5, .1], B = [[.1, .86], [.9, .86], [.8, .42], [.2, .42]];
    p.poly([B[3], B[2], top], P.lilas, { opacity: .45 });
    p.poly([B[0], B[3], top], P.violet, { opacity: .3 });
    p.poly([B[1], B[2], top], P.violet, { opacity: .45 });
    p.poly([B[0], B[1], top], P.lilas, { opacity: .6 });
    for (let i = 0; i <= 6; i++) { const b = lerp(B[0], B[1], i / 6); p.line(top[0], top[1], b[0], b[1], P.violet, .012); }
    for (let i = 1; i <= 4; i++) { const b = lerp(B[1], B[2], i / 5); p.line(top[0], top[1], b[0], b[1], P.violet, .01, { opacity: .7 }); }
    for (let k = 1; k <= 3; k++) {
      const t = k / 4, a = lerp(top, B[0], t), b = lerp(top, B[1], t), c = lerp(top, B[2], t);
      p.line(a[0], a[1], b[0], b[1], P.violet, .012);
      p.line(b[0], b[1], c[0], c[1], P.violet, .01, { opacity: .7 });
    }
    B.forEach(([u, v]) => p.circ(u, v, .035, P.woodD));
    p.circ(top[0], top[1], .04, P.woodD);
  };

  A.escalade = p => {
    p.shadow(.08);
    p.rect(.01, .04, .98, .26, P.woodL, .1);
    p.rect(.01, .26, .98, .66, P.wood, .06);
    [[.07, .46, P.corail], [.16, .72, P.bleu], [.25, .5, P.sand], [.34, .76, P.green], [.43, .46, P.lilas],
      [.53, .7, P.corail], [.62, .48, P.bleu], [.71, .75, P.sand], [.8, .5, P.green], [.9, .72, P.lilas]]
      .forEach(([u, v, c]) => p.circ(u, v, .09, c));
  };

  A.grumes = p => {
    p.shadow(.3);
    [[.02, .3, -.05], [.35, .64, .05], [.69, .97, -.03]].forEach(([a, b, d]) => {
      p.rect(a, .2 + d, b - a, .6, P.wood, .5);
      p.line(a + .03, .38 + d, b - .05, .38 + d, P.woodD, .04, { opacity: .45 });
      p.ell(b - .014, .5 + d, .016, .29, P.woodL);
      p.ell(b - .014, .5 + d, .007, .12, P.woodD, { opacity: .5 });
    });
  };

  A.butte = p => {
    p.ell(.53, .6, .47, .38, P.shadow);
    p.ell(.5, .56, .47, .4, P.greenD);
    p.ell(.48, .5, .4, .33, P.green);
    p.ell(.42, .42, .2, .14, P.greenL);
    [[.3, .62], [.62, .36], [.7, .62], [.46, .72]].forEach(([u, v]) => p.circ(u, v, .025, P.sandL));
  };

  A.jeux = p => {
    p.rect(0, 0, 1, 1, P.greyL, .08);
    const c = [P.corail, P.sand, P.bleuC, P.lilas, P.menthe || "#A1D6CA", P.corail, P.sand];
    [[.32, .81], [.32, .65], [.14, .49], [.52, .49], [.32, .33], [.14, .17], [.52, .17]]
      .forEach(([u, v], i) => p.rect(u, v, .34, .14, c[i], .05));
    p.ell(.5, .08, .3, .05, P.bleuC);
  };

  A.local = p => {
    p.shadow(.08);
    p.rect(.04, .42, .92, .52, P.greyL, .03);
    p.rect(.17, .52, .32, .4, P.bleu, .02);
    p.rect(.51, .52, .32, .4, P.bleu, .02);
    p.circ(.45, .73, .035, P.white);
    p.circ(.55, .73, .035, P.white);
    p.poly([[0, .48], [.05, .04], [.95, .04], [1, .48]], P.greyD);
    p.rect(0, .42, 1, .07, P.ink, .02, { opacity: .55 });
  };

  A.tables = p => {
    p.shadow(.1);
    p.rect(.1, .04, .8, .15, P.woodD, .3);
    p.rect(.02, .27, .96, .44, P.wood, .08);
    p.line(.05, .42, .95, .42, P.woodD, .015, { opacity: .6 });
    p.line(.05, .56, .95, .56, P.woodD, .015, { opacity: .6 });
    p.rect(.02, .69, .96, .06, P.woodD, .04);
    p.rect(.1, .81, .8, .15, P.woodD, .3);
  };

  A.bancs = p => {
    p.shadow(.3);
    p.rect(.02, .04, .96, .26, P.woodD, .3);
    p.rect(.02, .32, .96, .4, P.wood, .2);
    p.rect(.02, .7, .96, .12, P.woodD, .2);
    p.rect(.07, .8, .05, .18, P.greyD);
    p.rect(.88, .8, .05, .18, P.greyD);
  };

  A.gradins = p => {
    p.shadow(.04);
    [[.02, .2], [.32, .52], [.64, .84]].forEach(([a, b]) => {
      p.rect(0, a, 1, b - a, P.woodL, .02);
      p.rect(0, b, 1, .12, P.woodD, .02);
    });
    p.rect(0, .02, 1, .05, P.leaf, .02, { opacity: .55 });
  };

  A.classe = p => {
    p.rect(.02, .12, .96, .86, P.sandL, .12);
    p.rect(.25, .02, .5, .2, P.woodD, .04);
    p.rect(.28, .04, .44, .15, P.board, .02);
    p.line(.34, .09, .52, .09, P.white, .012, { opacity: .8 });
    p.line(.34, .14, .62, .14, P.white, .012, { opacity: .8 });
    [[.2, .46], [.4, .41], [.6, .41], [.8, .46], [.26, .74], [.5, .7], [.74, .74]].forEach(([u, v]) => {
      p.circ(u + .015, v + .04, .075, P.shadow);
      p.circ(u, v, .075, P.wood);
      p.circ(u, v, .045, P.woodL);
    });
  };

  A.tableau = p => {
    p.shadow(.2);
    p.rect(0, .04, 1, .26, P.woodD, .2);
    p.rect(.02, .24, .96, .6, P.board, .08);
    p.line(.1, .44, .45, .44, P.white, .035, { opacity: .85 });
    p.line(.12, .62, .34, .62, P.white, .035, { opacity: .85 });
    p.circ(.7, .54, .22, "none", { stroke: P.sand, "stroke-width": .025 });
    p.rect(.06, .84, .05, .15, P.woodD);
    p.rect(.89, .84, .05, .15, P.woodD);
  };

  A.lecture = p => {
    p.ell(.52, .6, .46, .37, P.shadow);
    p.ell(.5, .57, .46, .37, P.lilas);
    p.ell(.5, .57, .32, .24, "#D9CCE9");
    p.rect(.2, .04, .6, .22, P.woodD, .04);
    [P.corail, P.bleu, P.sand, P.green, P.violet, P.corail, P.bleuC, P.sand]
      .forEach((c, i) => p.rect(.24 + i * .067, .07, .05, .16, c, .01));
    [[.24, .62, P.corail], [.76, .6, P.sand], [.5, .84, P.bleuC]].forEach(([u, v, c]) => p.circ(u, v, .1, c));
    p.rect(.42, .5, .16, .1, P.white, .02);
    p.line(.5, .5, .5, .6, P.grey, .01);
  };

  // Arbre vu d'en haut : couronne en grappes
  A.arbre = p => {
    p.circ(.55, .57, .5, P.shadow);
    p.circ(.5, .5, .5, P.greenD);
    [[.32, .36, .24], [.66, .34, .22], [.7, .64, .24], [.36, .68, .24], [.5, .5, .26]].forEach(([u, v, r]) => p.circ(u, v, r, P.green));
    [[.3, .3, .12], [.6, .27, .1], [.46, .45, .12], [.68, .56, .08]].forEach(([u, v, r]) => p.circ(u, v, r, P.greenL));
  };

  A.haie = p => {
    p.rect(.02, .3, .98, .66, P.shadow, .5);
    for (let i = 0; i < 7; i++) p.circ(.07 + i * .143, .55, .48, P.greenD);
    for (let i = 0; i < 7; i++) { const u = .07 + i * .143; p.circ(u - .01, .45, .36, P.green); p.circ(u - .02, .35, .14, P.greenL); }
  };

  A.potager = p => {
    p.shadow(.06);
    p.rect(0, 0, 1, .92, P.wood, .05);
    p.rect(0, .84, 1, .14, P.woodD, .04);
    p.rect(.05, .07, .9, .72, P.soil, .03);
    [[.22, P.leaf], [.44, P.corail], [.66, P.green]].forEach(([v, c]) => {
      for (let i = 0; i < 7; i++) {
        const u = .12 + i * .127;
        p.circ(u, v + .02, .07, P.greenD);
        p.circ(u, v, .05, c);
      }
    });
  };

  A.sable = p => {
    p.shadow(.06);
    p.rect(0, 0, 1, .94, P.wood, .05);
    p.rect(0, .86, 1, .12, P.woodD, .04);
    p.rect(.07, .07, .86, .74, P.sand, .03);
    p.ell(.35, .36, .18, .08, P.sandL);
    p.ell(.62, .62, .16, .07, P.sandD, { opacity: .5 });
    p.poly([[.62, .2], [.8, .2], [.77, .42], [.65, .42]], P.bleu);
    p.ell(.71, .2, .09, .035, P.bleuC);
    p.line(.26, .7, .4, .54, P.corail, .03);
    p.ell(.42, .52, .045, .04, P.corail);
  };

  A.hotel = p => {
    p.shadow(.1);
    p.rect(.12, .36, .76, .58, P.wood, .03);
    [[.16, .41, P.woodD], [.51, .41, P.soilD], [.16, .67, P.sandD], [.51, .67, P.woodL]].forEach(([u, v, c]) => {
      p.rect(u, v, .33, .23, c, .02);
      for (let k = 0; k < 3; k++) p.circ(u + .07 + k * .09, v + .12, .03, P.ink, { opacity: .45 });
    });
    p.poly([[.04, .41], [.5, .04], [.96, .41]], P.roof);
  };

  A.nichoir = p => {
    p.shadow(.1);
    p.rect(.2, .38, .6, .56, P.bleuC, .04);
    p.circ(.5, .6, .1, P.ink);
    p.rect(.46, .74, .08, .1, P.woodD);
    p.poly([[.08, .45], [.5, .06], [.92, .45]], P.roof);
  };

  A.pergola = p => {
    p.rect(.03, .1, .97, .92, P.shadow, .02);
    for (let i = 0; i <= 10; i++) p.rect(.02 + i * .094, .04, .025, .92, P.wood, .01);
    p.rect(0, .12, 1, .08, P.woodD, .02);
    p.rect(0, .8, 1, .08, P.woodD, .02);
    [[.01, .1], [.95, .1], [.01, .78], [.95, .78]].forEach(([u, v]) => p.rect(u, v, .04, .07, P.greyD, .02));
    [[.12, .18, .1], [.2, .3, .09], [.16, .74, .1], [.68, .16, .1], [.8, .3, .09], [.9, .6, .1], [.6, .84, .09], [.38, .5, .08]]
      .forEach(([u, v, r]) => { p.circ(u, v, r, P.greenD); p.circ(u - .01, v - .02, r * .65, P.leaf); });
  };

  A.voile = p => {
    p.poly([[.14, .24], [.98, .18], [.92, .98], [.2, .92]], P.shadow);
    p.poly([[.06, .12], [.94, .06], [.86, .88], [.12, .8]], P.sandL);
    p.poly([[.06, .12], [.94, .06], [.5, .46]], P.white, { opacity: .65 });
    p.poly([[.86, .88], [.12, .8], [.5, .46]], P.sand, { opacity: .7 });
    [[.06, .12], [.94, .06], [.86, .88], [.12, .8]].forEach(([u, v]) => p.circ(u, v, .03, P.greyD));
  };

  A.tunnel = p => {
    p.rect(.02, .3, .98, .66, P.shadow, .45);
    p.rect(.02, .16, .96, .68, P.greenD, .4);
    for (let i = 0; i < 6; i++) { const u = .1 + i * .16; p.ell(u, .42, .09, .3, P.green); p.circ(u - .02, .3, .12, P.greenL, { opacity: .8 }); }
    p.ell(.045, .55, .03, .25, P.greenDD);
  };

  A.recup = p => {
    p.ell(.54, .87, .42, .11, P.shadow);
    p.rect(.12, .28, .76, .56, P.bleu, .06);
    p.ell(.5, .84, .38, .1, P.bleu);
    p.ell(.5, .28, .38, .14, P.bleuC);
    p.ell(.5, .28, .26, .08, P.bleuD, { opacity: .55 });
    p.rect(.12, .52, .76, .05, P.bleuD, .01);
    p.rect(.4, .62, .2, .07, P.greyD, .02);
  };

  /* Équipements existants */
  A.ex_echiquier = p => {
    p.rect(0, 0, 1, 1, P.greyL, .04);
    const n = 6, s = .92 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) p.rect(.04 + i * s, .04 + j * s, s, s, (i + j) % 2 ? P.greyD : "#F4F6F8");
    p.circ(.29, .35, .07, P.ink);
    p.circ(.66, .62, .07, P.white);
  };

  A.ex_toboggan = p => {
    p.rect(0, 0, 1, 1, "#CDD4DC", .08);
    p.rect(.06, .14, .32, .34, P.woodL, .03);
    p.rect(.06, .48, .32, .13, P.woodD, .02);
    p.line(.12, .6, .12, .95, P.greyD, .03);
    p.line(.32, .6, .32, .95, P.greyD, .03);
    [.68, .76, .84, .92].forEach(v => p.line(.12, v, .32, v, P.greyD, .025));
    p.poly([[.36, .2], [.7, .5], [.97, .6], [.97, .82], [.66, .7], [.36, .44]], P.bleu);
    p.poly([[.39, .26], [.7, .56], [.95, .65], [.95, .76], [.67, .65], [.39, .39]], P.bleuC);
  };

  A.ex_sable = A.sable;

  A.ex_marquage = p => {
    p.rect(0, 0, 1, 1, "#C9CFD8", .06);
    p.rect(.12, .08, .76, .84, "none", .4, { stroke: P.white, "stroke-width": .35 });
    p.rect(.12, .08, .76, .84, "none", .4, { stroke: P.sand, "stroke-width": .06, "stroke-dasharray": ".4 .3" });
    p.rect(.38, .35, .24, .08, P.corail, .02);
    p.rect(.38, .46, .24, .08, P.bleuC, .02);
    p.rect(.38, .57, .24, .08, P.sand, .02);
  };

  /* ---------- Textures des sols (motifs en mètres) ---------- */
  const PATTERNS = {
    copeaux: { s: .7, bg: "#D2AE75", draw: g => {
      [[.08, .1, 25, "#A87A4A"], [.4, .05, -30, "#E6C995"], [.25, .38, 70, "#A87A4A"], [.5, .45, 10, "#B98A5A"], [.05, .55, -60, "#E6C995"], [.42, .62, 40, "#A87A4A"]]
        .forEach(([x, y, a, c]) => el("rect", { x, y, width: .2, height: .06, rx: .02, fill: c, transform: `rotate(${a} ${x + .1} ${y + .03})` }, g));
    } },
    herbe: { s: .5, bg: "#6CC79A", draw: g => {
      [[.05, .2], [.2, .05], [.32, .3], [.1, .42], [.38, .12], [.25, .45]].forEach(([x, y]) => {
        el("line", { x1: x, y1: y + .08, x2: x - .02, y2: y, stroke: "#2E9E6E", "stroke-width": .025, "stroke-linecap": "round" }, g);
        el("line", { x1: x + .03, y1: y + .08, x2: x + .05, y2: y + .01, stroke: "#9BDDBB", "stroke-width": .02, "stroke-linecap": "round" }, g);
      });
    } },
    terre: { s: .6, bg: "#9A6A45", draw: g => {
      [[.1, .1, .04, "#7A5034"], [.35, .2, .03, "#B88760"], [.22, .4, .05, "#7A5034"], [.48, .48, .03, "#B88760"], [.05, .5, .025, "#B88760"]]
        .forEach(([x, y, r, c]) => el("circle", { cx: x, cy: y, r, fill: c }, g));
    } },
    stabilise: { s: .5, bg: "#E9D79B", draw: g => {
      [[.1, .1], [.3, .25], [.15, .4], [.4, .05], [.42, .38]].forEach(([x, y]) => el("circle", { cx: x, cy: y, r: .025, fill: "#CDB66E" }, g));
    } }
  };

  function patterns(defs, prefix) {
    Object.entries(PATTERNS).forEach(([k, d]) => {
      const pat = el("pattern", { id: `${prefix}-pat-${k}`, patternUnits: "userSpaceOnUse", width: d.s, height: d.s }, defs);
      el("rect", { width: d.s, height: d.s, fill: d.bg }, pat);
      d.draw(pat);
    });
  }

  /* ---------- API ---------- */
  C.art = {
    P,
    has: type => !!A[type],
    // Dessine l'objet dans g, centré sur 0,0, dans une emprise w × h (m)
    draw(g, type, w, h) {
      const fn = A[type];
      if (!fn) return false;
      fn(pen(g, w, h));
      return true;
    },
    tree(g, x, y, r, opacity) {
      const t = el("g", { transform: `translate(${f(x)} ${f(y)})`, opacity: opacity == null ? .92 : opacity }, g);
      A.arbre(pen(t, 2 * r, 2 * r));
      return t;
    },
    patterns,
    zonePaint: (type, prefix) => (PATTERNS[type] ? `url(#${prefix}-pat-${type})` : null),
    // Petite vignette SVG pour les listes (catalogue, pinceau, panneau)
    preview(type) {
      const t = C.TYPES[type];
      const svg = el("svg", { class: "art-preview", "aria-hidden": "true", focusable: "false" });
      if (!t) return svg;
      if (t.zone) {
        svg.setAttribute("viewBox", "0 0 1.6 1.6");
        el("rect", { width: 1.6, height: 1.6, rx: .4, fill: PATTERNS[type] ? `url(#plan-pat-${type})` : t.fill, opacity: PATTERNS[type] ? 1 : Math.max(.6, t.op) }, svg);
        if (type === "circuit") el("line", { x1: .2, y1: .8, x2: 1.4, y2: .8, stroke: "#fff", "stroke-width": .08, "stroke-dasharray": ".25 .18" }, svg);
        return svg;
      }
      const w = t.w, h = t.round ? t.w : t.h, side = Math.max(w, h) * 1.1;
      svg.setAttribute("viewBox", `${f(-side / 2)} ${f(-side / 2)} ${f(side)} ${f(side)}`);
      if (!C.art.draw(el("g", {}, svg), type, w, h)) {
        const tx = el("text", { x: 0, y: 0, "font-size": side * .6, "text-anchor": "middle", "dominant-baseline": "central" }, svg);
        tx.textContent = t.e;
      }
      return svg;
    }
  };
})(window.Cour);
