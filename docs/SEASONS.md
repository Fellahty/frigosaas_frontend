# Gestion des saisons de stockage — FrigoSmart

## Architecture

Dans FrigoSmart, **un tenant = un site frigorifique** (une base MongoDB `frigo_{slug}`).
Il n’existe pas de modèle multi-sites : `siteId` sur `Season` est égal à `tenantId` (compatibilité future).

| Couche | Choix |
|--------|--------|
| Modèle | `Season` (Mongoose typé) dans chaque DB tenant |
| Saison active | `status: "active"` (index unique partiel) — pas de `activeSeasonId` dupliqué |
| Ops saisonnières | Collections schemaless : `receptions`, `reservations`, `empty_crate_loans`, `pallet-collections`, `invoices`, `cashMovements`, `cautions`/`caution_records`, `pendingCollections` |
| Permanents | `users`, `clients`, `rooms`, capteurs, `SiteSettings`, camions, produits… |
| Capteurs / températures | **Pas** de `seasonId` sur les mesures — filtre par `season.startDate` / `endDate` |
| Écritures | Toujours sur la **saison active** (jamais sur la saison consultée) |
| Lecture | Filtre `seasonId` via header `X-Selected-Season-Id` / body `seasonId` (sauf saison active en Phase 1 pour ne pas masquer les docs non migrés) |

## API

Préfixe : `/api/tenants/:tenantId/seasons`

| Méthode | Route | Rôles |
|---------|-------|-------|
| GET | `/` | authentifié |
| GET | `/active` | authentifié |
| GET | `/:id` | authentifié |
| GET | `/:id/closing-check` | authentifié |
| POST | `/` | admin, manager |
| PATCH | `/:id` | admin, manager |
| POST | `/:id/activate` | admin, manager |
| POST | `/:id/close` | admin, manager |
| POST | `/:id/archive` | admin, manager |
| POST | `/:id/reopen` | admin |
| POST | `/:id/transfer-stock` | admin, manager |
| POST | `/:id/carry-balances` | admin |

## Migration

### Simulation

```bash
cd backend
npm run migrate:seasons:dry
# ou un seul tenant :
TENANT_ID=YAZAMI npm run migrate:seasons:dry
```

### Application

```bash
cd backend
npm run migrate:seasons
TENANT_ID=YAZAMI npm run migrate:seasons
```

Comportement :

1. Pour chaque organisation, crée une saison `Saison historique` (`code: HISTORICAL`) si besoin
2. Backfill `seasonId` sur les collections opérationnelles sans écraser les IDs existants
3. Idempotent / rejouable
4. Ne touche pas aux mesures capteurs

### Phases

- **Phase 1 (actuelle)** : `seasonId` optionnel + fallback écriture sans saison active (logué) + lecture active sans filtre strict
- **Phase 2** : après vérification que 100 % des docs ont un `seasonId`, rendre le champ obligatoire et retirer le fallback

## Frontend

- Paramètres → onglet **Saisons**
- Sélecteur global dans le layout (filtre d’affichage)
- Bannière lecture seule si saison clôturée / archivée sélectionnée

## Déploiement

1. Déployer le backend (modèle + routes + injection data)
2. Exécuter `migrate:seasons:dry` puis `migrate:seasons` sur chaque environnement
3. Déployer le frontend
4. Créer / activer la saison courante si la saison historique a été créée en `active`
5. Vérifier les logs `[season] fallback` — ils doivent disparaître après migration + saison active

## Rollback

- Les nouvelles collections `seasons`, `season_stock_movements`, `season_opening_balances` peuvent rester (aucune suppression de données métier)
- Retirer le filtrage frontend (sélecteur) si besoin
- Les `seasonId` sur documents existants sont inoffensifs si le code ancien les ignore
- **Ne jamais** dropper la DB ni supprimer massivement les documents historiques

## Risques à surveiller

- Clôture bloquée par stock restant → utiliser le transfert de stock avant clôture
- Transactions Mongo : le transfert utilise `insertMany` + clés d’idempotence (pas de replica set obligatoire)
- Double chemin collections (`tenants/{id}/…` vs root) — le backfill couvre les noms de collections Mongo réels
- `SiteSettings.season {from,to}` legacy reste pour l’UI tarifs ; la source de vérité campagne est `Season`
