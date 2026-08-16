import { useState } from 'react';
import { Rocket } from 'lucide-react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import type { Page } from '@/components/Layout';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = { onBack: () => void; onNavigate?: (p: Page) => void; game?: CatalogGame };

export default function LimboGame({ onBack, game }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [target, setTarget] = useState(2.0);
  const [rolling, setRolling] = useState(false);
  const [roll, setRoll] = useState<number | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const winChance = Math.min(99 / target, 99);

  const handlePlay = async () => {
    if (balance < betAmount || rolling || target < 1.01) return;
    setRolling(true);
    setWon(null);
    setRoll(null);

    try {
      // The roll comes from the server — the client only ever sends the
      // target multiplier it's betting will be cleared, never a result.
      const res = await api.limboBet(betAmount, target, game?.name ?? 'Limbo');
      await new Promise((r) => setTimeout(r, 700)); // keep the reveal animation feel
      setRoll(res.roll);
      setWon(res.won);
      setHistory((h) => [res.roll, ...h].slice(0, 12));
    } catch {
      // insufficient balance or network issue — nothing was deducted
    } finally {
      await refreshBalance();
      setRolling(false);
    }
  };

  return (
    <GameShell
      title={game?.name ?? 'Limbo'}
      description={game ? `Set a target multiplier in ${game.name} and see if the roll clears it.` : 'Set a target multiplier and see if the roll clears it.'}
      onBack={onBack}
      currentPage="limbo"
      controls={
        <BetControls
          onPlay={handlePlay}
          disabled={balance < betAmount || rolling || target < 1.01}
          playLabel="Roll"
          playingLabel="Rolling..."
          isPlaying={rolling}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
        >
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Win Chance</span>
              <span className="text-white font-medium">{winChance.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-3">
              <span>Payout on win</span>
              <span className="text-emerald-400 font-medium">{target.toFixed(2)}×</span>
            </div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Target multiplier</label>
            <input
              type="number"
              min={1.01}
              step={0.01}
              value={target}
              onChange={(e) => setTarget(Math.max(1.01, parseFloat(e.target.value) || 1.01))}
              className="w-full bg-[#0a0e17] border border-gray-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors tabular-nums"
            />
            <div className="flex gap-2 mt-2">
              {[1.5, 2, 5, 10].map((t) => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className="flex-1 py-1.5 text-xs font-medium text-gray-400 bg-[#0a0e17] border border-gray-800 rounded-lg hover:text-white hover:border-gray-700 transition-colors"
                >
                  {t}×
                </button>
              ))}
            </div>
          </div>
        </BetControls>
      }
    >
      <div className="relative h-64 lg:h-80 bg-[#0a0e17] rounded-xl flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap max-w-[70%]">
          {history.map((h, i) => (
            <span
              key={i}
              className={`text-xs font-medium px-2 py-0.5 rounded-md tabular-nums ${
                h >= target ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
              }`}
            >
              {h.toFixed(2)}×
            </span>
          ))}
        </div>

        <Rocket className={`w-10 h-10 mb-3 ${rolling ? 'animate-pulse text-amber-400' : won === false ? 'text-red-500' : 'text-white'}`} />

        {roll !== null ? (
          <div className="text-center">
            <p className={`text-5xl font-bold tabular-nums ${won ? 'text-emerald-400' : 'text-red-500'}`}>
              {roll.toFixed(2)}×
            </p>
            <p className={`text-sm mt-3 font-medium ${won ? 'text-emerald-400' : 'text-red-400'}`}>
              {won ? `You won ${(betAmount * target).toFixed(2)} coins!` : `Needed ${target.toFixed(2)}× — you lost`}
            </p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Set your target and roll!</p>
        )}
      </div>
    </GameShell>
  );
}
