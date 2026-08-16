import { useState, useRef } from 'react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import type { Page } from '@/components/Layout';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = { onBack: () => void; onNavigate?: (p: Page) => void; game?: CatalogGame };

const ROWS = 12;
const MULTIPLIERS = [16, 9, 4, 2, 1.4, 1.1, 1, 0.8, 1, 1.1, 1.4, 2, 4, 9, 16];
const COLS = 9;

type Ball = { id: number; x: number; y: number; vx: number; vy: number; row: number; finished: boolean; slot: number };

export default function PlinkoGame({ onBack, game }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [lastResult, setLastResult] = useState<{ slot: number; multiplier: number } | null>(null);
  const [dropping, setDropping] = useState(false);
  const ballIdRef = useRef(0);

  const dropBall = async () => {
    if (balance < betAmount) return;

    let serverResult: { slot: number; multiplier: number; payout: number } | null = null;
    try {
      serverResult = await api.plinkoDrop(betAmount, game?.name ?? 'Plinko');
    } catch {
      return; // insufficient balance or network issue — nothing was deducted
    }

    setDropping(true);
    const id = ballIdRef.current++;
    const newBall: Ball = { id, x: 50, y: 0, vx: 0, vy: 0, row: 0, finished: false, slot: -1 };
    setBalls((b) => [...b, newBall]);

    let currentX = 50;
    let currentRow = 0;
    const targetSlot = serverResult.slot;

    // Animate a visual path that lands on the server-determined slot —
    // the outcome itself was already decided by the server above.
    const step = async () => {
      currentRow++;
      if (currentRow < ROWS) {
        currentX += (Math.random() - 0.5) * (100 / COLS);
        currentX = Math.max(8, Math.min(92, currentX));
      } else {
        currentX = 8 + (targetSlot / (MULTIPLIERS.length - 1)) * 84;
      }

      setBalls((b) => b.map((ball) =>
        ball.id === id ? { ...ball, x: currentX, y: (currentRow / ROWS) * 100, row: currentRow } : ball
      ));

      if (currentRow < ROWS) {
        setTimeout(step, 120);
      } else {
        setBalls((b) => b.map((ball) => ball.id === id ? { ...ball, finished: true, slot: targetSlot } : ball));
        setLastResult({ slot: targetSlot, multiplier: serverResult!.multiplier });
        await refreshBalance();

        setTimeout(() => {
          setBalls((b) => b.filter((ball) => ball.id !== id));
        }, 1000);
        setDropping(false);
      }
    };

    setTimeout(step, 120);
  };

  return (
    <GameShell
      title={game?.name ?? "Plinko"}
      description="Drop the ball and watch it bounce through pegs to land in a multiplier slot!"
      onBack={onBack}
      currentPage="plinko"
      controls={
        <BetControls
          onPlay={dropBall}
          disabled={balance < betAmount || dropping}
          playLabel="Drop Ball"
          playingLabel="Dropping..."
          isPlaying={dropping}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
        >
          {lastResult && (
            <div className="text-center py-2 px-3 bg-[#0a0e17] rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400">Last result</p>
              <p className={`text-lg font-bold ${lastResult.multiplier >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                {lastResult.multiplier}× — {(betAmount * lastResult.multiplier).toFixed(2)} coins
              </p>
            </div>
          )}
        </BetControls>
      }
    >
      <div className="relative h-80 lg:h-96 bg-[#0a0e17] rounded-xl overflow-hidden">
        {/* Pegs */}
        {Array.from({ length: ROWS + 1 }).map((_, row) => {
          const pegCount = Math.min(row + 2, COLS + 1);
          return Array.from({ length: pegCount }).map((_, col) => {
            const totalWidth = pegCount;
            const x = ((col + 1) / (totalWidth + 1)) * 100;
            const y = ((row + 1) / (ROWS + 2)) * 100;
            return (
              <div
                key={`${row}-${col}`}
                className="absolute w-1.5 h-1.5 bg-gray-600 rounded-full"
                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
              />
            );
          });
        })}

        {/* Balls */}
        {balls.map((ball) => (
          <div
            key={ball.id}
            className="absolute w-3 h-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg shadow-amber-500/30 transition-all duration-100"
            style={{ left: `${ball.x}%`, top: `${ball.y}%`, transform: 'translate(-50%, -50%)' }}
          />
        ))}

        {/* Multiplier slots at bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex gap-0.5 px-1 pb-1">
          {MULTIPLIERS.map((m, i) => (
            <div
              key={i}
              className={`flex-1 text-center py-1.5 rounded-md text-xs font-bold ${
                m >= 10 ? 'bg-red-500/20 text-red-400' :
                m >= 2 ? 'bg-amber-500/20 text-amber-400' :
                m >= 1 ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-gray-700/40 text-gray-400'
              } ${lastResult?.slot === i ? 'ring-2 ring-white' : ''}`}
            >
              {m}×
            </div>
          ))}
        </div>
      </div>
    </GameShell>
  );
}
