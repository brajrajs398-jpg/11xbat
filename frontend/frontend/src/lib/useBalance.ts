import { useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { api } from '@/lib/api';

export function useBalance() {
  const { profile, refreshProfile } = useAuth();

  const placeBet = useCallback(async (amount: number): Promise<boolean> => {
    if (!profile || !Number.isFinite(amount) || amount <= 0) return false;
    try {
      await api.changeBalance(-amount, 'bet');
      await refreshProfile();
      return true;
    } catch {
      return false;
    }
  }, [profile, refreshProfile]);

  const addWinnings = useCallback(async (amount: number): Promise<void> => {
    if (!profile || !Number.isFinite(amount) || amount <= 0) return;
    try {
      await api.changeBalance(amount, 'payout');
      await refreshProfile();
    } catch {
      // Keep UI stable; the next refresh will reconcile the server balance.
    }
  }, [profile, refreshProfile]);

  const recordHistory = useCallback(async (
    game: string,
    bet: number,
    payout: number,
    multiplier: number,
    details: Record<string, unknown>,
  ) => {
    await api.addHistory({ game, bet, payout, multiplier, details });
  }, []);

  const updateBalance = useCallback(async (deltaAmount: number): Promise<void> => {
    if (!profile || !Number.isFinite(deltaAmount) || deltaAmount === 0) return;
    try {
      await api.changeBalance(deltaAmount, deltaAmount < 0 ? 'bet' : 'payout');
      await refreshProfile();
    } catch {
      await refreshProfile();
    }
  }, [profile, refreshProfile]);

  const addHistory = useCallback(async (entry: {
    game: string;
    bet: number;
    profit: number;
    result: string;
    multiplier: number;
  }) => {
    await api.addHistory({
      game: entry.game,
      bet: entry.bet,
      payout: entry.profit > 0 ? entry.bet + entry.profit : 0,
      multiplier: entry.multiplier,
      details: { result: entry.result, profit: entry.profit },
    });
  }, []);

  return { balance: profile?.balance ?? 0, placeBet, addWinnings, recordHistory, updateBalance, addHistory, refreshBalance: refreshProfile };
}
