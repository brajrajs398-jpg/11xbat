import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Play, Sparkles } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = {
  game: CatalogGame;
  onBack: () => void;
};

// Standard Roulette Numbers
const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export default function AnimatedLiveRoulette({ game, onBack }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [betType, setBetAmountType] = useState<'red' | 'black' | 'even' | 'odd' | 'number'>('red');
  const [selectedNumber, setSelectedNumber] = useState<number>(7);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ win: boolean; amount: number; num: number } | null>(null);
  const [recentHistory, setRecentHistory] = useState<number[]>([14, 22, 0, 31, 9, 7]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleSpin = async () => {
    if (isSpinning || betAmount > balance) return;

    setIsSpinning(true);
    setWinningNumber(null);
    setLastResult(null);

    // Server decides the real outcome and payout before any animation plays.
    const serverBetType = betType === 'number' ? 'straight' : betType;
    let data;
    try {
      data = await api.roulettePlaceBets(betAmount, [
        { type: serverBetType, value: betType === 'number' ? selectedNumber : undefined, amount: betAmount },
      ]);
    } catch {
      setIsSpinning(false);
      setLastResult(null);
      return;
    }

    const resultNum = data.winningNumber;
    const randomIndex = ROULETTE_NUMBERS.indexOf(resultNum);
    const degPerSegment = 360 / ROULETTE_NUMBERS.length;
    const targetDeg = wheelRotation + 1800 + (360 - (randomIndex * degPerSegment));
    setWheelRotation(targetDeg);

    setTimeout(async () => {
      setIsSpinning(false);
      setWinningNumber(resultNum);
      setRecentHistory((prev) => [resultNum, ...prev.slice(0, 7)]);

      const won = data.results[0]?.won ?? false;
      const winAmount = data.totalPayout;

      setLastResult({ win: won, amount: winAmount, num: resultNum });
      await refreshBalance();
    }, 3500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-[#171717] border border-white/10 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <h1 className="text-lg font-black text-white">{game.name}</h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                LIVE DEALER
              </span>
            </div>
            <p className="text-xs text-white/40">{game.provider} • European Rules</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <div className="text-right">
            <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Balance</p>
            <p className="text-sm font-black text-amber-300">{balance.toLocaleString()} Coins</p>
          </div>
        </div>
      </div>

      {/* Live Stage & Wheel Animation */}
      <div className={`relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b ${game.accent} p-6 text-center shadow-2xl`}>
        {/* Decorative Dealer Backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.15),transparent_60%)] pointer-events-none" />

        {/* Recent Outcomes Bar */}
        <div className="relative flex items-center justify-center gap-2 mb-6">
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest mr-2">History:</span>
          {recentHistory.map((num, i) => {
            const isRed = RED_NUMBERS.includes(num);
            const isZero = num === 0;
            return (
              <span
                key={i}
                className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black shadow-md border ${
                  isZero
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : isRed
                    ? 'bg-red-600 text-white border-red-400'
                    : 'bg-zinc-900 text-white border-zinc-700'
                } ${i === 0 ? 'scale-110 ring-2 ring-amber-400' : 'opacity-70'}`}
              >
                {num}
              </span>
            );
          })}
        </div>

        {/* Roulette Wheel Stage */}
        <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 my-4 flex items-center justify-center">
          {/* Outer Gold Ring */}
          <div className="absolute inset-0 rounded-full border-[10px] border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.2)] animate-pulse" />

          {/* Pointer */}
          <div className="absolute -top-3 z-30 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-300 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />

          {/* Rotating Wheel Graphics */}
          <div
            className="w-full h-full rounded-full border-4 border-amber-300/30 relative flex items-center justify-center transition-transform duration-[3500ms] cubic-bezier(0.15, 0.9, 0.2, 1.0)"
            style={{ transform: `rotate(${wheelRotation}deg)` }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-950 via-zinc-900 to-black p-2 relative overflow-hidden flex items-center justify-center">
              {ROULETTE_NUMBERS.map((num, idx) => {
                const angle = idx * (360 / ROULETTE_NUMBERS.length);
                const isRed = RED_NUMBERS.includes(num);
                const isZero = num === 0;
                return (
                  <div
                    key={idx}
                    className="absolute w-full h-full top-0 left-0 flex items-start justify-center pt-1"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <span
                      className={`text-[9px] font-black px-1 rounded ${
                        isZero ? 'text-emerald-400' : isRed ? 'text-red-400' : 'text-slate-200'
                      }`}
                    >
                      {num}
                    </span>
                  </div>
                );
              })}
              {/* Inner Brass Hub */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-amber-700 via-amber-400 to-yellow-200 border-4 border-amber-900 flex items-center justify-center shadow-inner">
                <span className="text-xs font-black text-amber-950 uppercase tracking-tighter">
                  {isSpinning ? 'SPINNING...' : winningNumber !== null ? `RESULT ${winningNumber}` : 'PLACE BET'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Win/Loss Result Banner */}
        {lastResult && (
          <div className="mt-4 animate-bounce">
            {lastResult.win ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                <Sparkles className="w-5 h-5 text-emerald-300" />
                <span className="font-black text-sm">YOU WON +{lastResult.amount.toLocaleString()} COINS!</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300">
                <span className="font-black text-sm">BALL LANDED ON {lastResult.num}. TRY AGAIN!</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Betting Panel */}
      <div className="bg-[#171717] border border-white/10 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider">Select Bet Type</h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            onClick={() => setBetAmountType('red')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'red'
                ? 'bg-red-600 text-white border-red-400 shadow-[0_0_12px_rgba(220,38,38,0.5)]'
                : 'bg-red-950/40 text-red-300 border-red-900/50 hover:bg-red-900/40'
            }`}
          >
            Red (2x)
          </button>
          <button
            onClick={() => setBetAmountType('black')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'black'
                ? 'bg-zinc-800 text-white border-zinc-500 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            Black (2x)
          </button>
          <button
            onClick={() => setBetAmountType('even')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'even'
                ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-amber-950/30 text-amber-300 border-amber-900/40 hover:bg-amber-900/40'
            }`}
          >
            Even (2x)
          </button>
          <button
            onClick={() => setBetAmountType('odd')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'odd'
                ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-amber-950/30 text-amber-300 border-amber-900/40 hover:bg-amber-900/40'
            }`}
          >
            Odd (2x)
          </button>
          <button
            onClick={() => setBetAmountType('number')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'number'
                ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                : 'bg-cyan-950/30 text-cyan-300 border-cyan-900/40 hover:bg-cyan-900/40'
            }`}
          >
            Single Number (36x)
          </button>
        </div>

        {/* Single Number Selector if selected */}
        {betType === 'number' && (
          <div className="pt-2">
            <p className="text-xs text-white/50 mb-2">Pick Single Number (0 - 36):</p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {ROULETTE_NUMBERS.map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedNumber(n)}
                  className={`w-8 h-8 rounded text-xs font-bold transition border ${
                    selectedNumber === n
                      ? 'bg-cyan-400 text-black border-white shadow-md'
                      : n === 0
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                      : RED_NUMBERS.includes(n)
                      ? 'bg-red-950 text-red-300 border-red-900 hover:bg-red-900'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bet Controls */}
        <div className="pt-2">
          <BetControls betAmount={betAmount} onBetChange={setBetAmount} disabled={isSpinning} />
        </div>

        {/* Action Button */}
        <button
          onClick={handleSpin}
          disabled={isSpinning || betAmount > balance}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-black font-black uppercase tracking-wider text-sm shadow-lg hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSpinning ? (
            <>
              <RotateCcw className="w-5 h-5 animate-spin" />
              Spinning Wheel...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-black" />
              Place Bet & Spin
            </>
          )}
        </button>
      </div>
    </div>
  );
}
