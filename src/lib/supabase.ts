import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  balance: number;
  created_at: string;
};

export type GameHistory = {
  id: string;
  user_id: string;
  game: string;
  bet: number;
  payout: number;
  multiplier: number;
  details: Record<string, unknown>;
  created_at: string;
};
