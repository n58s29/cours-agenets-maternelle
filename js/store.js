/* ==========================================================================
   store.js — État de l'application, historique (annuler / rétablir),
   sauvegarde locale (localStorage) et petit bus d'évènements.
   ========================================================================== */
(function (C) {
  "use strict";
  const T = C.TYPES, U = C.util, CFG = C.CONFIG;

  /* ---------- Bus d'évènements ---------- */
  const listeners = {};
  C.bus = {
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit(ev, data) { (listeners[ev] || []).forEach(fn => fn(data)); }
  };

  /* ---------- État ---------- */
  const S = C.state = {
    objs: [],
    uid: 1,
    sel: null,            // id de l'élément sélectionné
    brush: null,          // type de sol, "erase" ou null
    brushSize: 2.5,       // m
    phrase: "",
    profile: { cour: "", roles: [] },
    onboarded: false,
    justAdded: null,      // id animé à l'apparition
    refocus: null         // id à refocaliser après rendu (clavier)
  };

  const undoStack = [], redoStack = [];
  const MAX_HISTORY = 80;
  const snap = () => JSON.stringify(S.objs);

  /* ---------- Sauvegarde ---------- */
  function persist() {
    try {
      localStorage.setItem(CFG.storageKey, JSON.stringify({
        v: 5, objs: S.objs, uid: S.uid, phrase: S.phrase, profile: S.profile,
        brushSize: S.brushSize, onboarded: S.onboarded
      }));
    } catch (e) { /* stockage indisponible : on continue sans sauvegarde */ }
  }
  let saveTimer = 0;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 200); }
  window.addEventListener("pagehide", persist);

  // Valide un objet relu depuis le stockage (données anciennes ou abîmées)
  function sanitize(o) {
    if (!o || !T[o.type] || !U.num(o.id)) return null;
    if (o.kind === "item") {
      if (![o.x, o.y, o.w, o.h].every(U.num)) return null;
      return { id: o.id, kind: "item", type: o.type, x: o.x, y: o.y, w: o.w, h: o.h, rot: U.num(o.rot) ? ((o.rot % 360) + 360) % 360 : 0 };
    }
    if (o.kind === "zone") {
      if (!U.num(o.w) || !Array.isArray(o.pts) || !o.pts.length) return null;
      const pts = o.pts.filter(p => Array.isArray(p) && U.num(p[0]) && U.num(p[1]));
      if (!pts.length || !T[o.type].zone) return null;
      return { id: o.id, kind: "zone", type: o.type, w: o.w, pts };
    }
    return null;
  }

  function load() {
    let data = null;
    try {
      const raw = localStorage.getItem(CFG.storageKey);
      if (raw) data = JSON.parse(raw);
      else {
        for (const k of CFG.legacyKeys) {
          const old = localStorage.getItem(k);
          if (old) { data = JSON.parse(old); data.onboarded = true; break; }
        }
      }
    } catch (e) { data = null; }

    if (data && Array.isArray(data.objs)) {
      S.objs = data.objs.map(sanitize).filter(Boolean);
      S.phrase = typeof data.phrase === "string" ? data.phrase.slice(0, 140) : "";
      if (data.profile && typeof data.profile === "object") {
        S.profile.cour = typeof data.profile.cour === "string" ? data.profile.cour : "";
        S.profile.roles = Array.isArray(data.profile.roles) ? data.profile.roles.filter(r => typeof r === "string") : [];
      }
      if (U.num(data.brushSize)) S.brushSize = U.clamp(data.brushSize, 1, 8);
      S.onboarded = !!data.onboarded;
    } else {
      S.objs = C.SEED();
    }
    const maxId = S.objs.reduce((m, o) => Math.max(m, o.id), 0);
    S.uid = Math.max(U.num(data && data.uid) ? data.uid : 1, maxId + 1, 10);
  }

  /* ---------- Placement ---------- */
  // Cherche une position libre autour d'un point (dans la cour, hors bâtiments)
  function freePos(cx, cy) {
    const j = () => (Math.random() - .5) * 1.2;
    const ring = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, 3], [3, -3], [-3, -3], [6, 0], [-6, 0], [0, 6], [0, -6]];
    for (const [dx, dy] of ring) {
      const x = cx + dx + j(), y = cy + dy + j();
      if (C.geo.okPos(x, y)) return [U.r1(x), U.r1(y)];
    }
    for (let k = 0; k < 80; k++) {
      const x = 37.5 + (Math.random() - .5) * 14, y = 47 + (Math.random() - .5) * 14;
      if (C.geo.okPos(x, y)) return [U.r1(x), U.r1(y)];
    }
    return [37.5, 47];
  }

  /* ---------- API ---------- */
  const store = C.store = {
    load,
    save,
    snap,
    find: id => S.objs.find(o => o.id === id) || null,
    selected: () => (S.sel == null ? null : store.find(S.sel)),

    // Valide une modification faite depuis l'instantané « pre »
    commit(pre) {
      if (pre !== snap()) {
        undoStack.push(pre);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack.length = 0;
      }
      if (S.sel != null && !store.find(S.sel)) S.sel = null;
      save();
      C.bus.emit("change");
    },
    // Restaure un instantané sans toucher à l'historique (geste annulé)
    restore(pre) {
      S.objs = JSON.parse(pre);
      if (S.sel != null && !store.find(S.sel)) S.sel = null;
      C.bus.emit("change");
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    undo() {
      if (!undoStack.length) return false;
      redoStack.push(snap());
      S.objs = JSON.parse(undoStack.pop());
      if (S.sel != null && !store.find(S.sel)) S.sel = null;
      save();
      C.bus.emit("change");
      return true;
    },
    redo() {
      if (!redoStack.length) return false;
      undoStack.push(snap());
      S.objs = JSON.parse(redoStack.pop());
      if (S.sel != null && !store.find(S.sel)) S.sel = null;
      save();
      C.bus.emit("change");
      return true;
    },

    select(id) {
      const next = id == null ? null : id;
      if (S.sel === next) return;
      S.sel = next;
      C.bus.emit("select", next);
    },

    add(type, cx, cy) {
      const t = T[type];
      if (!t || t.zone) return null;
      const pre = snap(), [x, y] = freePos(cx, cy);
      const o = { id: S.uid++, kind: "item", type, x, y, w: t.w, h: t.h, rot: 0 };
      S.objs.push(o);
      S.sel = o.id;
      S.justAdded = o.id;
      store.commit(pre);
      C.bus.emit("select", o.id);
      return o;
    },

    addZone(type, w, pts, pre) {
      if (!T[type] || !pts.length) return null;
      const z = { id: S.uid++, kind: "zone", type, w, pts };
      S.objs.push(z);
      store.commit(pre);
      return z;
    },

    remove(id) {
      const o = store.find(id);
      if (!o) return null;
      const pre = snap();
      S.objs = S.objs.filter(i => i.id !== id);
      if (S.sel === id) S.sel = null;
      store.commit(pre);
      C.bus.emit("select", S.sel);
      return o;
    },

    duplicate(id) {
      const o = store.find(id);
      if (!o) return null;
      const pre = snap();
      let c;
      if (o.kind === "item") {
        let x = U.r1(o.x + 1.5), y = U.r1(o.y + 1.5);
        if (!C.geo.okPos(x, y)) [x, y] = freePos(o.x, o.y);
        c = Object.assign({}, o, { id: S.uid++, x, y });
      } else {
        c = { id: S.uid++, kind: "zone", type: o.type, w: o.w, pts: o.pts.map(([x, y]) => [U.r2(x + 1.5), U.r2(y + 1.5)]) };
      }
      S.objs.push(c);
      S.sel = c.id;
      S.justAdded = c.id;
      store.commit(pre);
      C.bus.emit("select", c.id);
      return c;
    },

    reset() {
      const pre = snap();
      S.objs = C.SEED();
      S.uid = Math.max(S.uid, 10);
      S.sel = null;
      store.commit(pre);
      C.bus.emit("select", null);
    },

    setMeta(patch) {
      Object.assign(S, patch);
      save();
      C.bus.emit("meta");
    }
  };
})(window.Cour);
