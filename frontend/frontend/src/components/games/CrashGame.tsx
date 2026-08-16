import { useState, useRef, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import type { Page } from '@/components/Layout';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = { onBack: () => void; onNavigate?: (p: Page) => void; game?: CatalogGame };

const GROWTH_RATE = 0.06;
const MAX_MULTIPLIER = 100;

export default function CrashGame({ onBack, game }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [lastCrashPoint, setLastCrashPoint] = useState(0);
  const [lastWinnings, setLastWinnings] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [starting, setStarting] = useState(false);

  const rafRef = useRef<number>(0);
  const pollRef = useRef<number>(0);
  const roundIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const settledRef = useRef(false);

  // The crash point is never known by the client — it lives only on the
  // server (crash_rounds.crash_point) until the round resolves. The client
  // just renders the same growth curve the server uses and polls to find
  // out if/when it has actually crashed.
  const liveMultiplier = useCallback(() => {
    const elapsed = (Date.now() - startedAtRef.current) / 1000;
    return Math.min(Math.pow(Math.E, GROWTH_RATE * elapsed), MAX_MULTIPLIER);
  }, []);

  const stopLoops = () => {
    cancelAnimationFrame(rafRef.current);
    window.clearInterval(pollRef.current);
  };

  const finishRound = useCallback((opts: { busted: boolean; multiplier?: number; crashPoint?: number; payout?: number }) => {
    if (settledRef.current) return;
    settledRef.current = true;
    stopLoops();
    setIsRunning(false);
    setHasBet(false);
    if (opts.busted) {
      const point = opts.crashPoint ?? multiplier;
      setMultiplier(point);
      setLastCrashPoint(point);
      setCrashed(true);
      setHistory((h) => [point, ...h].slice(0, 12));
    } else {
      const point = opts.multiplier ?? multiplier;
      setMultiplier(point);
      setCashedOut(true);
      setLastWinnings(opts.payout ?? betAmount * point);
      setHistory((h) => [point, ...h].slice(0, 12));
    }
    refreshBalance();
    setTimeout(() => {
      setCrashed(false);
      setCashedOut(false);
      setMultiplier(1.0);
    }, 2500);
  }, [betAmount, multiplier, refreshBalance]);

  const animate = useCallback(() => {
    const m = liveMultiplier();
    setMultiplier(m);
    rafRef.current = requestAnimationFrame(animate);
  }, [liveMultiplier]);

  const poll = useCallback(async () => {
    const roundId = roundIdRef.current;
    if (!roundId || settledRef.current) return;
    try {
      const status = await api.crashStatus(roundId);
      if (status.settled && status.busted) {
        finishRound({ busted: true, crashPoint: status.crashPoint });
      }
    } catch {
      // transient network error — next poll tick will retry
    }
  }, [finishRound]);

  useEffect(() => stopLoops, []);

  const cashOut = useCallback(async () => {
    const roundId = roundIdRef.current;
    if (!roundId || !hasBet || cashedOut || crashed || settledRef.current) return;
    try {
      const result = await api.crashCashout(roundId);
      if (result.busted) {
        finishRound({ busted: true, crashPoint: result.crashPoint });
      } else {
        finishRound({ busted: false, multiplier: result.multiplier, payout: result.payout });
      }
    } catch {
      // network issue — status poll will still resolve the round
    }
  }, [hasBet, cashedOut, crashed, finishRound]);

  const handlePlay = async () => {
    if (balance < betAmount || starting) return;
    setStarting(true);
    try {
      const res = await api.crashStart(betAmount, game?.name ?? 'Crash');
      roundIdRef.current = res.roundId;
      startedAtRef.current = new Date(res.startedAt).getTime();
      settledRef.current = false;
      setHasBet(true);
      setCashedOut(false);
      setCrashed(false);
      setMultiplier(1.0);
      setIsRunning(true);
      await refreshBalance();
      rafRef.current = requestAnimationFrame(animate);
      pollRef.current = window.setInterval(poll, 400);
    } catch {
      // insufficient balance or a round is already in progress
    } finally {
      setStarting(false);
    }
  };

  const displayColor = crashed ? 'text-red-500' : cashedOut ? 'text-emerald-400' : 'text-white';

  return (
    <GameShell
      title={game?.name ?? 'Crash'}
      description={game ? `Watch the multiplier rise in ${game.name} and cash out before it crashes!` : 'Watch the multiplier rise and cash out before it crashes!'}
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
            disabled={balance < betAmount || starting}
            playLabel="Place Bet & Start"
            playingLabel="Starting..."
            isPlaying={starting}
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
            <p className="text-2xl text-red-400 mt-2 tabular-nums">@ {lastCrashPoint.toFixed(2)}×</p>
          </div>
        ) : (
          <div className="text-center">
            <TrendingUp className={`w-12 h-12 mx-auto mb-2 ${displayColor} ${isRunning ? 'animate-pulse' : ''}`} />
            <p className={`text-5xl lg:text-6xl font-bold tabular-nums ${displayColor}`}>
              {multiplier.toFixed(2)}×
            </p>
            {cashedOut && (
              <p className="text-emerald-400 text-sm mt-3 font-medium">
                Cashed out at {multiplier.toFixed(2)}× — won {lastWinnings.toFixed(2)} coins!
              </p>
            )}
          </div>
        )}
      </div>
    </GameShell>
  );
}
