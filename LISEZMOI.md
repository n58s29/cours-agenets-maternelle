# Ma cour de rêve — outil familles (v5)

Ouvrir `index.html` dans un navigateur, en double-clic : rien à installer, pas de serveur, rien n'est envoyé en ligne. Pour diffuser l'outil aux familles, déposer le dossier entier sur un hébergement statique.

## Réglages (`js/data.js`, bloc `C.CONFIG`)

- `envoi` : la phrase « Et ensuite ? » de la fenêtre Partager (le canal de retour des images).
- `dateLimite` : 4 décembre.
- `formUrl` : lien vers le questionnaire Framaforms. Laisser vide pour masquer le lien.

## Fichiers

| Fichier | Rôle |
|---|---|
| `css/tokens.css` | Couleurs, typo et rayons de la charte FAN |
| `css/layout.css` | Mise en page ordinateur, téléphone et impression |
| `css/components.css` | Boutons, cartes, jauges, fenêtres |
| `js/data.js` | Réglages, plan réel, catalogue des éléments |
| `js/geometry.js` | Calcul du bilan (sol perméable, ombre) |
| `js/art.js` | Illustrations des éléments et textures des sols |
| `js/store.js` | État, annuler / rétablir, sauvegarde locale |
| `js/view.js` | Zoom et déplacement du plan |
| `js/render.js` | Dessin SVG du plan |
| `js/interactions.js` | Gestes tactiles, souris, clavier |
| `js/ui.js` | Catalogue, mini-barre de l'élément, pinceau, bilan |
| `js/export.js` | Image A4, partage, copie du texte, impression |
| `js/main.js` | Démarrage |

Les plans déjà dessinés avec l'ancienne maquette (`macour4`) sont repris automatiquement.
