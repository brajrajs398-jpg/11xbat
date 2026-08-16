-- Seeds the single demo user that backend/auth.ts's temporary stub
-- treats every request as. Run this once after schema.sql, before
-- testing/demoing the games.
--
-- Delete/replace this once real signup/login exists.

INSERT INTO users (id, email, password_hash)
VALUES ('00000000-0000-0000-0000-000000000001', 'demo@playvault.local', 'not-a-real-password-hash')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, balance)
VALUES ('00000000-0000-0000-0000-000000000001', 'demo_player', 10000.00)
ON CONFLICT (id) DO NOTHING;
