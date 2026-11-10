/* ==========================================================================
   data.js — Réglages, plan réel de la cour, catalogue des éléments
   Tout est en mètres. Repère : x vers la droite, y vers le bas (vue du ciel).
   ========================================================================== */
window.Cour = window.Cour || {};

(function (C) {
  "use strict";

  /* ---------- Réglages modifiables ---------- */
  C.CONFIG = {
    titre: "Ma cour de rêve",
    ecole: "École des Agenêts",
    // Texte affiché dans la fenêtre « Partager » : à adapter au canal réel de collecte.
    envoi: "Envoyez l'image aux représentants de parents d'élèves, par mail ou par message.",
    dateLimite: "4 décembre",
    // Lien facultatif vers le questionnaire (Framaforms). Laisser vide pour masquer le lien.
    formUrl: "",
    storageKey: "macour-v5",
    legacyKeys: ["macour4"],
    goals: { perm: 40, shade: 40 },
    // Chiffres du lancement : 200 m² perméables sur 1 500 m².
    permInitial: { m2: 200, sur: 1500 }
  };

  C.NOT_POSSIBLE = ["mare", "piscine", "but de foot", "échelles", "bitume perméable"];

  C.PROFILE = {
    cours: [["maternelle", "Maternelle"], ["elementaire", "Élémentaire"], ["les-deux", "Les deux"]],
    roles: [["enfant", "Enfant"], ["parent", "Parent"], ["enseignant", "Enseignant·e"], ["atsem", "ATSEM"], ["animateur", "Animateur·rice"], ["autre", "Autre"]]
  };

  /* ---------- Géométrie réelle (relevé sur vue aérienne, 40 m = 642 px) ---------- */
  const PX = 16.05;
  const VBW = 1206 / PX, VBH = 1252 / PX;
  const M = a => a.map(([x, y]) => [x / PX, y / PX]);
  // Bâtiments = rectangles à angles droits, repère tourné de -41° (axe du bâtiment R+1)
  const FR = (s, t) => [290 + s * .7548 + t * .6558, 432 - s * .6558 + t * .7548];
  const ADJ = a => a.map(([x, y]) => [x - 2, y - 6]);

  C.GEO = {
    PX, VBW, VBH,
    // Coin nord calé sur la façade du bâtiment R+1 (t = 166) : plus de vide entre cour et bâtiment
    COUR: M([FR(443.4, 166), [962, 438], [480, 1208], [365, 1160], [300, 1105], [115, 925], [82, 822],
      FR(-274, 51), FR(-176, 51), FR(-176, 239), FR(0, 239), FR(108, 239), FR(108, 166)]),
    BLD1: M([FR(0, 0), FR(642, 0), FR(642, 166), FR(0, 166)]),                                  // R+1, 40 m × 10,3 m
    BLD0: M([FR(-176, -264), FR(0, -264), FR(0, 166), FR(108, 166), FR(108, 239), FR(-176, 239)]), // R+0
    GATE: M([[365, 1160], [300, 1105]]),
    TERRE: M([FR(108, 166), FR(443.4, 166), [958, 438], [905, 520], [800, 540], [690, 640], [560, 650], FR(108, 239)]),
    ROAD: M(ADJ([[835, 0], [990, 0], [1177, 168], [1215, 197], [1215, 640], [750, 1260], [555, 1260], [555, 1250], [1170, 432], [1187, 375], [1165, 325]])),
    VERGE: M(ADJ([[748, 282], [885, 138], [978, 148], [1165, 325], [1187, 375], [1170, 432], [553, 1250], [482, 1214], [964, 444]])),
    TREES: [[835, 590, 75], [760, 720, 95], [600, 700, 65], [540, 880, 100], [460, 975, 75], [255, 950, 80],
      [165, 900, 50], [1050, 522, 135], [850, 310, 55], [200, 1060, 55], [1020, 230, 35]].map(([x, y, r]) => [x / PX, y / PX, r / PX]),
    LABELS: [
      { x: 912 / PX, y: 895 / PX, a: -53, t: "Rue du Casterneau · sens unique", fs: 1.7, fill: "#D5D8DC" },
      { x: 1015 / PX, y: 92 / PX, a: 45, t: "Rue des Agenêts", fs: 1.7, fill: "#D5D8DC" }
    ],
    FIT: [2, 13, 62, 77]              // zone affichée par défaut (m) : x0, y0, x1, y1
  };

  /* ---------- Catalogue ---------- */
  C.CATS = [
    { id: "actif", label: "Bouger", e: "🏃" },
    { id: "calme", label: "Se poser", e: "📖" },
    { id: "nature", label: "Nature", e: "🌿" },
    { id: "sols", label: "Sols", e: "🎨" }
  ];

  // Couleur des éléments sur le plan, par catégorie
  C.COL = { actif: "#C7B2DE", calme: "#A4C8E1", nature: "#A1D6CA", sols: "#E5CF85", exist: "#C4C9D0" };

  // w = longueur, h = largeur (m) · perm = part perméable · shade = part d'ombre · round = disque
  C.TYPES = {
    cabane:   { c: "actif", n: "Cabane", e: "🛖", w: 3, h: 3, tip: "Visible depuis toute la cour. Une cabane au moins doit être accessible en fauteuil." },
    filets:   { c: "actif", n: "Structure à filets", e: "🕸️", w: 5, h: 5, tip: "Pour grimper, monter, descendre. Sol amortissant en copeaux autour." },
    escalade: { c: "actif", n: "Mur d'escalade", e: "🧗", w: 4, h: 1, tip: "Escalade à faible hauteur, avec zone de réception en copeaux." },
    grumes:   { c: "actif", n: "Grumes et équilibre", e: "🪵", w: 5, h: .8, tip: "Troncs, rondins, pas japonais : jeux d'équilibre et de motricité." },
    butte:    { c: "actif", n: "Butte à grimper", e: "⛰️", w: 4, h: 4, perm: 1, tip: "Mouvement de terrain : on monte, on roule, on glisse. Bon pour l'eau de pluie." },
    jeux:     { c: "actif", n: "Jeux tracés au sol", e: "🎨", w: 2, h: 4, tip: "Marelle, formes libres. À inventer avec les enfants." },
    local:    { c: "actif", n: "Local roulants", e: "🚲", w: 3, h: 2, tip: "Rangement des draisiennes et trottinettes, accessible aux enfants par une double porte." },
    tables:   { c: "calme", n: "Table pique-nique", e: "🧺", w: 2.4, h: 1.9, tip: "Table accessible aux fauteuils." },
    bancs:    { c: "calme", n: "Banc", e: "🪑", w: 2, h: .5, tip: "Bancs, grumes, assises pour se poser en petit groupe." },
    gradins:  { c: "calme", n: "Gradins", e: "🎭", w: 6, h: 2.5, tip: "Amphithéâtre : spectacles, discussions, classe dehors." },
    classe:   { c: "calme", n: "Coin classe dehors", e: "📚", w: 4, h: 3, tip: "Un coin à l'ombre pour faire la classe dehors." },
    tableau:  { c: "calme", n: "Tableau extérieur", e: "🖍️", w: 2, h: .4, tip: "Un vieux tableau à craie, en libre accès." },
    lecture:  { c: "calme", n: "Coin lecture", e: "📖", w: 3, h: 3, tip: "Espace calme, à l'écart des jeux de course." },
    arbre:    { c: "nature", n: "Arbre", e: "🌳", w: 6, h: 6, round: 1, perm: .05, shade: 1, tip: "Diamètre de la couronne à maturité. Sans fruits qui tombent, non toxique." },
    haie:     { c: "nature", n: "Haie, arbustes", e: "🌿", w: 5, h: 1, perm: 1, tip: "Végétation basse et persistante, non toxique." },
    potager:  { c: "nature", n: "Potager", e: "🥕", w: 4, h: 2.5, perm: 1, tip: "En pleine terre, au soleil, près d'un récupérateur d'eau. Il faut des volontaires l'été." },
    sable:    { c: "nature", n: "Bac à sable", e: "🪣", w: 4, h: 4, perm: 1, tip: "Zone de manipulation fine en maternelle. Au soleil, fermable pour l'entretien." },
    hotel:    { c: "nature", n: "Hôtel à insectes", e: "🐞", w: 1, h: 1, tip: "À construire avec les enfants. Accueille la biodiversité." },
    nichoir:  { c: "nature", n: "Nichoir", e: "🐦", w: .8, h: .8, tip: "Simple à installer avec les enfants." },
    pergola:  { c: "nature", n: "Pergola", e: "🍇", w: 5, h: 3, shade: 1, tip: "Ombre avec des plantes grimpantes. Un préau neuf coûte au moins 100 000 € de plus." },
    voile:    { c: "nature", n: "Voile ou parasol", e: "⛱️", w: 5, h: 5, shade: 1, tip: "Ombre rapide. Les grandes voiles sont lourdes à manipuler." },
    tunnel:   { c: "nature", n: "Tunnel végétal", e: "🌱", w: 5, h: 1.2, perm: 1, shade: .5, tip: "Saule ou noisetier vivant : une cachette qui pousse." },
    recup:    { c: "nature", n: "Récupérateur d'eau", e: "💧", w: 1, h: 1, tip: "Pour arroser le potager. À demander s'il sera utilisé. Pas de point d'eau en maternelle." },
    copeaux:  { c: "sols", zone: 1, n: "Copeaux de bois", e: "🍂", perm: 1, fill: "#C9A56A", op: .8, tip: "Sol amortissant et perméable. Rechargé deux fois par an par la Ville." },
    herbe:    { c: "sols", zone: 1, n: "Herbe, prairie", e: "🌱", perm: 1, fill: "#00B388", op: .5, tip: "Fragile : environ 6 mois de repos par an. Plutôt sur les bords." },
    terre:    { c: "sols", zone: 1, n: "Terre à gratter", e: "🟤", perm: 1, fill: "#8B5E3C", op: .5, tip: "Zone de terre sans copeaux pour creuser et dessiner." },
    stabilise:{ c: "sols", zone: 1, n: "Sable stabilisé", e: "▫️", perm: .5, fill: "#E5CF85", op: .95, tip: "Pour les cheminements accessibles : partiellement perméable." },
    circuit:  { c: "sols", zone: 1, n: "Circuit vélos", e: "🚲", perm: 0, fill: "#8374D1", op: .45, tip: "Sol roulant pour draisiennes et tricycles, avec marquage de circuit." },
    piste:    { c: "sols", zone: 1, n: "Piste jaune", e: "🏃", perm: 0, fill: "#DAAA00", op: .9, tip: "Piste bien visible pour courir sans gêner les autres." },

    // Équipements actuels (gris) : ils peuvent être supprimés ou déplacés.
    ex_echiquier: { c: "exist", n: "Échiquier géant", e: "♟️", w: 3.6, h: 3.6, tip: "Jeu au sol actuel. Vous pouvez le garder, le déplacer ou le supprimer." },
    ex_toboggan:  { c: "exist", n: "Toboggan", e: "🛝", w: 4.4, h: 3, tip: "Coin jeu actuel. Vous pouvez le garder, le déplacer ou le supprimer." },
    ex_sable:     { c: "exist", n: "Bac à sable actuel", e: "🪣", w: 4, h: 4, tip: "Bac à sable actuel. Vous pouvez le garder, le déplacer ou le supprimer." },
    ex_marquage:  { c: "exist", n: "Marquages au sol", e: "🎨", w: 5, h: 8, tip: "Circuit peint, marelle : à garder ou à supprimer." }
  };

  // Plan de départ : les équipements existants
  C.SEED = function () {
    const r1 = v => Math.round(v * 10) / 10;
    return [
      { id: 1, kind: "item", type: "ex_echiquier", x: r1(632 / PX), y: r1(618 / PX), w: 3.6, h: 3.6, rot: 320 },
      { id: 2, kind: "item", type: "ex_toboggan", x: r1(665 / PX), y: r1(550 / PX), w: 4.4, h: 3, rot: 319 },
      { id: 3, kind: "item", type: "ex_sable", x: r1(650 / PX), y: r1(785 / PX), w: 4, h: 4, rot: 0 },
      { id: 4, kind: "item", type: "ex_marquage", x: r1(430 / PX), y: r1(1040 / PX), w: 5, h: 8, rot: 0 }
    ];
  };
})(window.Cour);
