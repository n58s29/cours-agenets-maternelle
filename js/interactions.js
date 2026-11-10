/* ==========================================================================
   interactions.js — Gestes sur le plan
   Un doigt / souris : sélectionner, déplacer, redimensionner, tourner, peindre.
   Deux doigts : zoomer et déplacer le plan. Molette : zoom.
   Souris en mode pinceau : clic droit, clic molette ou Espace pour déplacer.
   ========================================================================== */
(function (C) {
  "use strict";
  const S = C.state, U = C.util, T = C.TYPES, G = C.GEO;

  let svg = null;
  const ptrs = new Map();
  let pinch = null, pan = null, act = null, primary = null, drawing = null, hover = null, spaceDown = false;

  const world = e => C.view.toWorld(e.clientX, e.clientY);
  const isTree = (x, y) => G.TREES.some(([tx, ty, r]) => (x - tx) ** 2 + (y - ty) ** 2 <= r * r);
  const threshold = e => (e.pointerType === "mouse" ? 4 : 8);

  function erase(x, y) {
    const r = S.brushSize / 2;
    const before = S.objs.length;
    S.objs = S.objs.filter(o => !(o.kind === "zone" && C.geo.nearStroke(o, x, y, o.w / 2 + r * .6)));
    if (S.objs.length !== before && S.sel != null && !C.store.find(S.sel)) S.sel = null;
  }

  // Rotation libre au degré près, avec aimant sur l'horizontale, les diagonales et l'axe du bâtiment (-41°)
  const MAGNETS = [0, 45, 90, 135, 180, 225, 270, 315, 319, 49, 139, 229];
  function snapAngle(a) {
    a = ((a % 360) + 360) % 360;
    for (const m of MAGNETS) if (Math.abs(((a - m + 540) % 360) - 180) < 4) return m;
    return Math.round(a) % 360;
  }

  /* ---------- Pincer pour zoomer ---------- */
  function startPinch() {
    if (act) {
      const pre = act.pre;
      act = null;
      drawing = null;
      if (pre !== C.store.snap()) C.store.restore(pre);
    }
    drawing = null;
    pan = null;
    const p = [...ptrs.values()];
    pinch = {
      d0: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
      sc0: C.view.sc,
      w: C.view.toWorld((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2)
    };
    C.schedule({ scene: true });
  }
  function movePinch() {
    const p = [...ptrs.values()];
    if (p.length < 2) return;
    const V = C.view, r = V.rect();
    const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
    const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    V.sc = U.clamp(pinch.sc0 * d / pinch.d0, V.fitSc * .6, V.fitSc * 12);
    V.cx = pinch.w[0] - (mx - r.left - r.width / 2) / V.sc;
    V.cy = pinch.w[1] - (my - r.top - r.height / 2) / V.sc;
    V.userZoom = true;
    V.apply();
    V.changed();
  }

  /* ---------- Pointeur ---------- */
  function onDown(e) {
    C.input.coarse = e.pointerType !== "mouse";
    if (e.pointerType === "mouse" && e.button > 2) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
    if (ptrs.size === 2) { startPinch(); return; }
    if (ptrs.size > 2) return;
    primary = e.pointerId;

    const [x, y] = world(e);
    if (e.pointerType === "mouse" && (e.button === 1 || e.button === 2 || spaceDown)) {
      pan = { x: e.clientX, y: e.clientY, cx: C.view.cx, cy: C.view.cy, moved: false, tap: false };
      svg.style.cursor = "grabbing";
      return;
    }

    const tg = e.target && e.target.closest ? e.target.closest("[data-k]") : null;
    const k = tg ? tg.dataset.k : null;
    const s = C.store.selected();
    const pre = C.store.snap();

    if (s && s.kind === "item") {
      if (k === "rs") { act = { m: "rs", o: s, pre, d0: Math.hypot(x - s.x, y - s.y) || 1, w0: s.w, h0: s.h }; return; }
      if (k === "re") {
        const a = s.rot * Math.PI / 180, dx = x - s.x, dy = y - s.y;
        act = { m: "re", o: s, pre, e: +tg.dataset.e, w0: s.w, h0: s.h, x0: s.x, y0: s.y, a,
          lx0: dx * Math.cos(a) + dy * Math.sin(a), ly0: -dx * Math.sin(a) + dy * Math.cos(a) };
        return;
      }
      if (k === "rot") { act = { m: "rot", o: s, pre, moved: false, cx0: e.clientX, cy0: e.clientY }; return; }
    }
    if (S.brush === "erase") {
      act = { m: "erase", pre };
      erase(x, y);
      C.schedule({ zones: true });
      return;
    }
    if (S.brush) {
      drawing = { kind: "zone", type: S.brush, w: S.brushSize, pts: [[U.r2(x), U.r2(y)]] };
      act = { m: "draw", pre };
      C.schedule({ zones: true });
      return;
    }
    if ((k === "item" || k === "zone") && tg.dataset.id) {
      const o = C.store.find(+tg.dataset.id);
      if (o) {
        C.store.select(o.id);
        act = {
          m: "mv", o, pre,
          dx: o.kind === "item" ? o.x - x : 0, dy: o.kind === "item" ? o.y - y : 0,
          orig: o.kind === "zone" ? o.pts.map(p => p.slice()) : null,
          sx: x, sy: y, cx0: e.clientX, cy0: e.clientY, started: false
        };
        return;
      }
    }
    pan = { x: e.clientX, y: e.clientY, cx: C.view.cx, cy: C.view.cy, moved: false, tap: true, wx: x, wy: y };
  }

  function onMove(e) {
    const p = ptrs.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (e.pointerType === "mouse") {
      hover = world(e);
      if (S.brush && !act && !pan) C.schedule({ overlay: true });
    }
    if (pinch) { movePinch(); return; }
    if (!p || e.pointerId !== primary) return;

    const th = threshold(e);
    if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) < th) return;
      pan.moved = true;
      C.view.cx = pan.cx - dx / C.view.sc;
      C.view.cy = pan.cy - dy / C.view.sc;
      C.view.userZoom = true;
      C.view.apply();
      return;
    }
    if (!act) return;

    const [x, y] = world(e), o = act.o;
    switch (act.m) {
      case "erase":
        erase(x, y);
        C.schedule({ zones: true });
        return;
      case "draw": {
        const l = drawing.pts[drawing.pts.length - 1];
        if (Math.hypot(x - l[0], y - l[1]) > .25) {
          drawing.pts.push([U.r2(x), U.r2(y)]);
          C.schedule({ zones: true });
        }
        return;
      }
      case "mv": {
        if (!act.started) {
          if (Math.hypot(e.clientX - act.cx0, e.clientY - act.cy0) < th) return;
          act.started = true;
          svg.style.cursor = "grabbing";
        }
        if (o.kind === "zone") {
          const dx = x - act.sx, dy = y - act.sy;
          o.pts = act.orig.map(([a, b]) => [U.r2(a + dx), U.r2(b + dy)]);
          C.schedule({ zones: true, ui: true });
          return;
        } else {
          const nx = x + act.dx, ny = y + act.dy;
          if (C.geo.okPos(nx, ny)) { o.x = U.r1(nx); o.y = U.r1(ny); }
          else if (C.geo.okPos(nx, o.y)) o.x = U.r1(nx);
          else if (C.geo.okPos(o.x, ny)) o.y = U.r1(ny);
        }
        C.schedule({ item: o.id, ui: true });
        return;
      }
      case "re": {
        const dx = x - act.x0, dy = y - act.y0, c = Math.cos(act.a), sn = Math.sin(act.a);
        // On suit le déplacement du doigt depuis la prise : pas de saut, même si le cadre est plus grand que l'objet
        const dLx = dx * c + dy * sn - act.lx0, dLy = -dx * sn + dy * c - act.ly0, w0 = act.w0, h0 = act.h0;
        let cx = 0, cy = 0, nw = w0, nh = h0;
        if (act.e === 1) { nw = U.clamp(U.r1(w0 + dLx), .3, 60); cx = (nw - w0) / 2; }
        else if (act.e === 3) { nw = U.clamp(U.r1(w0 - dLx), .3, 60); cx = -(nw - w0) / 2; }
        else if (act.e === 2) { nh = U.clamp(U.r1(h0 + dLy), .3, 60); cy = (nh - h0) / 2; }
        else { nh = U.clamp(U.r1(h0 - dLy), .3, 60); cy = -(nh - h0) / 2; }
        o.w = nw; o.h = nh;
        o.x = U.r1(act.x0 + cx * c - cy * sn);
        o.y = U.r1(act.y0 + cx * sn + cy * c);
        C.schedule({ item: o.id, ui: true });
        return;
      }
      case "rs": {
        const k = Math.hypot(x - o.x, y - o.y) / act.d0;
        o.w = U.clamp(U.r1(act.w0 * k), .3, 40);
        o.h = U.clamp(U.r1(act.h0 * k), .3, 40);
        if (T[o.type].round) o.h = o.w;
        C.schedule({ item: o.id, ui: true });
        return;
      }
      case "rot": {
        if (!act.moved && Math.hypot(e.clientX - act.cx0, e.clientY - act.cy0) < th) return;
        act.moved = true;
        o.rot = snapAngle(Math.atan2(x - o.x, -(y - o.y)) * 180 / Math.PI);
        C.schedule({ item: o.id, ui: true });
        return;
      }
    }
  }

  function endAct(cancel) {
    if (!act) return;
    const a = act;
    act = null;
    if (cancel) {
      drawing = null;
      if (a.pre !== C.store.snap()) C.store.restore(a.pre);
      else C.schedule({ scene: true });
      return;
    }
    if (a.m === "draw") {
      const z = drawing;
      drawing = null;
      if (z) C.store.addZone(z.type, z.w, z.pts, a.pre);
      return;
    }
    if (a.m === "rot" && !a.moved) a.o.rot = (a.o.rot + 45) % 360;
    if (a.m === "mv" && !a.started) { C.schedule({ scene: true, ui: true }); return; }
    C.store.commit(a.pre);
  }

  function onUp(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    svg.style.cursor = "";
    if (pinch) {
      if (ptrs.size < 2) { pinch = null; primary = null; C.view.changed(); }
      return;
    }
    if (e.pointerId !== primary) return;
    primary = null;
    if (pan) {
      const p = pan;
      pan = null;
      if (p.moved) { C.view.changed(); return; }
      if (p.tap) {
        if (S.sel != null) C.store.select(null);
        else if (isTree(p.wx, p.wy)) C.ui.toast("🌳 Arbre existant : il est conservé dans le projet.");
      }
      return;
    }
    endAct(e.type === "pointercancel");
  }

  /* ---------- Clavier sur un élément du plan ---------- */
  function onItemKey(e) {
    const g = e.target && e.target.closest ? e.target.closest("[data-k=item]") : null;
    if (!g) return;
    const o = C.store.find(+g.dataset.id);
    if (!o) return;
    const key = e.key, code = e.code;
    if (key === "Enter" || key === " ") {
      e.preventDefault();
      S.refocus = o.id;
      if (S.sel === o.id) C.schedule({ scene: true }); else C.store.select(o.id);
      C.ui.announce(C.label(o) + ", sélectionné");
      return;
    }
    if (key === "Delete" || key === "Backspace") { e.preventDefault(); e.stopPropagation(); C.ui.removeWithUndo(o.id); return; }

    const pre = C.store.snap();
    const t = T[o.type];
    const plus = key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd";
    const minus = key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract";
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    let done = true;
    if ((key === "r" || key === "R" || code === "KeyR") && !e.ctrlKey && !e.metaKey) {
      if (!t.round) o.rot = ((o.rot + (e.shiftKey ? -15 : 15)) % 360 + 360) % 360;
    } else if (plus || minus) {
      const inc = plus ? .5 : -.5;
      if (e.altKey && !t.round) o.h = U.clamp(U.r1(o.h + inc), .4, 30);
      else { o.w = U.clamp(U.r1(o.w + inc), .4, 30); if (t.round) o.h = o.w; }
    } else if (dir) {
      const st = e.shiftKey ? 2 : .5;
      const nx = U.r1(o.x + dir[0] * st), ny = U.r1(o.y + dir[1] * st);
      if (C.geo.okPos(nx, ny)) { o.x = nx; o.y = ny; }
      else C.ui.announce("Impossible : bord de la cour ou bâtiment");
    } else done = false;

    if (done) {
      e.preventDefault();
      S.refocus = o.id;
      if (S.sel !== o.id) C.store.select(o.id);
      C.store.commit(pre);
      C.ui.announce(`${C.label(o)}, ${C.dimText(o)}`);
    }
  }

  /* ---------- Raccourcis globaux ---------- */
  function onGlobalKey(e) {
    if (document.querySelector("dialog[open]")) return;
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !typing && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) C.ui.redo(); else C.ui.undo(); return; }
    if (mod && !typing && (e.key === "y" || e.key === "Y")) { e.preventDefault(); C.ui.redo(); return; }
    if (typing) return;
    if (e.key === "Escape") {
      if (C.ui.sheetOpen()) C.ui.closeSheet();
      else if (S.brush) C.ui.setBrush(null);
      else if (S.sel != null) C.store.select(null);
      return;
    }
    if (S.sel != null && (e.key === "Delete" || (e.key === "Backspace" && e.target === document.body))) {
      e.preventDefault();
      C.ui.removeWithUndo(S.sel);
      return;
    }
    if (e.code === "Space" && (e.target === document.body || (e.target.closest && e.target.closest("#plan")))) {
      e.preventDefault();
      spaceDown = true;
    }
  }

  function init(svgEl) {
    svg = svgEl;
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("pointerleave", e => {
      if (e.pointerType === "mouse" && hover) { hover = null; if (S.brush) C.schedule({ overlay: true }); }
    });
    svg.addEventListener("contextmenu", e => e.preventDefault());
    svg.addEventListener("wheel", e => {
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
      const k = Math.exp(-dy * (e.ctrlKey ? .01 : .0015));
      C.view.zoomAt(e.clientX, e.clientY, U.clamp(k, .5, 2));
    }, { passive: false });
    // Pincement au trackpad dans Safari (macOS)
    let gs = 1;
    svg.addEventListener("gesturestart", e => { e.preventDefault(); gs = 1; });
    svg.addEventListener("gesturechange", e => {
      e.preventDefault();
      if (ptrs.size) return;          // pincement tactile déjà géré par les pointeurs
      const k = e.scale / gs;
      gs = e.scale;
      C.view.zoomAt(e.clientX, e.clientY, k);
    });
    svg.addEventListener("keydown", onItemKey);
    document.addEventListener("keydown", onGlobalKey);
    document.addEventListener("keyup", e => { if (e.code === "Space") spaceDown = false; });
    window.addEventListener("blur", () => { spaceDown = false; });
  }

  C.interact = {
    init,
    get drawing() { return drawing; },
    get hover() { return hover; },
    get busy() { return !!(act || pinch || pan); }
  };
})(window.Cour);
