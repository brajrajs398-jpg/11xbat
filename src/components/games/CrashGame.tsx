import { useState, useRef, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import type { Page } from '@/components/Layout';

type Props = { onBack: () => void; onNavigate: (p: Page) => void };

export default function CrashGame({ onBack }: Props) {
  const { balance, placeBet, addWinnings, recordHistory } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [crashPoint, setCrashPoint] = useState(0);
  const [crashed, setCrashed] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const generateCrashPoint = () => {
    const r = Math.random();
    if (r < 0.03) return 1.0;
    const houseEdge = 0.99;
    const point = houseEdge / (1 - r);
    return Math.max(1.0, Math.min(point, 100));
  };

  const cashOut = useCallback(async () => {
    if (!hasBet || cashedOut || crashed) return;
    setCashedOut(true);
    const winnings = betAmount * multiplier;
    await addWinnings(winnings);
    await recordHistory('crash', betAmount, winnings, multiplier, { crashPoint: multiplier, cashedOut: true });
  }, [hasBet, cashedOut, crashed, betAmount, multiplier, addWinnings, recordHistory]);

  const animate = useCallback((ts: number) => {
    if (!startTimeRef.current) startTimeRef.current = ts;
    const elapsed = (ts - startTimeRef.current) / 1000;
    const m = Math.pow(Math.E, 0.06 * elapsed);

    if (m >= crashPoint) {
      setMultiplier(crashPoint);
      setCrashed(true);
      setIsRunning(false);
      setHasBet(false);
      setHistory((h) => [crashPoint, ...h].slice(0, 12));
      if (hasBet && !cashedOut) {
        recordHistory('crash', betAmount, 0, crashPoint, { crashPoint, cashedOut: false });
      }
      setTimeout(() => {
        setCrashed(false);
        setMultiplier(1.0);
        setCashedOut(false);
      }, 2500);
      return;
    }

    setMultiplier(m);
    rafRef.current = requestAnimationFrame(animate);
  }, [crashPoint, hasBet, cashedOut, betAmount, recordHistory]);

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, animate]);

  const handlePlay = async () => {
    const ok = await placeBet(betAmount);
    if (!ok) return;
    setHasBet(true);
    setCashedOut(false);
    setCrashed(false);
    setMultiplier(1.0);
    setCrashPoint(generateCrashPoint());
    setIsRunning(true);
  };

  const displayColor = crashed ? 'text-red-500' : cashedOut ? 'text-emerald-400' : 'text-white';

  return (
    <GameShell
      title="Crash"
      description="Watch the multiplier rise and cash out before it crashes!"
      onBack={onBack}
      currentPage="crash"
      controls={
        isRunning && hasBet && !cashedOut && !crashed ? (
          <div className="space-y-4">
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-1">Current multiplier</p>
              <p className="text-3xl font-bold text-emerald-400 tabular-nums">{multiplier.toFixed(2)}×</p>
              <p className="text-xs text-gray-500 mt-2">Potential win: {(betAmount * multiplier).toFixed(2)} coins</p>
            </div>
            <button
              onClick={cashOut}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all animate-pulse"
            >
              Cash Out {(betAmount * multiplier).toFixed(2)}
            </button>
          </div>
        ) : (
          <BetControls
            onPlay={handlePlay}
            disabled={balance < betAmount}
            playLabel="Place Bet & Start"
            betAmount={betAmount}
            setBetAmount={setBetAmount}
          />
        )
      }
    >
      <div className="relative h-64 lg:h-80 bg-[#0a0e17] rounded-xl overflow-hidden flex items-center justify-center">
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap max-w-[70%]">
          {history.map((h, i) => (
            <span
              key={i}
              className={`text-xs font-medium px-2 py-0.5 rounded-md tabular-nums ${
                h < 2 ? 'text-red-400 bg-red-500/10' : h < 10 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
              }`}
            >
              {h.toFixed(2)}×
            </span>
          ))}
        </div>

        {crashed ? (
          <div className="text-center">
            <p className="text-5xl font-bold text-red-500 tabular-nums">CRASHED</p>
            <p className="text-2xl text-red-400 mt-2 tabular-nums">@ {crashPoint.toFixed(2)}×</p>
          </div>
        ) : (
          <div className="text-center">
            <TrendingUp className={`w-12 h-12 mx-auto mb-2 ${displayColor} ${isRunning ? 'animate-pulse' : ''}`} />
            <p className={`text-5xl lg:text-6xl font-bold tabular-nums ${displayColor}`}>
              {multiplier.toFixed(2)}×
            </p>
            {cashedOut && (
              <p className="text-emerald-400 text-sm mt-3 font-medium">
                Cashed out at {multiplier.toFixed(2)}× — won {(betAmount * multiplier).toFixed(2)} coins!
              </p>
            )}
          </div>
        )}
      </div>
    </GameShell>
  );
}
