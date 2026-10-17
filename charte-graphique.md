# Charte graphique — Inventaire Jeux

Charte extraite du code source de l'application (`Index.html`, `Scan.html`), destinée à servir de référence commune pour aligner les autres applications internes.

- **Source** : Index.html / Scan.html
- **Plateforme** : Google Apps Script · web mobile
- **Thème** : sombre uniquement, sans bascule clair/sombre
- **Extrait le** : 27 août 2026

---

## 1. Principes

1. **Sombre par défaut** — fond quasi noir teinté de violet (`#0f1220`), jamais de blanc pur. Aucune bascule clair/sombre dans l'app d'origine.
2. **Cartes flottantes** — chaque bloc d'info est une carte à coins très arrondis (16px) posée sur le fond, avec une ombre douce plutôt qu'un contour.
3. **Un seul accent** — un violet unique (`#6c5ce7`) porte toute l'identité de marque ; le reste de la palette est neutre ou sémantique.
4. **Couleur = statut** — vert / rouge / ambre ne décorent jamais : ils signifient toujours trouvé / manquant / non répertorié, en fond de badge ET en bordure.
5. **Pilules pour l'action** — bouton principal, badges et notifications sont tous en `border-radius: 999px` ; le rectangle à coins arrondis est réservé aux surfaces passives.
6. **Labels capitales** — tout texte de méta-info (label de champ, badge, libellé de stat) est en majuscules, petit corps, tracking large — jamais le contenu principal.
7. **Feedback tactile** — chaque élément cliquable réagit au toucher (`scale(0.92–0.98)`, 150ms) — le système est pensé mobile, pas desktop.

---

## 2. Couleurs

### Neutres

| Nom | Token | Hex | Usage |
|---|---|---|---|
| Fond | `--bg` | `#0f1220` | fond de page, jamais utilisé pour du texte ou une carte |
| Surface | `--surface` | `#171b2e` | cartes, lignes de liste, tuiles de stat |
| Surface secondaire | `--surface-2` | `#1f2438` | champs de saisie, boutons icône, toast — un cran plus clair |
| Texte | `--text` | `#f2f3f8` | quasi-blanc, jamais blanc pur (trop dur sur fond sombre) |
| Texte atténué | `--text-muted` | `#9296ad` | sous-titres, labels, méta-données |

### Accent de marque

| Nom | Token | Hex | Usage |
|---|---|---|---|
| Primaire | `--primary` | `#6c5ce7` | CTA, focus des champs, éléments actifs |
| Primaire foncé | `--primary-dark` | `#5849c2` | point sombre du dégradé du bouton principal |

### Sémantique — statut

| Nom | Token | Hex / valeur | Usage |
|---|---|---|---|
| Succès — Trouvé | `--success` / `--success-bg` | `#22c55e` / `rgba(34,197,94,.15)` | valeur de stat, badge, bordure de ligne |
| Danger — Manquant | `--danger` / `--danger-bg` | `#ef4444` / `rgba(239,68,68,.15)` | même usage, cas manquant |
| Avertissement — Non répertorié | `--warning` / `--warning-bg` | `#f59e0b` / `rgba(245,158,11,.15)` | cas ambigu / à vérifier |

> **Règle de couplage** : chaque couleur sémantique n'apparaît jamais seule — toujours associée à sa version `-bg` en opacité pour le fond des badges, et à sa version pleine pour le texte et les bordures.

---

## 3. Typographie

L'app n'embarque aucune police web : elle utilise la pile système du téléphone pour un chargement instantané dans la webview Apps Script.

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

Sur iOS/Android cela résout vers San Francisco ou Roboto : zéro requête réseau, zéro flash de texte invisible. À garder pour toute app « outil » ; à remplacer par une police de marque uniquement pour une app grand public où l'identité visuelle prime sur la vitesse.

### Échelle

| Rôle | Poids · taille | Exemple |
|---|---|---|
| Titre d'écran | 700 · 1.15rem | `Inventaire Jeux` |
| Sous-titre | 400 · 0.8rem | `Synthèse de la collection` |
| Corps / nom | 600 · 0.98rem | `Catan — édition 2019` |
| Valeur de stat | 700 · 1.4rem | `128` |
| Label majuscule | 400 · 0.72–0.75rem, `uppercase`, `letter-spacing: 0.04em` | `SCANNÉ PAR` |
| Badge | 700 · 0.7rem, `uppercase`, `letter-spacing: 0.02em` | `TROUVÉ` |

---

## 4. Espacement & formes

### Rayons

| Valeur | Usage |
|---|---|
| `16px` | cartes |
| `10px` | inputs, petits boutons |
| `999px` | pilules (CTA, badges, toast) |
| `50%` | icônes rondes |

