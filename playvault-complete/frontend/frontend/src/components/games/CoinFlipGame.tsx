import { useState } from 'react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import type { Page } from '@/components/Layout';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = { onBack: () => void; onNavigate?: (p: Page) => void; game?: CatalogGame };

export default function CoinFlipGame({ onBack, game }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [rotation, setRotation] = useState(0);

  const flip = async () => {
    if (balance < betAmount || flipping) return;
    setFlipping(true);
    setWon(null);
    setResult(null);

    try {
      // Outcome + payout come from the server (games.ts) — the client only
      // ever sends the bet and the player's pick, never a result.
      const res = await api.coinFlipFlip(betAmount, choice, game?.name ?? 'Coin Flip');
      const spins = 5 + Math.floor(Math.random() * 3);
      const finalRotation = rotation + spins * 360 + (res.outcome === 'tails' ? 180 : 0);
      setRotation(finalRotation);

      await new Promise((r) => setTimeout(r, 2000)); // keep the flip animation feel
      setResult(res.outcome);
      setWon(res.won);
    } catch {
      // insufficient balance or network issue — nothing was deducted
    } finally {
      await refreshBalance();
      setFlipping(false);
    }
  };

  return (
    <GameShell
      title={game?.name ?? 'Coin Flip'}
      description={game ? `Pick heads or tails in ${game.name} for a 1.96× payout!` : 'Pick heads or tails and flip the coin for a 1.96× payout!'}
      onBack={onBack}
      currentPage="coinflip"
      controls={
        <BetControls
          onPlay={flip}
          disabled={balance < betAmount || flipping}
          playLabel="Flip Coin"
          playingLabel="Flipping..."
          isPlaying={flipping}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
        >
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Your pick</label>
            <div className="flex gap-2">
              <button
                onClick={() => setChoice('heads')}
                disabled={flipping}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                  choice === 'heads' ? 'bg-yellow-500 text-black' : 'bg-[#0a0e17] text-gray-400 border border-gray-800'
                }`}
              >
                Heads
              </button>
              <button
                onClick={() => setChoice('tails')}
                disabled={flipping}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                  choice === 'tails' ? 'bg-yellow-500 text-black' : 'bg-[#0a0e17] text-gray-400 border border-gray-800'
                }`}
              >
                Tails
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Win: {(betAmount * 1.96).toFixed(2)} coins</p>
          </div>
        </BetControls>
      }
    >
      <div className="flex flex-col items-center justify-center h-64 lg:h-80">
        <div
          className="relative w-40 h-40 mb-6"
          style={{
            perspective: '800px',
          }}
        >
          <div
            className="relative w-full h-full transition-transform"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateY(${rotation}deg)`,
              transitionDuration: flipping ? '2s' : '0s',
              transitionTimingFunction: 'cubic-bezier(0.17, 0.67, 0.12, 0.99)',
            }}
          >
            {/* Heads face */}
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/30"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <span className="text-5xl font-bold text-amber-900">H</span>
            </div>
            {/* Tails face */}
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500 to-yellow-700 flex items-center justify-center shadow-2xl shadow-amber-500/30"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <span className="text-5xl font-bold text-amber-900">T</span>
            </div>
          </div>
        </div>

        {result && !flipping && (
          <div className="text-center">
            <p className="text-2xl font-bold capitalize text-white">{result}</p>
            <p className={`text-sm mt-1 font-medium ${won ? 'text-emerald-400' : 'text-red-400'}`}>
              {won ? `You won ${(betAmount * 1.96).toFixed(2)} coins!` : 'You lost — try again!'}
            </p>
          </div>
        )}
        {!result && !flipping && (
          <p className="text-gray-500 text-sm">Pick a side and flip!</p>
        )}
      </div>
    </GameShell>
  );
}
