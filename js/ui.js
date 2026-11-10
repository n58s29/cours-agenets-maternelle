/* ==========================================================================
   ui.js — Interface autour du plan : catalogue, élément sélectionné, pinceau,
   bilan, notifications, boîtes de dialogue.
   ========================================================================== */
(function (C) {
  "use strict";
  const S = C.state, T = C.TYPES, U = C.util, CFG = C.CONFIG, store = C.store;
  const $ = id => document.getElementById(id);
  const app = () => $("app");

  let tab = C.CATS[0].id;
  let brushHintShown = false;

  const tileBg = t => (t.fill ? hexA(t.fill, Math.min(.85, (t.op || 1))) : C.COL[t.c]);
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function h(tag, attrs, html) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  }
  const icon = id => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ---------- Annonces lecteur d'écran ---------- */
  let liveTimer = 0;
  function announce(msg) {
    const l = $("live");
    l.textContent = "";
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { l.textContent = msg; }, 40);
  }

  /* ---------- Notifications ---------- */
  function toast(msg, opt = {}) {
    const box = $("toasts");
    while (box.children.length >= 2) box.firstElementChild.remove();
    const el = h("div", { class: "toast", role: "status" });
    el.appendChild(h("span", { text: msg }));
    let timer = 0;
    const close = () => {
      clearTimeout(timer);
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    };
    if (opt.action) {
      const b = h("button", { type: "button", text: opt.action });
      b.addEventListener("click", () => { close(); opt.onAction && opt.onAction(); });
      el.appendChild(b);
    }
    box.appendChild(el);
    timer = setTimeout(close, opt.duration || (opt.action ? 6000 : 3200));
    announce(msg);
  }

  /* ---------- Catalogue ---------- */
  function buildTabs() {
    const box = $("catTabs");
    box.replaceChildren();
    C.CATS.forEach(c => {
      const b = h("button", { type: "button", class: "tab", role: "tab", id: "tab-" + c.id, "aria-controls": "catCards" },
        `<span class="e" aria-hidden="true">${c.e}</span><span>${c.label}</span>`);
      b.addEventListener("click", () => { tab = c.id; updateTabs(); buildCards(); });
      box.appendChild(b);
    });
    box.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const i = C.CATS.findIndex(c => c.id === tab);
      const n = (i + (e.key === "ArrowRight" ? 1 : -1) + C.CATS.length) % C.CATS.length;
      tab = C.CATS[n].id;
      updateTabs();
      buildCards();
      $("tab-" + tab).focus();
      e.preventDefault();
    });
    updateTabs();
  }
  function updateTabs() {
    C.CATS.forEach(c => {
      const b = $("tab-" + c.id);
      b.setAttribute("aria-selected", c.id === tab);
      b.tabIndex = c.id === tab ? 0 : -1;
    });
    $("catCards").setAttribute("aria-labelledby", "tab-" + tab);
  }
  function buildCards() {
    const box = $("catCards");
    box.replaceChildren();
    if (tab === "sols") box.appendChild(h("p", { class: "cards-hint", text: "Choisissez un sol, puis peignez-le sur le plan." }));
    Object.entries(T).filter(([, t]) => t.c === tab).forEach(([id, t]) => {
      const b = h("button", { type: "button", class: "card", "data-type": id, title: t.tip });
      b.innerHTML = `<span class="tile tile-art" aria-hidden="true"></span><span class="card-label">${t.n}</span>${t.zone ? '<span class="card-tag" aria-hidden="true">Peindre</span>' : ""}`;
      b.querySelector(".tile").appendChild(C.art.preview(id));
      b.setAttribute("aria-label", t.zone ? `Peindre : ${t.n}` : `Ajouter : ${t.n}`);
      if (t.zone) b.setAttribute("aria-pressed", S.brush === id);
      b.addEventListener("click", () => (t.zone ? setBrush(S.brush === id ? null : id) : addItem(id)));
      box.appendChild(b);
    });
    box.scrollLeft = 0;
    box.scrollTop = 0;
  }
  function updateCardsPressed() {
    $("catCards").querySelectorAll(".card[aria-pressed]").forEach(b => b.setAttribute("aria-pressed", S.brush === b.dataset.type));
  }

  function addItem(type) {
    if (S.brush) setBrush(null, true);
    const o = store.add(type, C.view.cx, C.view.cy);
    if (!o) return;
    // On rapproche la vue pour que l'élément soit assez grand à l'écran pour être pris en main
    const V = C.view, t = T[type];
    const want = (C.input.coarse ? 130 : 110) / Math.max(o.w, t.round ? o.w : o.h);
    const target = Math.min(V.fitSc * (C.input.coarse ? 5 : 3.5), want);
    if (target > V.sc * 1.05) { V.sc = target; V.panTo(o.x, o.y); }
    else V.ensureVisible(o.x, o.y);
    toast(`${T[type].e} ${T[type].n} ajouté. Glissez-le pour le placer.`);
  }

  /* ---------- Pinceau ---------- */
  function buildSwatches() {
    const box = $("swatches");
    box.replaceChildren();
    Object.entries(T).filter(([, t]) => t.zone).forEach(([id, t]) => {
      const b = h("button", { type: "button", class: "swatch", "data-type": id, "aria-pressed": "false" },
        `<i aria-hidden="true"></i><span>${t.n}</span>`);
      b.querySelector("i").appendChild(C.art.preview(id));
      b.addEventListener("click", () => setBrush(id));
      box.appendChild(b);
    });
    const er = h("button", { type: "button", class: "swatch", "data-type": "erase", "aria-pressed": "false" },
      `<i aria-hidden="true" style="background:var(--corail-100);color:var(--rouge-fonce)">${icon("i-eraser")}</i><span>Gomme</span>`);
    er.addEventListener("click", () => setBrush("erase"));
    box.prepend(er);           // la gomme en premier : toujours visible sur téléphone

    const range = $("brushSize");
    range.value = S.brushSize;
    const sync = () => {
      const v = U.fr(S.brushSize);
      $("brushSizeOut").textContent = v + " m";
      range.setAttribute("aria-valuetext", v + " mètres");
    };
    sync();
    range.addEventListener("input", () => {
      S.brushSize = +range.value || 2.5;
      sync();
      store.save();
      C.schedule({ overlay: true });
    });
    $("brushDone").addEventListener("click", () => setBrush(null));
  }

  function setBrush(type, silent) {
    S.brush = type || null;
    if (S.brush && S.sel != null) S.sel = null;
    if (!silent) {
      if (!S.brush) announce("Pinceau rangé");
      else if (S.brush === "erase") announce("Gomme activée");
      else announce(`Pinceau ${T[S.brush].n} activé`);
      if (S.brush && !brushHintShown) {
        brushHintShown = true;
        toast(C.input.coarse ? "Peignez avec un doigt. Deux doigts pour déplacer le plan." : "Cliquez-glissez pour peindre. Clic droit ou Espace pour déplacer le plan.");
      }
    }
    C.schedule({ scene: true, ui: true });
  }

  function updateBrushPanel() {
    if (!S.brush) return;
    const isErase = S.brush === "erase";
    const t = T[S.brush];
    const ico = $("brushIco");
    if (isErase) { ico.innerHTML = icon("i-eraser"); ico.style.background = "var(--corail-100)"; ico.style.color = "var(--rouge-fonce)"; }
    else { ico.replaceChildren(C.art.preview(S.brush)); ico.style.background = ""; ico.style.color = ""; }
    $("brushTitle").textContent = isErase ? "Gomme" : "Peindre : " + t.n;
    $("brushHelp").textContent = isErase
      ? "Passez sur un sol peint pour l'effacer."
      : (C.input.coarse ? "Un doigt pour peindre · deux doigts pour bouger le plan" : "Cliquez-glissez pour peindre · clic droit pour bouger le plan");
    $("swatches").querySelectorAll(".swatch").forEach(b => b.setAttribute("aria-pressed", b.dataset.type === S.brush));
  }

  /* ---------- Élément sélectionné ---------- */
  function updateInspector() {
    const o = store.selected();
    if (!o) return;
    const t = T[o.type];
    const ico = $("inspIco");
    ico.replaceChildren(C.art.preview(o.type));
    ico.style.background = "";
    $("inspName").replaceChildren(document.createTextNode(t.n));
    if (t.c === "exist") $("inspName").appendChild(h("span", { class: "badge", text: "Existant" }));
    $("inspDims").textContent = C.dimText(o, C.metrics && C.metrics.areas);
    $("inspTip").textContent = t.tip;
  }

  /* ---------- Mini-barre posée sur l'élément sélectionné ---------- */
  function positionBar() {
    const bar = $("objBar");
    const o = store.selected();
    if (!o || S.brush) { if (!bar.hidden) bar.hidden = true; return; }
    const V = C.view, r = V.rect();
    if (!r.width) return;
    const toS = (x, y) => [(x - V.cx) * V.sc + r.width / 2, (y - V.cy) * V.sc + r.height / 2];
    let pts;
    if (o.kind === "item") {
      const F = C.render.frameOf(o, V.sc), a = o.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const loc = [[-F.fw / 2, -F.fh / 2], [F.fw / 2, -F.fh / 2], [F.fw / 2, F.fh / 2], [-F.fw / 2, F.fh / 2], [0, F.rotY - 14 / V.sc]];
      pts = loc.map(([lx, ly]) => toS(o.x + lx * c - ly * s, o.y + lx * s + ly * c));
    } else {
      const b = U.bbox(o.pts), hw = o.w / 2;
      pts = [toS(b[0] - hw, b[1] - hw), toS(b[2] + hw, b[3] + hw)];
    }
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const lbl = `${T[o.type].n} · ${C.dimText(o, C.metrics && C.metrics.areas)}`;
    const L = $("objBarLbl");
    if (L.textContent !== lbl) L.textContent = lbl;
    if (bar.hidden) bar.hidden = false;
    const bw = bar.offsetWidth, bh = bar.offsetHeight, gap = 12;
    const bottomSafe = r.height - (window.innerWidth < 1024 ? 30 : 12);
    let top = maxY + gap;
    if (top + bh > bottomSafe) top = minY - bh - gap;
    top = U.clamp(top, 8, Math.max(8, bottomSafe - bh));
    const left = U.clamp((minX + maxX) / 2 - bw / 2, 8, Math.max(8, r.width - bw - 8));
    bar.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  function removeWithUndo(id) {
    const o = store.find(id);
    if (!o) return;
    const name = C.label(o);
    store.remove(id);
    toast(`${name} supprimé.`, { action: "Annuler", onAction: () => undo() });
  }

  function bindInspector() {
    $("objBar").addEventListener("click", e => {
      const b = e.target.closest("button[data-act]");
      const o = store.selected();
      if (!b || !o) return;
      if (b.dataset.act === "dup") {
        const c = store.duplicate(o.id);
        if (c) { toast(`${T[c.type].n} dupliqué.`); if (c.kind === "item") C.view.ensureVisible(c.x, c.y); }
      } else if (b.dataset.act === "del") removeWithUndo(o.id);
    });
    // La barre ne doit pas déclencher de geste sur le plan
    $("objBar").addEventListener("pointerdown", e => e.stopPropagation());
    $("inspDone").addEventListener("click", () => store.select(null));
  }

  /* ---------- Bilan ---------- */
  function setGauge(id, pct, m2, goal) {
    const g = $(id), ok = pct >= goal;
    g.classList.toggle("ok", ok);
    g.querySelector('[data-role="val"]').textContent = Math.round(pct) + " %";
    g.querySelector(".gauge-fill").style.width = pct + "%";
    g.querySelector(".gauge-goal").style.left = goal + "%";
    const tr = g.querySelector(".gauge-track");
    tr.setAttribute("aria-valuenow", Math.round(pct));
    tr.setAttribute("aria-valuetext", `${Math.round(pct)} %, objectif ${goal} %`);
    const missing = Math.max(0, Math.ceil(goal / 100 * C.geo.area - m2));
    g.querySelector('[data-role="note"]').textContent = ok
      ? `✓ Objectif de la Ville atteint (${goal} %) · ${Math.round(m2)} m²`
      : `Objectif ${goal} % · encore ≈ ${missing} m² à gagner`;
  }

  function updateStats(st) {
    const G = CFG.goals;
    setGauge("gPerm", st.permPct, st.permM2, G.perm);
    setGauge("gShade", st.shadePct, st.shadeM2, G.shade);
    $("spPerm").textContent = Math.round(st.permPct) + " %";
    $("spShade").textContent = Math.round(st.shadePct) + " %";
    const pb = $("spPermBar"), sb = $("spShadeBar");
    pb.style.width = st.permPct + "%"; pb.classList.toggle("ok", st.permPct >= G.perm);
    sb.style.width = st.shadePct + "%"; sb.classList.toggle("ok", st.shadePct >= G.shade);
    $("scorePill").setAttribute("aria-label", `Voir le bilan : sol perméable ${Math.round(st.permPct)} %, ombre ${Math.round(st.shadePct)} %`);
    $("baseline").textContent = `Cour : ${Math.round(st.area)} m². Au départ : ${Math.round(C.geo.PERM0)} m² perméables (chiffres du lancement) et ${Math.round(C.geo.shade0Area)} m² d'ombre sous les arbres existants.`;
    updateList(st);
    if (S.sel != null) updateInspector();
  }

  function updateList(st) {
    const ul = $("objList");
    ul.replaceChildren();
    $("listCount").textContent = S.objs.length;
    if (!S.objs.length) {
      ul.appendChild(h("li", { class: "empty", text: "Rien pour l'instant. Ajoutez un élément depuis la liste." }));
      return;
    }
    S.objs.forEach(o => {
      const t = T[o.type];
      const li = h("li");
      const b = h("button", { type: "button", "data-id": o.id });
      b.innerHTML = `<span class="e" aria-hidden="true">${t.e}</span><span class="n"></span><span class="d"></span>`;
      b.querySelector(".n").textContent = C.label(o);
      b.querySelector(".d").textContent = C.dimText(o, st.areas);
      if (o.id === S.sel) b.setAttribute("aria-current", "true");
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function bindList() {
    $("objList").addEventListener("click", e => {
      const b = e.target.closest("button[data-id]");
      if (!b) return;
      const o = store.find(+b.dataset.id);
      if (!o) return;
      if (S.brush) setBrush(null, true);
      store.select(o.id);
      if (o.kind === "item") C.view.ensureVisible(o.x, o.y);
      else { const bb = U.bbox(o.pts); C.view.ensureVisible((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2); }
      if (sheetOpen()) closeSheet();
      announce(C.label(o) + ", sélectionné");
    });
  }

  /* ---------- Feuille « bilan » (téléphone) ---------- */
  let sheetReturn = null;
  function sheetOpen() { return app().dataset.sheet === "bilan"; }
  function openSheet() {
    sheetReturn = document.activeElement;
    app().dataset.sheet = "bilan";
    $("side").setAttribute("role", "dialog");
    $("side").setAttribute("aria-modal", "true");
    setTimeout(() => $("sideClose").focus(), 60);
  }
  function closeSheet() {
    delete app().dataset.sheet;
    $("side").removeAttribute("role");
    $("side").removeAttribute("aria-modal");
    if (sheetReturn && sheetReturn.focus) sheetReturn.focus();
  }

  /* ---------- Boîtes de dialogue ---------- */
  function openDialog(id) {
    const d = $(id);
    if (d.open) return;
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }
  function closeDialog(d) {
    if (typeof d.close === "function") d.close();
    else { d.removeAttribute("open"); d.dispatchEvent(new Event("close")); }
  }
  function bindDialogs() {
    document.querySelectorAll("dialog").forEach(d => {
      d.addEventListener("click", e => {
        if (e.target.closest("[data-close]")) { closeDialog(d); return; }
        // clic sur le fond (hors boîte)
        if (e.target === d) {
          const r = d.getBoundingClientRect();
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) closeDialog(d);
        }
      });
    });
    $("dlgWelcome").addEventListener("close", () => { if (!S.onboarded) store.setMeta({ onboarded: true }); });
    $("welcomeHelp").addEventListener("click", () => { closeDialog($("dlgWelcome")); openDialog("dlgHelp"); });
    $("btnHelp").addEventListener("click", () => openDialog("dlgHelp"));
    $("btnReset").addEventListener("click", async () => {
      closeDialog($("dlgHelp"));
      const ok = await confirmBox("Recommencer à zéro ?", "Vos ajouts seront effacés et les équipements actuels reviendront. Vous pourrez encore annuler juste après.", "Recommencer");
      if (!ok) return;
      store.reset();
      C.view.fit();
      toast("Plan remis à zéro.", { action: "Annuler", onAction: () => undo() });
    });
  }

  function confirmBox(title, text, okLabel) {
    return new Promise(resolve => {
      const d = $("dlgConfirm");
      $("confirmTitle").textContent = title;
      $("confirmText").textContent = text;
      const ok = $("confirmOk");
      ok.textContent = okLabel || "Confirmer";
      let result = false;
      const onOk = () => { result = true; closeDialog(d); };
      ok.addEventListener("click", onOk, { once: true });
      d.addEventListener("close", () => { ok.removeEventListener("click", onOk); resolve(result); }, { once: true });
      openDialog("dlgConfirm");
    });
  }

  /* ---------- Annuler / rétablir ---------- */
  function undo() {
    if (store.undo()) announce("Action annulée");
    else toast("Rien à annuler.");
  }
  function redo() {
    if (store.redo()) announce("Action rétablie");
  }

  /* ---------- Mise à jour générale ---------- */
  function update() {
    const mode = S.brush ? "brush" : (store.selected() ? "inspect" : "catalog");
    if (app().dataset.mode !== mode) app().dataset.mode = mode;
    $("btnUndo").disabled = !store.canUndo();
    $("btnRedo").disabled = !store.canRedo();
    updateCardsPressed();
    updateBrushPanel();
    updateInspector();
    const cur = $("objList").querySelector('[aria-current="true"]');
    if (cur && +cur.dataset.id !== S.sel) cur.removeAttribute("aria-current");
    if (S.sel != null) {
      const b = $("objList").querySelector(`[data-id="${S.sel}"]`);
      if (b) b.setAttribute("aria-current", "true");
    }
  }

  function init() {
    document.querySelectorAll(".js-not-possible").forEach(s => { s.textContent = C.NOT_POSSIBLE.join(", "); });
    buildTabs();
    buildCards();
    buildSwatches();
    bindInspector();
    bindList();
    bindDialogs();
    $("btnUndo").addEventListener("click", undo);
    $("btnRedo").addEventListener("click", redo);
    $("btnShare").addEventListener("click", () => C.share.open());
    $("zoomIn").addEventListener("click", () => C.view.zoomBy(1.4));
    $("zoomOut").addEventListener("click", () => C.view.zoomBy(1 / 1.4));
    $("zoomFit").addEventListener("click", () => { C.view.fit(); C.schedule({ scene: true }); announce("Vue d'ensemble"); });
    $("scorePill").addEventListener("click", openSheet);
    $("sideClose").addEventListener("click", closeSheet);
    $("scrim").addEventListener("click", closeSheet);
    // Quitter le mode feuille si on passe en grand écran
    if (window.matchMedia) {
      const mq = matchMedia("(min-width: 1024px)");
      const onMq = () => { if (mq.matches && sheetOpen()) closeSheet(); };
      if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
    }
  }

  C.ui = {
    init, update, updateStats, toast, announce,
    setBrush, removeWithUndo, undo, redo, positionBar,
    sheetOpen, openSheet, closeSheet,
    openDialog, closeDialog, confirmBox,
    openWelcome: () => openDialog("dlgWelcome"),
    tileBg
  };
})(window.Cour);
