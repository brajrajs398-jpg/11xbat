import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

// Mirrors backend/backend/src/games.ts GAME_SHOW_SEGMENTS order/weights —
// used only to pick a plausible-looking wedge to land the animation on.
const SEGMENTS = [
  { label: '0', mult: 0, color: 'bg-zinc-700 text-white' },
  { label: '1', mult: 1, color: 'bg-blue-600 text-white' },
  { label: '2', mult: 2, color: 'bg-emerald-600 text-white' },
  { label: '5', mult: 5, color: 'bg-purple-600 text-white' },
  { label: '10', mult: 10, color: 'bg-rose-600 text-white' },
  { label: '20', mult: 20, color: 'bg-fuchsia-600 text-white' },
  { label: '50', mult: 50, color: 'bg-amber-500 text-black' },
  { label: '100', mult: 100, color: 'bg-amber-300 text-black' },
];

export default function AnimatedLiveGameShow({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleSpin = async () => {
    if (isSpinning || betAmount > balance) return;
    setIsSpinning(true);
    setResultMessage(null);

    try {
      // Server spins the weighted wheel and settles the bet before any
      // animation plays; segmentIndex just tells us which wedge to land on.
      const data = await api.gameShowPlay(betAmount);
      const segIdx = Math.min(data.segmentIndex, SEGMENTS.length - 1);
      const targetDeg = rotation + 1800 + (360 - segIdx * (360 / SEGMENTS.length));
      setRotation(targetDeg);

      setTimeout(async () => {
        setIsSpinning(false);
        const won = data.multiplier > 0;
        setResultMessage(
          won
            ? `WHEEL STOPPED ON ${data.multiplier}x! YOU WIN +${data.payout.toLocaleString()} COINS!`
            : `WHEEL STOPPED ON 0x. TRY AGAIN!`
        );
        await refreshBalance();
      }, 3500);
    } catch {
      setIsSpinning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between bg-[#171717] border border-white/10 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg bg-white/5 text-white/70 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping" />
              <h1 className="text-lg font-black text-white">{game.name}</h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-fuchsia-400/20 text-fuchsia-300 border border-fuchsia-400/30">
                LIVE GAME SHOW
              </span>
            </div>
            <p className="text-xs text-white/40">{game.provider} • Mega Wheel Experience</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase font-bold">Balance</p>
          <p className="text-sm font-black text-amber-300">{balance.toLocaleString()} Coins</p>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-2xl border-4 border-fuchsia-900/60 bg-gradient-to-b ${game.accent} p-6 text-center shadow-2xl`}>
        <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 my-4 flex items-center justify-center">
          <div className="absolute -top-3 z-30 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-300" />
          <div
            className="w-full h-full rounded-full border-4 border-amber-300/30 relative flex items-center justify-center transition-transform duration-[3500ms] cubic-bezier(0.15, 0.9, 0.2, 1.0)"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-fuchsia-950 to-zinc-900 p-2 relative overflow-hidden flex items-center justify-center">
              {SEGMENTS.map((seg, idx) => {
                const angle = idx * (360 / SEGMENTS.length);
                return (
                  <div
                    key={idx}
                    className="absolute w-full h-full top-0 left-0 flex items-start justify-center pt-2"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <span className={`text-xs font-black px-2 py-0.5 rounded ${seg.color}`}>{seg.label}</span>
                  </div>
                );
              })}
              <div className="w-24 h-24 rounded-full bg-amber-400 text-black font-black text-xs flex items-center justify-center border-4 border-amber-200">
                {isSpinning ? 'SPINNING...' : 'MEGA WHEEL'}
              </div>
            </div>
          </div>
        </div>

        {resultMessage && (
          <div className="my-3">
            <span className="px-4 py-2 rounded-xl bg-amber-400 text-black font-black text-sm uppercase shadow-lg inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> {resultMessage}
            </span>
          </div>
        )}
      </div>

      <div className="bg-[#171717] border border-white/10 rounded-xl p-5 space-y-4">
        <p className="text-xs text-white/50 text-center">The wheel decides your multiplier — no picking, pure luck.</p>

        <BetControls betAmount={betAmount} onBetChange={setBetAmount} disabled={isSpinning} />

        <button
          onClick={handleSpin}
          disabled={isSpinning || betAmount > balance}
          className="w-full py-3.5 rounded-xl bg-amber-400 text-black font-black uppercase text-sm shadow-lg hover:bg-amber-300 transition flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-black" /> Spin Wheel
        </button>
      </div>
    </div>
  );
}
