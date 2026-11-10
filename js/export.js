/* ==========================================================================
   export.js — Fenêtre « Partager » : affiche A4 (PNG), partage natif,
   téléchargement, texte à copier, impression.
   ========================================================================== */
(function (C) {
  "use strict";
  const S = C.state, T = C.TYPES, U = C.util, CFG = C.CONFIG, G = C.GEO, store = C.store;
  const $ = id => document.getElementById(id);

  const W = 1240, H = 1754, P = 64;                 // A4 à 150 dpi
  const BLEU = "#00205B", CYAN = "#0084D4", VERT = "#00805F", MUTED = "#5B6270";
  const FILE_NAME = "ma-cour-de-reve.png";

  // Cadrage de l'image : cour + bâtiments, avec une marge
  const CROP = (() => {
    const [a, b, c, d] = U.bbox(G.COUR.concat(G.BLD0, G.BLD1));
    const m = 2;
    return [a - m, b - m, c - a + 2 * m, d - b + 2 * m].map(v => Math.round(v * 100) / 100);
  })();

  const fontStack = () => getComputedStyle(document.body).fontFamily || "Arial, sans-serif";
  const courLabel = () => { const f = C.PROFILE.cours.find(([k]) => k === S.profile.cour); return f ? f[1] : ""; };
  const roleLabels = () => C.PROFILE.roles.filter(([k]) => S.profile.roles.includes(k)).map(([, l]) => l);

  /* ---------- Contenu agrégé ---------- */
  function grouped() {
    const st = C.metrics || C.geo.stats(S.objs);
    const map = new Map();
    S.objs.forEach(o => {
      const t = T[o.type];
      if (!t) return;
      const key = o.type;
      const g = map.get(key) || { e: t.e, n: C.label(o), count: 0, m2: 0, zone: !!t.zone };
      g.count++;
      g.m2 += st.areas.get(o.id) || 0;
      map.set(key, g);
    });
    return [...map.values()].map(g => ({
      e: g.e,
      text: g.zone ? `${g.n} (≈ ${Math.round(g.m2)} m²)` : (g.count > 1 ? `${g.count} × ${g.n}` : g.n)
    }));
  }

  function summary() {
    const st = C.metrics || C.geo.stats(S.objs);
    const lines = [`${CFG.titre} — ${CFG.ecole}`];
    const who = [courLabel() && `Cour : ${courLabel()}`, roleLabels().length && `Imaginée par : ${roleLabels().join(", ")}`].filter(Boolean);
    if (who.length) lines.push(who.join(" · "));
    if (S.phrase.trim()) lines.push(`Notre idée : « ${S.phrase.trim()} »`);
    lines.push("", "Ma cour contient :");
    const g = grouped();
    lines.push(...(g.length ? g.map(i => `- ${i.text}`) : ["- (rien pour l'instant)"]));
    lines.push("",
      `Sol perméable : ${Math.round(st.permPct)} % (objectif ${CFG.goals.perm} %)`,
      `Ombre : ${Math.round(st.shadePct)} % (objectif ${CFG.goals.shade} %)`);
    return lines.join("\n");
  }

  /* ---------- Dessin de l'affiche ---------- */
  function planImage(pxPerM) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image du plan impossible à générer"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(C.render.exportSVG(CROP, pxPerM));
    });
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function wrap(g, text, maxW, maxLines) {
    const words = text.split(/\s+/).filter(Boolean), lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (g.measureText(test).width <= maxW) cur = test;
      else { if (cur) lines.push(cur); cur = w; }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    const used = lines.join(" ").split(/\s+/).length;
    if (used < words.length && lines.length) {
      let l = lines[lines.length - 1];
      while (l && g.measureText(l + "…").width > maxW) l = l.slice(0, -1);
      lines[lines.length - 1] = l + "…";
    }
    return lines;
  }
  function ellipsize(g, s, maxW) {
    if (g.measureText(s).width <= maxW) return s;
    while (s.length && g.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s + "…";
  }

  async function poster() {
    const F = fontStack();
    const st = C.metrics || C.geo.stats(S.objs);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.textBaseline = "alphabetic";
    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, H);

    // Bandeau
    g.fillStyle = BLEU;
    g.fillRect(0, 0, W, 196);
    g.fillStyle = "#A1D6CA";
    rr(g, P, 54, 88, 88, 22); g.fill();
    g.font = `52px ${F}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("🌳", P + 44, 100);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "#fff";
    g.font = `500 56px ${F}`;
    g.fillText(CFG.titre, P + 116, 102);
    g.fillStyle = "#DCE4F2";
    g.font = `300 28px ${F}`;
    const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    g.fillText(`${CFG.ecole} · ${date}`, P + 116, 146);

    // Hauteurs des blocs du bas
    const tags = [courLabel(), ...roleLabels()].filter(Boolean);
    const items = grouped();
    const phrase = S.phrase.trim();
    g.font = `400 32px ${F}`;
    const phraseLines = phrase ? wrap(g, `« ${phrase} »`, W - 2 * P - 56, 3) : [];
    const cols = 3, maxRows = 5;
    const rows = Math.min(maxRows, Math.max(1, Math.ceil(items.length / cols)));
    const tagsH = tags.length ? 72 : 0;
    const phraseH = phraseLines.length ? phraseLines.length * 44 + 44 : 0;
    const gaugesH = 150, listH = 56 + rows * 40, footH = 64, gap = 28;
    let y = 228;
    const planH = U.clamp(H - y - tagsH - phraseH - gaugesH - listH - footH - gap * (phraseH ? 4 : 3), 560, 1060);

    // Étiquettes « pour quelle cour / qui »
    if (tags.length) {
      let x = P;
      g.font = `500 24px ${F}`;
      tags.forEach((t, i) => {
        const w = g.measureText(t).width + 36;
        g.fillStyle = i === 0 && courLabel() ? "#EEF2F9" : "#F4F6F8";
        rr(g, x, y, w, 48, 24); g.fill();
        g.fillStyle = BLEU;
        g.fillText(t, x + 18, y + 33);
        x += w + 10;
      });
      y += tagsH;
    }

    // Plan
    const boxW = W - 2 * P;
    g.fillStyle = "#EEF1F4";
    rr(g, P, y, boxW, planH, 24); g.fill();
    const s0 = Math.min(boxW / CROP[2], planH / CROP[3]);
    const img = await planImage(Math.min(30, s0 * 2));
    const dw = CROP[2] * s0, dh = CROP[3] * s0;
    g.save();
    rr(g, P, y, boxW, planH, 24); g.clip();
    g.drawImage(img, P + (boxW - dw) / 2, y + (planH - dh) / 2, dw, dh);
    g.restore();
    y += planH + gap;

    // Phrase
    if (phraseLines.length) {
      g.fillStyle = "#F7EFD3";
      rr(g, P, y, boxW, phraseH, 20); g.fill();
      g.fillStyle = BLEU;
      g.font = `400 32px ${F}`;
      phraseLines.forEach((l, i) => g.fillText(l, P + 28, y + 52 + i * 44));
      y += phraseH + gap;
    }

    // Jauges
    const gw = (boxW - 24) / 2;
    [["Sol perméable", st.permPct, CFG.goals.perm], ["Ombre", st.shadePct, CFG.goals.shade]].forEach(([lbl, pct, goal], i) => {
      const x = P + i * (gw + 24), ok = pct >= goal;
      g.fillStyle = "#F4F6F8";
      rr(g, x, y, gw, gaugesH, 20); g.fill();
      g.fillStyle = MUTED; g.font = `500 24px ${F}`;
      g.fillText(lbl, x + 24, y + 44);
      g.fillStyle = BLEU; g.font = `500 44px ${F}`;
      g.textAlign = "right";
      g.fillText(Math.round(pct) + " %", x + gw - 24, y + 50);
      g.textAlign = "left";
      const bx = x + 24, by = y + 76, bw = gw - 48;
      g.fillStyle = "#E9EDF2"; rr(g, bx, by, bw, 14, 7); g.fill();
      g.fillStyle = ok ? VERT : CYAN; rr(g, bx, by, Math.max(14, bw * pct / 100), 14, 7); g.fill();
      g.fillStyle = BLEU; g.fillRect(bx + bw * goal / 100 - 2, by - 6, 4, 26);
      g.fillStyle = ok ? VERT : MUTED; g.font = `${ok ? 500 : 400} 22px ${F}`;
      g.fillText(ok ? `✓ Objectif de la Ville atteint (${goal} %)` : `Objectif de la Ville : ${goal} %`, bx, y + 128);
    });
    y += gaugesH + gap;

    // Liste
    g.fillStyle = BLEU; g.font = `500 28px ${F}`;
    g.fillText("Ma cour contient", P, y + 30);
    y += 56;
    g.font = `400 24px ${F}`;
    const cw = boxW / cols;
    const shown = items.length > rows * cols ? items.slice(0, rows * cols - 1) : items;
    if (!items.length) { g.fillStyle = MUTED; g.fillText("Rien pour l'instant.", P, y + 26); }
    shown.forEach((it, i) => {
      const cx = P + (i % cols) * cw, cy = y + Math.floor(i / cols) * 40 + 26;
      g.fillStyle = BLEU;
      g.fillText(it.e, cx, cy);
      g.fillStyle = "#2B2F36";
      g.fillText(ellipsize(g, it.text, cw - 56), cx + 40, cy);
    });
    if (shown.length < items.length) {
      const i = shown.length, cx = P + (i % cols) * cw, cy = y + Math.floor(i / cols) * 40 + 26;
      g.fillStyle = MUTED;
      g.fillText(`+ ${items.length - shown.length} autres`, cx + 40, cy);
    }

    // Pied de page
    g.fillStyle = MUTED; g.font = `300 20px ${F}`;
    g.fillText("Plan schématique à l'échelle : positions et surfaces indicatives. Le paysagiste concevra le projet final.", P, H - 36);
    return c;
  }

  /* ---------- Image en cache (le partage natif exige d'être rapide après le clic) ---------- */
  let cache = { blob: null, url: null, key: "" };
  let building = null;
  const stateKey = () => JSON.stringify([S.objs, S.phrase, S.profile]);

  function canvasToBlob(c) {
    return new Promise((resolve, reject) => {
      if (c.toBlob) c.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png");
      else {
        const bin = atob(c.toDataURL("image/png").split(",")[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: "image/png" }));
      }
    });
  }

  async function getBlob() {
    const key = stateKey();
    if (cache.blob && cache.key === key) return cache.blob;
    if (building && building.key === key) return building.p;
    const p = (async () => {
      const blob = await canvasToBlob(await poster());
      if (cache.url) URL.revokeObjectURL(cache.url);
      cache = { blob, url: URL.createObjectURL(blob), key };
      return blob;
    })();
    building = { key, p };
    try { return await p; } finally { if (building && building.p === p) building = null; }
  }

  let previewTimer = 0;
  function refreshPreview() {
    clearTimeout(previewTimer);
    $("sharePreviewState").textContent = "Préparation de l'image…";
    previewTimer = setTimeout(async () => {
      try {
        await getBlob();
        $("sharePreview").src = cache.url;
        $("sharePreviewState").textContent = "Aperçu de l'image (format A4)";
      } catch (e) {
        $("sharePreviewState").textContent = "Aperçu indisponible. Vous pouvez faire une capture d'écran du plan.";
      }
    }, 220);
  }

  /* ---------- Actions ---------- */
  function download(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    C.ui.toast("Image enregistrée dans vos téléchargements.");
  }

  function canShareFiles() {
    try {
      return !!(navigator.canShare && navigator.share &&
        navigator.canShare({ files: [new File([new Blob(["x"], { type: "image/png" })], FILE_NAME, { type: "image/png" })] }));
    } catch (e) { return false; }
  }

  async function shareImage() {
    const btn = $("btnShareImg");
    btn.disabled = true;
    try {
      const blob = await getBlob();
      const file = new File([blob], FILE_NAME, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: CFG.titre, text: summary() });
        } catch (e) {
          if (e && e.name === "AbortError") return;
          download(blob);
        }
      } else download(blob);
    } catch (e) {
      C.ui.toast("Impossible de créer l'image. Faites une capture d'écran du plan.");
    } finally {
      btn.disabled = false;
    }
  }

  async function downloadImage() {
    const btn = $("btnDownload");
    btn.disabled = true;
    try { download(await getBlob()); }
    catch (e) { C.ui.toast("Impossible de créer l'image. Faites une capture d'écran du plan."); }
    finally { btn.disabled = false; }
  }

  async function copyText() {
    const txt = summary();
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); ok = true; }
    } catch (e) { ok = false; }
    if (!ok) {
      const ta = document.createElement("textarea");
      ta.value = txt;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0"; ta.style.top = "0";
      $("dlgShare").appendChild(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
    }
    const span = $("btnCopy").querySelector("span");
    if (ok) {
      span.textContent = "Texte copié ✓";
      setTimeout(() => { span.textContent = "Copier le texte"; }, 1800);
      C.ui.announce("Texte copié");
    } else {
      window.prompt("Copiez ce texte :", txt);
    }
  }

  async function printPoster() {
    const btn = $("btnPrint");
    btn.disabled = true;
    try {
      await getBlob();
      const img = $("printImg");
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        if (img.src === cache.url && img.complete) resolve();
        else img.src = cache.url;
      });
      window.print();
    } catch (e) {
      C.ui.toast("Impression impossible. Téléchargez l'image puis imprimez-la.");
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Formulaire ---------- */
  function buildChips() {
    const cour = $("chipsCour"), roles = $("chipsRoles");
    cour.replaceChildren();
    roles.replaceChildren();
    C.PROFILE.cours.forEach(([k, l]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.k = k; b.textContent = l;
      b.addEventListener("click", () => {
        store.setMeta({ profile: Object.assign({}, S.profile, { cour: S.profile.cour === k ? "" : k }) });
        syncChips(); refreshPreview();
      });
      cour.appendChild(b);
    });
    C.PROFILE.roles.forEach(([k, l]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.k = k; b.textContent = l;
      b.addEventListener("click", () => {
        const set = new Set(S.profile.roles);
        if (set.has(k)) set.delete(k); else set.add(k);
        store.setMeta({ profile: Object.assign({}, S.profile, { roles: [...set] }) });
        syncChips(); refreshPreview();
      });
      roles.appendChild(b);
    });
  }
  function syncChips() {
    $("chipsCour").querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", S.profile.cour === b.dataset.k));
    $("chipsRoles").querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", S.profile.roles.includes(b.dataset.k)));
  }

  function howTo() {
    const p = $("shareHowTo");
    p.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = "Et ensuite ? ";
    p.appendChild(strong);
    p.appendChild(document.createTextNode(CFG.envoi + (CFG.dateLimite ? ` Avant le ${CFG.dateLimite}.` : "")));
    if (CFG.formUrl) {
      p.appendChild(document.createTextNode(" "));
      const a = document.createElement("a");
      a.href = CFG.formUrl; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Répondre aussi au questionnaire";
      p.appendChild(a);
    }
  }

  function open() {
    if (C.ui.sheetOpen()) C.ui.closeSheet();
    if (S.brush) C.ui.setBrush(null, true);
    syncChips();
    $("phrase").value = S.phrase;
    $("phraseCount").textContent = S.phrase.length;
    const native = canShareFiles();
    $("btnShareImg").hidden = !native;
    $("btnDownload").classList.toggle("btn-primary", !native);
    $("btnDownload").classList.toggle("btn-lg", !native);
    $("btnDownload").classList.toggle("btn-tonal", native);
    C.ui.openDialog("dlgShare");
    refreshPreview();
  }

  function init() {
    buildChips();
    howTo();
    const ta = $("phrase");
    ta.addEventListener("input", () => {
      store.setMeta({ phrase: ta.value.slice(0, 140) });
      $("phraseCount").textContent = ta.value.length;
      refreshPreview();
    });
    $("btnShareImg").addEventListener("click", shareImage);
    $("btnDownload").addEventListener("click", downloadImage);
    $("btnCopy").addEventListener("click", copyText);
    $("btnPrint").addEventListener("click", printPoster);
  }

  C.share = { init, open, summary, poster };
})(window.Cour);
