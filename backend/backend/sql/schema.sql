CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 1000.00 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  bet NUMERIC(14,2) NOT NULL CHECK (bet >= 0),
  payout NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (payout >= 0),
  multiplier NUMERIC(10,4) NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mines_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet NUMERIC(14,2) NOT NULL CHECK (bet > 0),
  mine_count INT NOT NULL CHECK (mine_count BETWEEN 1 AND 24),
  mine_positions INT[] NOT NULL,
  revealed INT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'busted', 'cashed_out')),
  game_name TEXT NOT NULL DEFAULT 'Mines',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mines_rounds_user_active ON mines_rounds(user_id) WHERE status = 'active';

-- Crash is multi-step like Mines: the crash point is generated and stored
-- server-side at round start and is never sent to the client until the
-- round resolves (via cashout or bust), so a player can never learn it
-- early and time a guaranteed cashout.
CREATE TABLE IF NOT EXISTS crash_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet NUMERIC(14,2) NOT NULL CHECK (bet > 0),
  crash_point NUMERIC(10,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'busted', 'cashed_out')),
  game_name TEXT NOT NULL DEFAULT 'Crash',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crash_rounds_user_active ON crash_rounds(user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_game_history_user_created ON game_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created ON wallet_transactions(user_id, created_at DESC);

-- Hi-Lo: Higher/Lower card game
-- State: current revealed card (rank 1-13), running multiplier, status (active/busted/cashed_out)
CREATE TABLE IF NOT EXISTS hilo_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet NUMERIC(14,2) NOT NULL CHECK (bet > 0),
  current_card INT NOT NULL CHECK (current_card BETWEEN 1 AND 13),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'busted', 'cashed_out')),
  game_name TEXT NOT NULL DEFAULT 'Hi-Lo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hilo_rounds_user_active ON hilo_rounds(user_id) WHERE status = 'active';

-- Sic Bo: Three dice game with multiple bet-types per round
-- Player can bet on big/small, specific triple, specific total, etc.
-- Each round has one or more sub-bets that sum to the total bet amount
CREATE TABLE IF NOT EXISTS sic_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet_amount NUMERIC(14,2) NOT NULL CHECK (bet_amount > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled')),
  game_name TEXT NOT NULL DEFAULT 'Sic Bo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sic_rounds_user_active ON sic_rounds(user_id) WHERE status = 'active';

-- Blackjack: Card game table with active rounds
CREATE TABLE IF NOT EXISTS blackjack_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet NUMERIC(14,2) NOT NULL CHECK (bet > 0),
  player_hand JSONB NOT NULL DEFAULT '[]'::jsonb,
  dealer_hand JSONB NOT NULL DEFAULT '[]'::jsonb,
  deck JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'player_won', 'dealer_won', 'push', 'busted')),
  game_name TEXT NOT NULL DEFAULT 'Blackjack',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blackjack_rounds_user_active ON blackjack_rounds(user_id) WHERE status = 'active';
