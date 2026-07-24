# FrigoSmart — Conception SaaS

> **FrigoSmart** est la plateforme. **YAZAMI**, **Casa Frigo**, etc. sont des **clients** (tenants) qui louent le service.

## 1. Modèle métier

```
┌─────────────────────────────────────────────────────────────────┐
│  FRIGOSMART (éditeur / opérateur SaaS)                           │
│  • Vend des abonnements aux entrepôts frigorifiques               │
│  • Panel admin : clients, abonnements, usage, support             │
│  • Base : frigosmart_platform                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ 1 organisation = 1 client payant
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌───────────┐       ┌───────────┐       ┌───────────┐
   │  YAZAMI   │       │ Frigo Casa│       │  ...      │
   │ (tenant)  │       │ (tenant)  │       │           │
   │ frigo_*   │       │ frigo_*   │       │           │
   └───────────┘       └───────────┘       └───────────┘
```

| Acteur | Rôle | Où il se connecte |
|--------|------|-------------------|
| **Équipe FrigoSmart** | super_admin, support, billing | `admin.frigosmart.com` ou `/admin` |
| **Gestionnaire frigo** | admin, manager du tenant | `{slug}.frigosmart.com` ou `/login/{slug}` |
| **Client final** (agriculteur, grossiste) | client du frigo | même portail tenant, type « Client » |

**Règle d'or :** un utilisateur tenant n'accède **jamais** aux données d'un autre tenant.

---

## 2. Domaines & routing (cible production)

| URL | Application | Auth |
|-----|-------------|------|
| `frigosmart.com` | Site marketing | Public |
| `admin.frigosmart.com` | Panel FrigoSmart | `scope: platform` |
| `{slug}.frigosmart.com` | App du frigo `{slug}` | `scope: tenant` |
| `api.frigosmart.com` | API REST | JWT selon route |

**Dev local :**

| URL | Équivalent |
|-----|------------|
| `localhost:3000/admin` | Panel plateforme |
| `localhost:3000/login/yazami` | Login tenant YAZAMI |
| `yazami.localhost:3000` | Sous-domaine tenant (si configuré) |

---

## 3. Couches techniques

### 3.1 Données

| Base | Contenu | Qui y accède |
|------|---------|--------------|
| `frigosmart_platform` | Organizations, Subscriptions, PlatformUsers, UsageMetrics | API `/api/admin/*` |
| `frigo_{slug}` | clients, chambres, réceptions, factures… | API tenant du frigo connecté |

**Isolation :** une base MongoDB par client. Pas de `tenantId` obligatoire dans chaque document (isolation physique).

### 3.2 API

| Préfixe | Scope JWT | Usage |
|---------|-----------|-------|
| `/api/public/*` | Aucun | Branding login, infos publiques |
| `/api/platform/auth/*` | — | Login équipe FrigoSmart |
| `/api/admin/*` | `platform` | Gestion clients & abonnements |
| `/api/auth/*` | — / `tenant` | Login & session tenant |
| `/api/data/*` | `tenant` | Données métier (shim Firestore → Mongo) |
| `/api/tenants/:id/*` | `tenant` | CRUD REST natif |

### 3.3 Frontend (3 surfaces)

| Surface | Dossier | Token |
|---------|---------|-------|
| App tenant | `src/features/*` (hors admin) | `token` |
| Admin plateforme | `src/features/admin/*` | `platform_token` |
| Auth tenant | `src/features/auth/LoginPage` | — |

**Ne pas mélanger** les logins admin et tenant sur la même action utilisateur en production.

---

## 4. Résolution du tenant (ordre de priorité)

1. **Sous-domaine** — `yazami.frigosmart.com` → slug `yazami`
2. **Chemin URL** — `/login/yazami`
3. **Session** — JWT `tenantId` après login
4. **Défaut dev** — `VITE_DEFAULT_TENANT_SLUG=yazami` (jamais en prod)

Implémentation : `src/lib/tenantResolver.ts` + `src/app/TenantProvider.tsx`

---

## 5. Cycle de vie d'un client

```
1. PROVISION (admin FrigoSmart)
   POST /api/admin/organizations
   → Crée org dans platform DB
   → Crée base frigo_{slug}
   → Crée admin du frigo

2. ESSAI (status: trial)
   → trialEndsAt +30j
   → Accès limité par plan (maxRooms, maxUsers, maxClients)

3. ACTIF (status: active)
   → Abonnement status: active
   → Facturation manuelle ou Stripe (futur)

4. SUSPENDU (status: suspended)
   → Login refusé
   → API tenant bloquée

5. ANNULÉ (status: cancelled)
   → Données conservées, accès coupé
```

---

## 6. Plans & limites

| Plan | Chambres | Users | Clients finaux |
|------|----------|-------|----------------|
| starter | 10 | 5 | 100 |
| pro | 50 | 20 | 500 |
| enterprise | illimité | illimité | illimité |

Limites stockées sur `Organization`, vérifiées à la création (users, clients, rooms).

---

## 7. Sécurité

- **2 secrets JWT** distincts (tenant ≠ platform)
- **Registry obligatoire** en production (`REQUIRE_TENANT_REGISTRY=true`)
- **Validation session** : `GET /api/auth/me` au chargement de l'app
- **Gate login** : statut org + fin d'essai avant authentification
- **Rate limiting** sur login et admin

---

## 8. Dette technique connue (roadmap)

| Priorité | Sujet | Statut |
|----------|-------|--------|
| P0 | Contexte tenant unique, fin des fallbacks YAZAMI | En cours |
| P0 | Validation JWT au boot frontend | En cours |
| P0 | Gate login (suspendu / essai expiré) | En cours |
| P1 | Branding dynamique (impressions, PDF) | À faire |
| P1 | Normaliser chemins Firestore → collections tenant | À faire |
| P2 | Stripe / facturation auto | À faire |
| P2 | Self-service signup | À faire |
| P2 | Split deploy admin / tenant | À faire |

---

## 9. Commandes opérationnelles

```bash
# Initialiser la plateforme + enregistrer YAZAMI
cd backend && npm run seed:platform

# Créer un nouveau client frigo
npm run provision:tenant -- --slug=casa --name="Frigo Casa" \
  --adminEmail=admin@casa.com --adminPassword=secret123

# Dev
cd backend && npm run dev    # :3001
npm run dev                  # :3000

# Tests
cd backend && npm test
```

---

## 10. Comptes par défaut (dev)

| Surface | Email | Mot de passe |
|---------|-------|--------------|
| Admin FrigoSmart | superadmin@frigosmart.com | superadmin123 |
| Frigo YAZAMI | admin@frigosaas.com | admin123 |

Voir aussi : [backend/ARCHITECTURE.md](../backend/ARCHITECTURE.md)
