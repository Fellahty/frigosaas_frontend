# Mode Opérateur Tablette — FrigoSmart

## 1. Architecture actuelle (résumé)

| Couche | Choix |
|--------|--------|
| Frontend | React 18 + Vite + React Router + Tailwind + i18next (fr/ar) |
| Backend | Express + TypeScript + Mongoose (MongoDB) |
| Auth | JWT tenant (`Bearer`), rôles `admin \| manager \| viewer \| client` |
| Ops stock | Collections schemaless via `/api/data/*` : `receptions`, `pallet-collections` |
| Saisons | Modèle typé `Season` ; écritures sur saison **active** ; header `X-Selected-Season-Id` |
| Impression | 100 % client (`window.print` / HTML thermique) — pas de file d’attente serveur |
| Scanner | `qr-scanner` sur `/pallet-scanner` |

## 2. Fonctionnalités réutilisées

| Domaine | Réutilisation |
|---------|----------------|
| Clients / chambres | Modèles `Client`, `Room` + routes existantes |
| Saison active | `season.service` (`getActiveSeason`, `assertSeasonWritable`) |
| Réceptions / palettes | Collections `receptions` + `pallet-collections` (même schéma que ReceptionPage) |
| Numérotation palette | Format existant `PAL-{YYYYMMDD}-{clientCode}-{NNN}` (généré **côté serveur** en mode opérateur) |
| QR / scan | Logique de `PalletScannerPage` + lib `qr-scanner` |
| Tickets | Templates HTML existants (réception / sortie) adaptés en adapters d’impression |
| Auth JWT | Même `signToken` / `authMiddleware` ; nouveau rôle `operator` |
| Audit | Extension via `OperatorAudit` + `Log` existant |
| Rate limit | `authRateLimiter` existant + verrouillage PIN dédié |

## 3. Décisions d’implémentation

1. **Route dédiée** `/operator/*` avec `OperatorLayout` (pas le Layout admin).
2. **Rôle `operator`** ajouté au modèle `User` ; PIN 4 chiffres hashé (`pinHash`), jamais en clair.
3. **API typée** `/api/tenants/:tenantId/operator/*` — mutations atomiques, idempotency key, audit.
4. **Pas de duplication** des calculs stock admin : les écritures produisent les mêmes documents que la réception classique.
5. **Impression découplée** : file `PrintJob` + `PrinterAdapter` (browser / android_native / network / local_agent).
6. **Échec d’impression ≠ rollback stock**.
7. **Offline v1** : conservation locale du formulaire + bannière réseau ; pas de sync stock offline.

## 4. Endpoints opérateur

```
GET  /api/auth/operators?tenantId=          # liste opérateurs (id, name) pour login PIN
POST /api/auth/operator-login               # { tenantId, operatorId, pin }
GET  /api/tenants/:tid/operator/context
GET  /api/tenants/:tid/operator/clients
GET  /api/tenants/:tid/operator/rooms
POST /api/tenants/:tid/operator/entries
GET  /api/tenants/:tid/operator/pallets/:code
POST /api/tenants/:tid/operator/pallets/:id/exit
POST /api/tenants/:tid/operator/pallets/:id/move
GET  /api/tenants/:tid/operator/recent-operations
GET  /api/tenants/:tid/operator/client-stock/:clientId
GET  /api/tenants/:tid/operator/print-jobs
POST /api/tenants/:tid/operator/print-jobs
POST /api/tenants/:tid/operator/print-jobs/:id/retry
GET  /api/tenants/:tid/operator/printables
```

Rôles autorisés sur les mutations : `operator`, `admin`, `manager` (admin/manager pour support / tests).

## 5. Migrations / modèles

Sans Prisma : Mongoose schémas évolutifs.

- `User.role` += `operator` ; champs `pinHash`, `pinFailedAttempts`, `pinLockedUntil`
- `PrintJob` (collection `printjobs`)
- `OperatorAudit` (collection `operatoraudits`)
- `SiteSettings.printing` (config imprimantes)
- Collections saisonnières : `printjobs` optionnel via `seasonId`

Script seed optionnel : créer un opérateur démo avec PIN `1234`.

## 6. Phases

| Phase | Contenu | Statut |
|-------|---------|--------|
| 1 | Rôle, routes, layout, garde | Implémenté |
| 2 | Login PIN, home, entrée, idempotency, audit | Implémenté |
| 3 | Scan, sorties, déplacement, réimpression, stock | Implémenté |
| 4 | Adapters impression, templates, file, statut | Implémenté |
| 5 | Capacitor / Bluetooth (préparé, non branché matériel) | Préparé |

## 7. Hypothèses

- Un tenant = un site (comme SEASONS.md).
- Les opérateurs ne créent pas de clients (sauf si admin l’autorise plus tard).
- Une « entrée opérateur » crée une réception `status: completed` + une palette unique.
- Les sorties mettent à jour `remainingCrates` / `remainingWeight` sur la palette et ferment si zéro.
- Le mode Android natif nécessite un wrap Capacitor ultérieur ; le navigateur reste le défaut.

## Déploiement tablette Android

1. Ouvrir Chrome (ou WebView) sur `https://{tenant}.frigosmart…/operator/login`
2. Ajouter à l’écran d’accueil (PWA / raccourci) pour plein écran
3. Autoriser caméra (scan QR) et pop-ups d’impression
4. Créer un utilisateur **Opérateur** + PIN dans Utilisateurs
5. Paramètres → Impression → mode `browser` (v1) ou préparer Capacitor pour `android_native`

### Impression

- **browser** : dialogue système Android (recommandé v1)
- **android_native** : stub prêt pour Capacitor + SDK fabricant
- **network_printer / local_print_agent** : architecture prête, fallback navigateur

Échec d’impression ≠ rollback stock. Réimprimer via « Réimpression » (mention **DUPLICATA**).

## 8. Limitations connues

- Pas de sync stock offline multi-appareils.
- Adapter `android_native` est un stub prêt pour Capacitor (pas de SDK fabricant embarqué).
- Les anciennes réceptions sans champs `remaining*` sont lues avec fallback sur `crates` / `totalCrates`.
- Les tests E2E navigateur tablet ne sont pas automatisés (checklist manuelle dans ce document).

## 9. Checklist E2E manuelle

1. Créer opérateur + PIN
2. `/operator/login` → PIN → Accueil
3. Nouvelle entrée → client → chambre → quantité → Créer et imprimer
4. Scanner palette → sortie partielle → sortie complète
5. Déplacement chambre
6. Réimpression (DUPLICATA)
7. Couper réseau → message clair + draft conservé
8. Vérifier UI admin `/dashboard` inchangée
