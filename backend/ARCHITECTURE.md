# FrigoSmart SaaS — Multi-tenant

> **Conception métier & produit :** voir [docs/SAAS.md](../docs/SAAS.md)

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    FRIGOSMART PLATFORM                       │
│  MongoDB: frigosmart_platform                               │
│  • Organizations (chaque frigo)                              │
│  • Subscriptions (abonnements)                               │
│  • PlatformUsers (super admin FrigoSmart)                    │
│  • UsageMetrics (statistiques par frigo)                     │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │ frigo_yazami│    │ frigo_xxx   │    │ frigo_yyy   │
   │  (MongoDB)  │    │  (MongoDB)  │    │  (MongoDB)  │
   │ clients     │    │ clients     │    │ clients     │
   │ rooms       │    │ rooms       │    │ rooms       │
   │ receptions  │    │ receptions  │    │ receptions  │
   └─────────────┘    └─────────────┘    └─────────────┘
```

## 3 niveaux d'accès

| Rôle | Panel | Base de données |
|------|-------|-----------------|
| **super_admin** | `/admin` — tous les frigos, abonnements, usage | `frigosmart_platform` |
| **admin/manager** | `/dashboard` — son frigo uniquement | `frigo_{slug}` |
| **client** | `/client` — portail client | `frigo_{slug}` |

## Isolation des données

Chaque frigo (organization) a **sa propre base MongoDB** :
- `dbName`: `frigo_yazami`, `frigo_casablanca`, etc.
- Aucune fuite de données entre frigos
- Scalable : gros frigos sur serveurs dédiés possible

## API

| Préfixe | Usage |
|---------|-------|
| `POST /api/platform/auth/login` | Login super admin FrigoSmart |
| `GET /api/admin/organizations` | Liste des frigos |
| `POST /api/admin/organizations` | Créer un nouveau frigo + sa DB |
| `GET /api/admin/organizations/:id/usage` | Usage / statistiques |
| `POST /api/auth/login` | Login utilisateur frigo (inchangé) |
| `/api/data/*` | Données du frigo connecté |

## Créer un nouveau frigo

```bash
cd backend
npm run seed:platform          # une fois
npm run provision:tenant -- --slug=casa --name="Frigo Casa"
```

## Comptes par défaut (après seed)

| Panel | Email | Mot de passe |
|-------|-------|--------------|
| Admin FrigoSmart | `superadmin@frigosmart.com` | `superadmin123` |
| Frigo YAZAMI | `admin@frigosaas.com` | `admin123` |

## Sécurité

| Mesure | Détail |
|--------|--------|
| **JWT séparés** | `JWT_SECRET` (frigos clients) ≠ `PLATFORM_JWT_SECRET` (admin FrigoSmart) |
| **Scope token** | `scope: tenant` vs `scope: platform` — pas d'interchange |
| **Isolation tenant** | JWT `tenantId` doit correspondre à l'URL / chemin Firestore |
| **Registry obligatoire** | En production, seuls les clients enregistrés dans `frigosmart_platform` sont accessibles |
| **Noms DB validés** | Seuls `frigo_*` (+ legacy `frigosaas`) autorisés |
| **Rate limiting** | Login: 20 req/15min · API: 300 req/15min · Admin: 60 req/15min |
| **Helmet** | Headers HTTP sécurisés |
| **Erreurs** | Messages internes masqués en production |

## Scalabilité base de données

| Mécanisme | Valeur par défaut | Variable env |
|-----------|-------------------|--------------|
| Pool MongoDB par connexion | 10 connexions max | `MONGO_MAX_POOL_SIZE` |
| Cache connexions tenant | 40 bases max | `TENANT_MAX_CONNECTIONS` |
| Éviction connexions idle | 10 minutes | `TENANT_CONNECTION_IDLE_MS` |
| Cache registry clients | 1 minute TTL | `ORG_CACHE_TTL_MS` |
| Indexes tenant auto | users, clients, rooms, receptions… | créés à la provision |

### Croissance (100+ clients)

1. **MongoDB Atlas** — cluster M10+ avec plusieurs bases sur même cluster
2. **Sharding futur** — grouper petits clients, DB dédiée pour gros clients (`enterprise`)
3. **Réplicas** — `MONGODB_BASE_URI` pointe vers replica set
4. **Monitoring** — `GET /api/admin/system` (super_admin) : connexions actives, cache

### Production checklist

```bash
# backend/.env
NODE_ENV=production
JWT_SECRET=<64 chars random>
PLATFORM_JWT_SECRET=<64 chars different random>
REQUIRE_TENANT_REGISTRY=true
PLATFORM_MONGODB_URI=mongodb+srv://...
MONGODB_BASE_URI=mongodb+srv://cluster/
```
