# Frigo SaaS API

Backend Node.js + Express + MongoDB pour remplacer Firebase.

## Prérequis

- Node.js 18+
- MongoDB (local ou Atlas)

## Installation

```bash
cd backend
npm install
cp .env.example .env   # si .env n'existe pas
```

## Démarrer MongoDB

```bash
# macOS avec Homebrew
brew services start mongodb-community

# ou Docker
docker run -d -p 27017:27017 --name frigosaas-mongo mongo:7
```

## Lancer l'API

```bash
# Terminal 1 — API
npm run dev

# Terminal 2 — Données de test
npm run seed
```

L'API est disponible sur **http://localhost:3001**

## Endpoints disponibles

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Santé du serveur |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Utilisateur courant (JWT) |
| GET | `/api/tenants/:tenantId/users` | Liste utilisateurs |
| GET | `/api/tenants/:tenantId/clients` | Liste clients |
| POST | `/api/tenants/:tenantId/clients` | Créer client |
| GET | `/api/tenants/:tenantId/rooms` | Liste chambres |
| GET | `/api/tenants/:tenantId/settings` | Paramètres site |

## Exemple login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginField":"admin@frigosaas.com","password":"admin123","tenantId":"YAZAMI"}'
```

## Comptes de test (après seed)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@frigosaas.com | admin123 |
| Test | test@gmail.com | password123 |
| Client | client1@demo.com | client123 |

## Structure

```
backend/
├── src/
│   ├── config/       # env, database
│   ├── models/       # Mongoose schemas
│   ├── routes/       # REST endpoints
│   ├── middleware/   # JWT auth
│   ├── services/     # logique métier
│   └── utils/        # helpers
└── scripts/
    └── seed.ts       # données initiales
```

## Tests

```bash
cd backend
npm test              # run all route tests
npm run test:watch    # watch mode
```

Les tests utilisent une base MongoDB séparée (`frigosaas_test`).

## Migration Firebase → MongoDB

```bash
# Aperçu sans écrire (dry run)
npm run migrate:firebase:dry

# Migration réelle
npm run migrate:firebase

# Options
TENANT_ID=YAZAMI npm run migrate:firebase
```

Le script migre :
- **Modèles structurés** : users, clients, rooms, settings, logs
- **Collections brutes** : reservations, cashMovements, receptions, trucks, etc. → collection `importedrecords`

Les clés Firebase sont lues depuis `backend/.env` ou le `.env` parent du projet.

## Prochaines étapes

- [ ] Réservations, caisse, réceptions
- [ ] Upload fichiers (multer)
- [ ] Migration données Firebase → MongoDB
- [ ] Connecter le frontend React à cette API
