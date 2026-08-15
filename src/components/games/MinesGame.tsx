import { useState } from 'react';
import { Bomb, Gem } from 'lucide-react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import type { Page } from '@/components/Layout';

type Props = { onBack: () => void; onNavigate: (p: Page) => void };

const GRID_SIZE = 25;

function calculateMultiplier(minesCount: number, gemsRevealed: number): number {
  if (gemsRevealed === 0) return 1;
  let m = 1;
  const safeTiles = GRID_SIZE - minesCount;
  for (let i = 0; i < gemsRevealed; i++) {
    m *= (GRID_SIZE - i) / (safeTiles - i);
  }
  return m * 0.99;
}

export default function MinesGame({ onBack }: Props) {
  const { balance, placeBet, addWinnings, recordHistory } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [grid, setGrid] = useState<('hidden' | 'gem' | 'bomb')[]>(Array(GRID_SIZE).fill('hidden'));
  const [bombPositions, setBombPositions] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [exploded, setExploded] = useState(false);

  const currentMultiplier = calculateMultiplier(mineCount, revealed.size);
  const potentialWin = betAmount * currentMultiplier;

  const startGame = async () => {
    const ok = await placeBet(betAmount);
    if (!ok) return;
    const positions = new Set<number>();
    while (positions.size < mineCount) {
      positions.add(Math.floor(Math.random() * GRID_SIZE));
    }
    setBombPositions(positions);
    setGrid(Array(GRID_SIZE).fill('hidden'));
    setRevealed(new Set());
    setGameOver(false);
    setExploded(false);
    setPlaying(true);
  };

  const revealTile = async (index: number) => {
    if (!playing || revealed.has(index) || gameOver) return;

    if (bombPositions.has(index)) {
      const newGrid = [...grid];
      bombPositions.forEach((pos) => { newGrid[pos] = 'bomb'; });
      newGrid[index] = 'bomb';
      setGrid(newGrid);
      setExploded(true);
      setGameOver(true);
      setPlaying(false);
      await recordHistory('mines', betAmount, 0, 0, { mines: mineCount, revealed: revealed.size, exploded: true });
      setTimeout(() => {
        setGrid(Array(GRID_SIZE).fill('hidden'));
        setRevealed(new Set());
        setBombPositions(new Set());
      }, 2500);
    } else {
      const newRevealed = new Set(revealed);
      newRevealed.add(index);
      setRevealed(newRevealed);
      const newGrid = [...grid];
      newGrid[index] = 'gem';
      setGrid(newGrid);
    }
  };

  const cashOut = async () => {
    if (!playing || revealed.size === 0) return;
    const payout = potentialWin;
    await addWinnings(payout);
    await recordHistory('mines', betAmount, payout, currentMultiplier, { mines: mineCount, revealed: revealed.size, cashedOut: true });

    const newGrid = [...grid];
    bombPositions.forEach((pos) => { newGrid[pos] = 'bomb'; });
    setGrid(newGrid);
    setGameOver(true);
    setPlaying(false);
    setTimeout(() => {
      setGrid(Array(GRID_SIZE).fill('hidden'));
      setRevealed(new Set());
      setBombPositions(new Set());
    }, 2500);
  };

  return (
    <GameShell
      title="Mines"
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
              disabled={revealed.size === 0}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3 rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-40"
            >
              Cash Out {potentialWin.toFixed(2)}
            </button>
          </div>
        ) : (
          <BetControls
            onPlay={startGame}
            disabled={balance < betAmount}
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
            disabled={!playing || revealed.has(i) || gameOver}
            className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
              tile === 'hidden'
                ? 'bg-[#0a0e17] border border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'
                : tile === 'gem'
                ? 'bg-emerald-500/20 border border-emerald-500/40'
                : 'bg-red-500/20 border border-red-500/40'
            } ${!playing && tile === 'hidden' ? 'opacity-50' : ''}`}
          >
            {tile === 'gem' && <Gem className="w-6 h-6 text-emerald-400" />}
            {tile === 'bomb' && <Bomb className={`w-6 h-6 ${exploded && bombPositions.has(i) && i === [...revealed].pop() ? 'text-red-500 animate-pulse' : 'text-red-400'}`} />}
          </button>
        ))}
      </div>
      {gameOver && (
        <p className={`text-center mt-4 text-sm font-medium ${exploded ? 'text-red-400' : 'text-emerald-400'}`}>
          {exploded ? 'You hit a bomb! Game over.' : `Cashed out at ${currentMultiplier.toFixed(2)}× — won ${potentialWin.toFixed(2)} coins!`}
        </p>
      )}
    </GameShell>
  );
}
