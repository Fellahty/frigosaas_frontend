# Frigo SaaS - Bootstrap v1

A React-based SaaS application for managing cold storage facilities with real-time metrics and client management.

## Features

- 🔐 **Authentication**: Secure login with Firebase Auth
- 📊 **Dashboard**: Real-time metrics from Firestore
- 👥 **Client Management**: Read-only client information
- 🌍 **Internationalization**: French (default) and Arabic support
- 📱 **Responsive Design**: Modern UI with TailwindCSS
- 🔥 **Firebase Integration**: Auth, Firestore, and emulators for development

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **Routing**: React Router v6
- **State Management**: @tanstack/react-query
- **Forms**: react-hook-form + zod validation
- **Internationalization**: i18next + react-i18next
- **Backend**: Firebase (Auth, Firestore)
- **Development**: ESLint + Prettier + Vitest

## Project Structure

```
src/
├── app/                    # Application routes and layout
│   ├── i18n/             # Internationalization files
│   ├── Layout.tsx        # Main layout with sidebar
│   ├── App.tsx           # App component with providers
│   └── router.tsx        # Route configuration
├── components/            # Reusable UI components
│   ├── Card.tsx          # Card component
│   ├── Table.tsx         # Table components
│   ├── Spinner.tsx       # Loading spinner
│   └── LangSwitcher.tsx  # Language switcher
├── features/              # Feature-specific components
│   ├── auth/             # Authentication
│   │   └── LoginPage.tsx
│   ├── dashboard/        # Dashboard components
│   │   ├── DashboardPage.tsx
│   │   ├── KpiCards.tsx
│   │   ├── AlertList.tsx
│   │   ├── RoomCapacity.tsx
│   │   ├── TopClientsTable.tsx
│   │   └── RecentMovesTable.tsx
│   └── clients/          # Client management
│       └── ClientsPage.tsx
├── lib/                   # Utility libraries
│   ├── firebase.ts       # Firebase configuration
│   ├── queryClient.ts    # React Query client
│   └── hooks/            # Custom hooks
│       ├── useAuth.ts    # Authentication hook
│       └── useTenantId.ts # Tenant ID hook
└── types/                 # TypeScript type definitions
    └── metrics.ts         # Metrics data types
```

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project (for production)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

### 3. Start Development Server

```bash
# Start the web application
npm run dev:web

# Start Firebase emulators (in another terminal)
npm run emulators:start
```

### 4. Seed Sample Data

After starting the emulators, run the seed script:

```bash
node scripts/seed-data.js
```

This will create sample data in the `metrics_today/YAZAMI` document and some sample clients. + Firestore)
- `npm run emulators:start:all` - Start all Firebase emulators

## Development Workflow

1. **Start emulators**: `npm run emulators:start`
2. **Seed data**: `node scripts/seed-data.js`
3. **Start dev server**: `npm run dev:web`
4. **Access application**: http://localhost:5173

## Default Credentials

For development, you can create a test user in the Firebase Auth emulator or use the Firebase console to create a user.

## Features Overview

### Dashboard
- **KPI Cards**: Total rooms, clients, temperature, humidity, alerts
- **Room Capacity**: Visual representation of room occupancy
- **Alerts**: Real-time alert management
- **Top Clients**: Client usage statistics
- **Recent Moves**: Client movement tracking

### Client Management
- **Read-only Table**: Client information display
- **Mock Data Fallback**: Works without Firestore collection
- **Responsive Design**: Mobile-friendly interface

### Authentication
- **Protected Routes**: Dashboard and clients require login
- **Form Validation**: Email/password with zod schema
- **Error Handling**: User-friendly error messages

### Internationalization
- **French (Default)**: Primary language
- **Arabic Support**: RTL language support
- **Language Switcher**: Easy language switching

## Firebase Emulator Configuration

The application automatically connects to Firebase emulators in development mode:

- **Auth**: http://localhost:9099
- **Firestore**: http://localhost:8080
- **UI**: http://localhost:4000

## Production Deployment

1. Configure Firebase project
2. Set environment variables
3. Build the application: `npm run build`
4. Deploy to Firebase Hosting or your preferred platform

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation as needed
4. Use conventional commit messages

## License

This project is proprietary software.
