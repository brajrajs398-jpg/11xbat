import { useState } from 'react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import type { Page } from '@/components/Layout';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = { onBack: () => void; onNavigate?: (p: Page) => void; game?: CatalogGame };

export default function DiceGame({ onBack, game }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [won, setWon] = useState<boolean | null>(null);

  const winChance = isOver ? (100 - target) : target;
  const multiplierPayout = (99 / winChance);

  const handlePlay = async () => {
    if (balance < betAmount) return;
    setRolling(true);
    setWon(null);
    setRollResult(null);

    try {
      const res = await api.diceRoll(betAmount, target, isOver, game?.name ?? 'Dice');
      await new Promise((r) => setTimeout(r, 600)); // keep the roll animation feel
      setRollResult(res.result);
      setWon(res.won);
    } catch {
      // insufficient balance or network issue — nothing was deducted
    } finally {
      await refreshBalance();
      setRolling(false);
    }
  };

  const sliderColor = isOver ? 'from-cyan-500 to-blue-500' : 'from-emerald-500 to-teal-500';

  return (
    <GameShell
      title={game?.name ?? 'Dice'}
      description={game ? `Predict over or under your target in ${game.name}.` : 'Roll the dice and predict if the result will be over or under your target.'}
      onBack={onBack}
      currentPage="dice"
      controls={
        <BetControls
          onPlay={handlePlay}
          disabled={balance < betAmount || rolling}
          playLabel="Roll Dice"
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
              <span>Payout</span>
              <span className="text-emerald-400 font-medium">{multiplierPayout.toFixed(2)}×</span>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setIsOver(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  !isOver ? 'bg-emerald-500 text-white' : 'bg-[#0a0e17] text-gray-400 border border-gray-800'
                }`}
              >
                Under
              </button>
              <button
                onClick={() => setIsOver(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  isOver ? 'bg-cyan-500 text-white' : 'bg-[#0a0e17] text-gray-400 border border-gray-800'
                }`}
              >
                Over
              </button>
            </div>

            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Target: {target.toFixed(2)}
            </label>
            <input
              type="range"
              min={2}
              max={98}
              step={0.01}
              value={target}
              onChange={(e) => setTarget(parseFloat(e.target.value))}
              className={`w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r ${sliderColor}`}
            />
          </div>
        </BetControls>
      }
    >
      <div className="relative h-64 lg:h-80 bg-[#0a0e17] rounded-xl flex flex-col items-center justify-center">
        {rollResult !== null ? (
          <div className="text-center">
            <p className={`text-6xl font-bold tabular-nums ${won ? 'text-emerald-400' : 'text-red-500'}`}>
              {rollResult.toFixed(2)}
            </p>
            <p className={`text-sm mt-3 font-medium ${won ? 'text-emerald-400' : 'text-red-400'}`}>
              {won ? 'You won!' : 'You lost'}
            </p>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <p className="text-lg">Set your target and roll!</p>
          </div>
        )}

        {/* Slider visualization */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`absolute h-full ${isOver ? 'bg-cyan-500/30' : 'bg-emerald-500/30'}`}
              style={isOver ? { left: `${target}%`, right: 0 } : { left: 0, right: `${100 - target}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-full"
              style={{ left: `${target}%` }}
            />
            {rollResult !== null && (
              <div
                className={`absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full ${won ? 'bg-emerald-400' : 'bg-red-500'}`}
                style={{ left: `${rollResult}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </GameShell>
  );
}
