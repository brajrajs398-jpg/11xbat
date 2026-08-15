import { useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

export function useBalance() {
  const { profile, refreshProfile } = useAuth();

  const placeBet = useCallback(async (amount: number): Promise<boolean> => {
    if (!profile || profile.balance < amount) return false;
    const newBalance = profile.balance - amount;
    const { error } = await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', profile.id);
    if (error) return false;
    await refreshProfile();
    return true;
  }, [profile, refreshProfile]);

  const addWinnings = useCallback(async (amount: number): Promise<void> => {
    if (!profile) return;
    const newBalance = profile.balance + amount;
    await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', profile.id);
    await refreshProfile();
  }, [profile, refreshProfile]);

  const recordHistory = useCallback(async (
    game: string,
    bet: number,
    payout: number,
    multiplier: number,
    details: Record<string, unknown>,
  ) => {
    await supabase.from('game_history').insert({
      game,
      bet,
      payout,
      multiplier,
      details,
    });
  }, []);

  const updateBalance = useCallback(async (deltaAmount: number): Promise<void> => {
    if (!profile) return;
    const newBalance = Math.max(0, profile.balance + deltaAmount);
    await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', profile.id);
    await refreshProfile();
  }, [profile, refreshProfile]);

  const addHistory = useCallback(async (entry: {
    game: string;
    bet: number;
    profit: number;
    result: string;
    multiplier: number;
  }) => {
    await supabase.from('game_history').insert({
      game: entry.game,
      bet: entry.bet,
      payout: entry.profit > 0 ? entry.bet + entry.profit : 0,
      multiplier: entry.multiplier,
      details: { result: entry.result, profit: entry.profit },
    });
  }, []);

  return {
    balance: profile?.balance ?? 0,
    placeBet,
    addWinnings,
    recordHistory,
    updateBalance,
    addHistory,
  };
}
