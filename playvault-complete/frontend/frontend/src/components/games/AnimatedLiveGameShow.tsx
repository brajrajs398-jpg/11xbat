import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

const SEGMENTS = [
  { label: '1', mult: 1, color: 'bg-blue-600 text-white' },
  { label: '2', mult: 2, color: 'bg-emerald-600 text-white' },
  { label: '5', mult: 5, color: 'bg-purple-600 text-white' },
  { label: '10', mult: 10, color: 'bg-rose-600 text-white' },
  { label: '20', mult: 20, color: 'bg-amber-500 text-black' },
  { label: '40', mult: 40, color: 'bg-fuchsia-600 text-white' },
];

export default function AnimatedLiveGameShow({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, updateBalance, addHistory } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [selectedSegment, setSelectedSegment] = useState('2');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleSpin = () => {
    if (isSpinning || betAmount > balance) return;
    updateBalance(-betAmount);
    setIsSpinning(true);
    setResultMessage(null);

    const randomIndex = Math.floor(Math.random() * SEGMENTS.length);
    const chosen = SEGMENTS[randomIndex];
    const targetDeg = rotation + 1800 + (360 - randomIndex * (360 / SEGMENTS.length));

    setRotation(targetDeg);

    setTimeout(() => {
      setIsSpinning(false);
      const isWin = selectedSegment === chosen.label;
      const winAmount = isWin ? betAmount * chosen.mult : 0;
      if (isWin) updateBalance(winAmount);

      setResultMessage(
        isWin ? `WHEEL STOPPED ON ${chosen.label}! YOU WIN +${winAmount.toLocaleString()} COINS!` : `WHEEL STOPPED ON ${chosen.label}. TRY AGAIN!`
      );

      addHistory({
        game: game.name,
        bet: betAmount,
        profit: isWin ? winAmount - betAmount : -betAmount,
        result: isWin ? 'win' : 'loss',
        multiplier: isWin ? chosen.mult : 0,
      });
    }, 3500);
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
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SEGMENTS.map((seg) => (
            <button
              key={seg.label}
              onClick={() => setSelectedSegment(seg.label)}
              className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
                selectedSegment === seg.label ? 'bg-amber-400 text-black border-white' : 'bg-white/5 text-white/70 border-white/10'
              }`}
            >
              {seg.label} ({seg.mult}x)
            </button>
          ))}
        </div>

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
