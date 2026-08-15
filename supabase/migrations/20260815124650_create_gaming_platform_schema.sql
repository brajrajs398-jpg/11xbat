/*
# Gaming Platform Schema

1. New Tables
- `profiles`
  - `id` (uuid, PK, references auth.users)
  - `username` (text, unique, not null)
  - `balance` (numeric, default 1000.00) — virtual coins
  - `created_at` (timestamptz)
- `game_history`
  - `id` (uuid, PK)
  - `user_id` (uuid, references auth.users, default auth.uid())
  - `game` (text) — game name (crash, dice, plinko, mines, wheel, coinflip)
  - `bet` (numeric) — amount wagered
  - `payout` (numeric) — amount returned (0 = loss)
  - `multiplier` (numeric) — result multiplier
  - `details` (jsonb) — game-specific result data
  - `created_at` (timestamptz)

2. Security
- RLS enabled on both tables.
- profiles: users can read/update own profile only.
- game_history: users can read/insert own records only.
- Balance updates are restricted to the owner via UPDATE policy.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT 1000.00,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS game_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  game text NOT NULL,
  bet numeric(14,2) NOT NULL,
  payout numeric(14,2) NOT NULL DEFAULT 0,
  multiplier numeric(10,4) NOT NULL DEFAULT 0,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_history" ON game_history;
CREATE POLICY "select_own_history" ON game_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_history" ON game_history;
CREATE POLICY "insert_own_history" ON game_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id);
CREATE INDEX IF NOT EXISTS idx_game_history_created_at ON game_history(created_at DESC);
