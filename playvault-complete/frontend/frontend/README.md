# PlayVault Local Frontend

This is the existing PlayVault React/Vite frontend connected to the new local backend instead of Supabase.

## Run

1. Copy `.env.example` to `.env`.
2. Make sure the local PlayVault backend is running on port 4000.
3. Install dependencies:

```bash
npm install
```

4. Start Vite:

```bash
npm run dev
```

The app will normally be available at `http://localhost:5173`.

## Supabase
Supabase is no longer imported by the application source. Authentication, profile/balance loading and game history now use the local REST API.
