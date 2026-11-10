/* ==========================================================================
   main.js — Démarrage et ordonnanceur de rendu
   Toutes les mises à jour passent par C.schedule() : une seule image par
   frame, et le bilan (plus coûteux) est recalculé après une courte pause.
   ========================================================================== */
(function (C) {
  "use strict";
  const S = C.state;

  let pending = {}, raf = 0, statsTimer = 0;

  function flush() {
    raf = 0;
    const p = pending;
    pending = {};
    if (p.scene) C.render.dynamic();
    else {
      if (p.zones) C.render.zones();
      if (p.items) p.items.forEach(id => C.render.item(id));
      if (p.overlay || p.items) C.render.overlay();
    }
    if (p.ui) C.ui.update();
    C.ui.positionBar();
  }
  function runStats() {
    C.metrics = C.geo.stats(S.objs);
    C.ui.updateStats(C.metrics);
  }

  // flags : scene (tout), zones, item (id d'un élément), overlay, ui, stats
  C.schedule = function (flags) {
    if (flags.item != null) (pending.items = pending.items || new Set()).add(flags.item);
    for (const k in flags) if (k !== "item") pending[k] = pending[k] || flags[k];
    if (flags.stats) {
      clearTimeout(statsTimer);
      statsTimer = setTimeout(runStats, 60);
    }
    if (!raf) raf = requestAnimationFrame(flush);
  };

  function start() {
    C.store.load();
    const host = document.getElementById("plan"), svg = document.getElementById("plan-svg");
    C.view.init(host, svg);
    C.render.init(svg);
    C.ui.init();
    C.share.init();
    C.interact.init(svg);

    C.bus.on("change", () => C.schedule({ scene: true, ui: true, stats: true }));
    C.bus.on("select", () => C.schedule({ scene: true, ui: true }));

    C.view.fit();
    C.render.dynamic();
    C.ui.update();
    runStats();

    // Recadrage quand la zone du plan change de taille (rotation, dock, fenêtre)
    const onResize = () => {
      if (C.view.userZoom) C.view.apply(); else C.view.fit();
      C.schedule({ scene: true });
    };
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(host);
    else window.addEventListener("resize", onResize);

    if (!S.onboarded) C.ui.openWelcome();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window.Cour);
