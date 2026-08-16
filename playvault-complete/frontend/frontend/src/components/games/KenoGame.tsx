import { useState } from 'react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import type { Page } from '@/components/Layout';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = { onBack: () => void; onNavigate?: (p: Page) => void; game?: CatalogGame };

const GRID = Array.from({ length: 40 }, (_, i) => i + 1);
const MAX_PICKS = 10;

export default function KenoGame({ onBack, game }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [picks, setPicks] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[] | null>(null);
  const [hits, setHits] = useState(0);
  const [payout, setPayout] = useState(0);
  const [drawing, setDrawing] = useState(false);

  const togglePick = (n: number) => {
    if (drawing) return;
    setDrawn(null);
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((p) => p !== n);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, n];
    });
  };

  const handlePlay = async () => {
    if (balance < betAmount || drawing || picks.length === 0) return;
    setDrawing(true);
    setDrawn(null);

    try {
      // Server picks the 10 winning numbers — the client only ever sends
      // which numbers it picked, never a result.
      const res = await api.kenoDraw(betAmount, picks, game?.name ?? 'Keno');
      await new Promise((r) => setTimeout(r, 800)); // keep the draw animation feel
      setDrawn(res.drawn);
      setHits(res.hits);
      setPayout(res.payout);
    } catch {
      // insufficient balance, invalid picks, or network issue
    } finally {
      await refreshBalance();
      setDrawing(false);
    }
  };

  return (
    <GameShell
      title={game?.name ?? 'Keno'}
      description={game ? `Pick up to 10 numbers in ${game.name} and see how many the draw matches.` : 'Pick up to 10 numbers from the board and see how many the draw matches.'}
      onBack={onBack}
      currentPage="keno"
      controls={
        <BetControls
          onPlay={handlePlay}
          disabled={balance < betAmount || drawing || picks.length === 0}
          playLabel="Draw"
          playingLabel="Drawing..."
          isPlaying={drawing}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Picked</span>
            <span className="text-white font-medium">{picks.length}/{MAX_PICKS}</span>
          </div>
          <button
            onClick={() => { setPicks([]); setDrawn(null); }}
            disabled={drawing || picks.length === 0}
            className="w-full mt-2 py-2 text-xs font-medium text-gray-400 bg-[#0a0e17] border border-gray-800 rounded-lg hover:text-white hover:border-gray-700 transition-colors disabled:opacity-40"
          >
            Clear picks
          </button>
        </BetControls>
      }
    >
      <div className="h-64 lg:h-80 bg-[#0a0e17] rounded-xl p-4 flex flex-col">
        <div className="grid grid-cols-8 gap-1.5 flex-1">
          {GRID.map((n) => {
            const picked = picks.includes(n);
            const isDrawn = drawn?.includes(n);
            const isHit = picked && isDrawn;
            return (
              <button
                key={n}
                onClick={() => togglePick(n)}
                disabled={drawing}
                className={`rounded-md text-xs font-bold tabular-nums transition-all flex items-center justify-center aspect-square ${
                  isHit
                    ? 'bg-emerald-500 text-black'
                    : isDrawn
                    ? 'bg-amber-500/40 text-white border border-amber-500'
                    : picked
                    ? 'bg-cyan-500 text-black'
                    : 'bg-[#12182b] text-gray-400 hover:bg-[#1a2138]'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
        {drawn && (
          <p className={`text-center text-sm mt-3 font-medium ${hits > 0 && payout > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {hits} hit{hits === 1 ? '' : 's'} — {payout > 0 ? `won ${payout.toFixed(2)} coins!` : 'no win this round'}
          </p>
        )}
      </div>
    </GameShell>
  );
}
