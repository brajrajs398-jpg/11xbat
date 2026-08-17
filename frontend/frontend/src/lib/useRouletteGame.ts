import { useState } from 'react';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';

// Real game rules — identical for every skin. Skins only change presentation.
export const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export type RouletteBetType = 'red' | 'black' | 'even' | 'odd' | 'number';

export interface RouletteResult {
  win: boolean;
  amount: number;
  num: number;
}

/**
 * All Roulette game state + the bet/spin flow. The server decides the real
 * outcome and payout (POST /api/games/roulette/bet) before any animation
 * plays — this hook never computes an outcome locally. Kept skin-agnostic
 * on purpose so every visual skin shares this exact same logic.
 */
export function useRouletteGame() {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [betType, setBetType] = useState<RouletteBetType>('red');
  const [selectedNumber, setSelectedNumber] = useState<number>(7);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<RouletteResult | null>(null);
  const [recentHistory, setRecentHistory] = useState<number[]>([14, 22, 0, 31, 9, 7]);

  const handleSpin = async () => {
    if (isSpinning || betAmount > balance) return;

    setIsSpinning(true);
    setWinningNumber(null);
    setLastResult(null);

    const serverBetType = betType === 'number' ? 'straight' : betType;
    let data;
    try {
      data = await api.roulettePlaceBets(betAmount, [
        { type: serverBetType, value: betType === 'number' ? selectedNumber : undefined, amount: betAmount },
      ]);
    } catch {
      setIsSpinning(false);
      setLastResult(null);
      return;
    }

    const resultNum = data.winningNumber;
    const randomIndex = ROULETTE_NUMBERS.indexOf(resultNum);
    const degPerSegment = 360 / ROULETTE_NUMBERS.length;
    const targetDeg = wheelRotation + 1800 + (360 - randomIndex * degPerSegment);
    setWheelRotation(targetDeg);

    setTimeout(async () => {
      setIsSpinning(false);
      setWinningNumber(resultNum);
      setRecentHistory((prev) => [resultNum, ...prev.slice(0, 7)]);

      const won = data.results[0]?.won ?? false;
      const winAmount = data.totalPayout;

      setLastResult({ win: won, amount: winAmount, num: resultNum });
      await refreshBalance();
    }, 3500);
  };

  return {
    balance,
    betAmount,
    setBetAmount,
    betType,
    setBetType,
    selectedNumber,
    setSelectedNumber,
    isSpinning,
    wheelRotation,
    winningNumber,
    lastResult,
    recentHistory,
    handleSpin,
  };
}