### Ombre unique

```css
--shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
```

### Échelle d'espacement

| Token | Valeur | Usage |
|---|---|---|
| `gap-xs` | 4–6px | entre méta-infos sur une même ligne |
| `gap-sm` | 8–10px | entre cartes de liste, entre stats |
| `pad-input` | 10–12px | padding vertical/horizontal des champs et lignes |
| `pad-card` | 14–16px | padding des cartes et du conteneur principal |
| `content-max` | 640px | largeur max de la page — mobile-first strict |

---

## 5. Composants

- **Carte de saisie** — surface + label majuscule atténué au-dessus d'un input sur `surface-2`, bordure transparente qui devient `--primary` au focus.
- **CTA principal** — pilule pleine largeur, dégradé `linear-gradient(135deg, var(--primary), var(--primary-dark))`, ombre colorée `0 10px 30px rgba(108,92,231,.45)`, icône + libellé centrés.
- **Tuiles de statistiques** — 3 tuiles égales côte à côte, valeur colorée selon le statut, bordure de 2px transparente qui se colore quand la tuile est active (filtre appliqué).
- **Bouton icône circulaire** — 42×42px, fond `surface-2`, s'assombrit/rétrécit au clic ; supporte une animation de rotation (`spin`) pendant un chargement.
- **Ligne de liste** — carte avec **bordure gauche de 4px** colorée selon le statut, nom en gras, badge pilule aligné à droite, méta-données en dessous séparées par des puces `•`.
- **Badge de statut** — pilule, texte capitales, couleur pleine sur fond `-bg` à 15% d'opacité, une variante par statut (Trouvé / Manquant / Non répertorié).
- **Toast** — pilule flottante centrée en bas d'écran, fond `surface-2`, apparaît en glissant (`translateY(20px→0)`), disparaît après 2,2s.
- **État de statut plein cadre** — bloc centré sur fond `success-bg` ou `danger-bg` pour confirmer/infirmer une action (ex. résultat de scan).

---

## 6. Mouvement

| Règle | Où |
|---|---|
| `:active { transform: scale(0.92–0.98) }` | tout élément tapable — boutons, tuiles, cartes |
| `transition: 0.15s ease` | durée standard pour couleur, bordure et transform — jamais plus long sur mobile |
| `spin 0.8s linear infinite` | rotation du bouton rafraîchir pendant le chargement des données |
| `opacity + translateY(20px→0), 0.25s` | apparition du toast, disparition après 2,2s |

---

## 7. Ton & rédaction

### Vocabulaire de statut

- **Trouvé** — succès, vert
- **Manquant** — absent de la collection, rouge
- **Non répertorié** — scanné mais pas dans la liste de référence, ambre

### Règles d'écriture

- Boutons à l'infinitif ou impératif court : « Scanner », « Enregistrer comme manquant »
- Confirmations avec coche/croix : « ✓ Trouvé : … », « ✗ Code-barres inconnu »
- Champs vides via placeholder, jamais de label flottant
- Vouvoiement implicite (« Votre nom »), registre neutre et bref

---

## 8. Appliquer cette charte à une autre app

### Bloc de variables CSS à copier

```css
:root {
  --bg: #0f1220;
  --surface: #171b2e;
  --surface-2: #1f2438;
  --text: #f2f3f8;
  --text-muted: #9296ad;
  --primary: #6c5ce7;
  --primary-dark: #5849c2;
  --success: #22c55e;
  --success-bg: rgba(34, 197, 94, 0.15);
  --danger: #ef4444;
  --danger-bg: rgba(239, 68, 68, 0.15);
  --warning: #f59e0b;
  --warning-bg: rgba(245, 158, 11, 0.15);
  --radius: 16px;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

/* pile système — pas de police web */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    Helvetica, Arial, sans-serif;
}
```

### À garder identique

- Les trois couleurs **sémantiques** et leurs fonds — elles créent la cohérence inter-apps la plus visible
- Les **rayons** (16 / 10 / 999px) et l'**ombre unique**
- La grille de statut : **bordure gauche 4px** + **badge pilule** assortis
- Les **micro-interactions** au toucher (scale + 150ms)
- La **largeur max 640px** pour toute app mobile-first

### À adapter par app

- La teinte `--primary` peut changer pour différencier chaque app tout en gardant la même structure de tokens
- Si l'app a un usage desktop réel, envisager une police de marque via Google Fonts plutôt que la pile système
- Le vocabulaire de statut se remplace par le vocabulaire métier de l'app, en gardant le triptyque **succès / échec / à vérifier**
- Ajouter un thème clair uniquement si un besoin utilisateur réel l'exige — l'original n'en a pas
