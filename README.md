# Care App

A shared mobile caregiving application for iPhone and Android.

Built with React Native, Expo SDK 57, TypeScript, Expo Router, and Supabase.

---

## Development Setup

### Prerequisites

- Node.js 18+
- Xcode (for iOS Simulator and device builds)
- Android Studio (for Android Emulator)
- A free Supabase account at https://supabase.com

### 1. Clone and install

```bash
git clone <repo-url>
cd care-app
npm install
```

### 2. Create your Supabase project

1. Go to https://supabase.com and sign in.
2. Create a new project (choose the free tier).
3. Once the project is ready, go to **Project Settings → API**.
4. Copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 3. Configure environment variables

```bash
cp .env.example .env.local
# Edit .env.local and paste your Supabase URL and anon key
```

Never commit `.env.local`. It is gitignored.

### 4. Run in Expo Go (early development only)

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your phone, or press `i` for iOS Simulator or `a` for Android Emulator.

### 5. Local development build (recommended from Milestone 1 onward)

Local builds let you use native modules (notifications, widgets) that Expo Go cannot run.

**iOS Simulator:**
```bash
npx expo run:ios
```
Requires Xcode installed. Compiles and installs in the iOS Simulator.

**Android Emulator:**
```bash
npx expo run:android
```
Requires Android Studio and a running emulator.

**Physical iPhone (free Personal Team — no Apple Developer Program required):**
```bash
npx expo run:ios --device
```
Connect your iPhone via USB. Xcode will sign with your free Personal Team certificate.
The development build expires after 7 days; just run the command again to reinstall.

### 6. Run checks

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript (tsc --noEmit)
npm run format      # Prettier (writes in place)
```

---

## Project Structure

```
src/
  app/              # Expo Router file-based routes
    (auth)/         # Sign-in, sign-up (Milestone 1)
    (app)/          # Authenticated tabs: today, timeline, summary, appointments, settings
  components/       # Presentational React Native components (no business logic)
  features/         # Domain logic per feature (no JSX) — feeds, diapers, medications, etc.
  hooks/            # Custom React hooks
  lib/
    supabase/       # Supabase client + generated database types
    dates/          # Timezone-aware date utilities
  services/         # Cross-cutting services (notifications)
  types/            # Shared TypeScript types
  constants/        # Colors, spacing, thresholds
  utils/            # Pure utility functions

supabase/
  migrations/       # Versioned SQL migration files (committed to Git)
  seed/             # Optional dev seed data
```

---

## Build Milestones

| # | Milestone | Status |
|---|---|---|
| 0 | Project foundation | Done |
| 1 | Authentication | Next |
| 2 | Household and care recipient | |
| 3 | Feeding MVP | |
| 4 | Notifications | |
| 5 | Multi-caregiver realtime | |
| 6 | Diapers | |
| 7 | Medications | |
| 8 | Care notes / notable events | |
| 9 | Timeline | |
| 10 | Summary | |
| 11 | Appointments | |
| 12 | iOS Widget / Live Activity | |
| 13 | Android Widget | |

---

## Key Decisions

- **`EXPO_PUBLIC_*` env vars** are inlined at build time. Safe for public Supabase keys. Never use service-role keys in the app.
- **Local scheduled notifications** only (no push infrastructure in MVP). See `KNOWN_LIMITATIONS.md`.
- **Stable `Tabs` from `expo-router`** — not the experimental `NativeTabs` from the SDK 57 template.
- **`supabase/migrations/`** — all schema changes go here as numbered SQL files, committed to Git.
- **$0/month infrastructure** — Supabase free tier, local builds, no paid services.
