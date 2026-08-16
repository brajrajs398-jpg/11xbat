import { useState } from 'react';
import { Bomb, Gem } from 'lucide-react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import type { Page } from '@/components/Layout';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = { onBack: () => void; onNavigate?: (p: Page) => void; game?: CatalogGame };

const GRID_SIZE = 25;

export default function MinesGame({ onBack, game }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [grid, setGrid] = useState<('hidden' | 'gem' | 'bomb')[]>(Array(GRID_SIZE).fill('hidden'));
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [lastPayout, setLastPayout] = useState(0);
  const [busy, setBusy] = useState(false);

  const potentialWin = betAmount * currentMultiplier;

  const startGame = async () => {
    if (balance < betAmount || busy) return;
    setBusy(true);
    try {
      // Mine positions are generated and kept server-side — the client only
      // ever learns about a tile once it actually reveals it.
      const res = await api.minesStart(betAmount, mineCount, game?.name ?? 'Mines');
      setRoundId(res.roundId);
      setGrid(Array(GRID_SIZE).fill('hidden'));
      setRevealedCount(0);
      setCurrentMultiplier(1);
      setGameOver(false);
      setExploded(false);
      setPlaying(true);
      await refreshBalance();
    } catch {
      // insufficient balance or network issue — nothing was deducted
    } finally {
      setBusy(false);
    }
  };

  const revealTile = async (index: number) => {
    if (!playing || !roundId || grid[index] !== 'hidden' || gameOver || busy) return;
    setBusy(true);
    try {
      const res = await api.minesReveal(roundId, index);
      if (res.busted) {
        const newGrid = [...grid];
        (res.minePositions ?? []).forEach((pos) => { newGrid[pos] = 'bomb'; });
        newGrid[index] = 'bomb';
        setGrid(newGrid);
        setExploded(true);
        setGameOver(true);
        setPlaying(false);
        setTimeout(() => {
          setGrid(Array(GRID_SIZE).fill('hidden'));
          setRoundId(null);
        }, 2500);
      } else {
        const newGrid = [...grid];
        newGrid[index] = 'gem';
        setGrid(newGrid);
        setRevealedCount((res.revealed ?? []).length);
        setCurrentMultiplier(res.multiplier ?? 1);
      }
    } catch {
      // round expired or already resolved — ignore
    } finally {
      setBusy(false);
    }
  };

  const cashOut = async () => {
    if (!playing || !roundId || revealedCount === 0 || busy) return;
    setBusy(true);
    try {
      const res = await api.minesCashout(roundId);
      setLastPayout(res.payout);
      setGameOver(true);
      setPlaying(false);
      await refreshBalance();
      setTimeout(() => {
        setGrid(Array(GRID_SIZE).fill('hidden'));
        setRoundId(null);
      }, 2500);
    } catch {
      // round expired or already resolved — ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <GameShell
      title={game?.name ?? "Mines"}
      description="Reveal gems and avoid bombs. Cash out anytime to lock in your winnings!"
      onBack={onBack}
      currentPage="mines"
      controls={
        playing ? (
          <div className="space-y-4">
            <div className="text-center py-4 bg-[#0a0e17] rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400">Current multiplier</p>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">{currentMultiplier.toFixed(2)}×</p>
              <p className="text-xs text-gray-500 mt-1">Win: {potentialWin.toFixed(2)} coins</p>
            </div>
            <button
              onClick={cashOut}
              disabled={revealedCount === 0 || busy}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3 rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-40"
            >
              Cash Out {potentialWin.toFixed(2)}
            </button>
          </div>
        ) : (
          <BetControls
            onPlay={startGame}
            disabled={balance < betAmount || busy}
            playLabel="Start Game"
            betAmount={betAmount}
            setBetAmount={setBetAmount}
          >
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Mines: {mineCount}</label>
              <input
                type="range"
                min={1}
                max={24}
                value={mineCount}
                onChange={(e) => setMineCount(parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-emerald-500 to-red-500"
              />
            </div>
          </BetControls>
        )
      }
    >
      <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
        {grid.map((tile, i) => (
          <button
            key={i}
            onClick={() => revealTile(i)}
            disabled={!playing || tile !== 'hidden' || gameOver || busy}
            className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
              tile === 'hidden'
                ? 'bg-[#0a0e17] border border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'
                : tile === 'gem'
                ? 'bg-emerald-500/20 border border-emerald-500/40'
                : 'bg-red-500/20 border border-red-500/40'
            } ${!playing && tile === 'hidden' ? 'opacity-50' : ''}`}
          >
            {tile === 'gem' && <Gem className="w-6 h-6 text-emerald-400" />}
            {tile === 'bomb' && <Bomb className={`w-6 h-6 ${exploded ? 'text-red-500 animate-pulse' : 'text-red-400'}`} />}
          </button>
        ))}
      </div>
      {gameOver && (
        <p className={`text-center mt-4 text-sm font-medium ${exploded ? 'text-red-400' : 'text-emerald-400'}`}>
          {exploded ? 'You hit a bomb! Game over.' : `Cashed out at ${currentMultiplier.toFixed(2)}× — won ${lastPayout.toFixed(2)} coins!`}
        </p>
      )}
    </GameShell>
  );
}
