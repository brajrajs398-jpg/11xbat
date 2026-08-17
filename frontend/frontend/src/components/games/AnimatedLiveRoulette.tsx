import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Play, Sparkles, Gem } from 'lucide-react';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';
import { getRouletteSkin } from '@/data/rouletteSkins';
import { useRouletteGame, ROULETTE_NUMBERS, RED_NUMBERS } from '@/lib/useRouletteGame';

type Props = {
  game: CatalogGame;
  onBack: () => void;
};

export default function AnimatedLiveRoulette({ game, onBack }: Props) {
  const skin = getRouletteSkin(game.skin);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const {
    balance,
    betAmount,
    setBetAmount,
    betType,
    setBetType,
    selectedNumber,
    setSelectedNumber,
    isSpinning,
    wheelRotation,
    winningNumber,
    lastResult,
    recentHistory,
    handleSpin,
  } = useRouletteGame();

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Bar — consistent app chrome across every skin */}
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
            <p className="text-xs text-white/40">{game.provider} • {skin.tagline}</p>
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

      {/* Live Stage & Wheel Animation — themed per skin */}
      <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${skin.stageBg} p-6 text-center shadow-2xl`}>
        {skin.stageOverlay && <div className={`absolute inset-0 pointer-events-none ${skin.stageOverlay}`} />}

        {skin.motif === 'gem' && <Gem className="absolute top-4 right-4 w-5 h-5 text-yellow-300/50" />}
        {skin.motif === 'lattice' && (
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 12px)',
              color: '#f59e0b',
            }}
          />
        )}

        {/* Recent Outcomes Bar */}
        <div className="relative flex items-center justify-center gap-2 mb-6">
          <span className={`text-xs font-bold uppercase tracking-widest mr-2 ${skin.heading}`}>History:</span>
          {recentHistory.map((num, i) => {
            const isRed = RED_NUMBERS.includes(num);
            const isZero = num === 0;
            return (
              <span
                key={i}
                className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black shadow-md border ${
                  isZero ? skin.chipZero : isRed ? skin.chipRed : skin.chipBlack
                } ${i === 0 ? `scale-110 ${skin.historyActive}` : 'opacity-70'}`}
              >
                {num}
              </span>
            );
          })}
        </div>

        {/* Roulette Wheel Stage */}
        <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 my-4 flex items-center justify-center">
          <div className={`absolute inset-0 rounded-full animate-pulse ${skin.wheelRing}`} />

          <div
            className={`absolute -top-3 z-30 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] ${skin.pointer} filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]`}
          />

          <div
            className={`w-full h-full rounded-full relative flex items-center justify-center transition-transform duration-[3500ms] cubic-bezier(0.15, 0.9, 0.2, 1.0) ${skin.wheelRim}`}
            style={{ transform: `rotate(${wheelRotation}deg)` }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-black/40 via-transparent to-black/40 p-2 relative overflow-hidden flex items-center justify-center">
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
              <div
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center shadow-inner ${skin.hubGradient} ${skin.hubBorder}`}
              >
                <span className={`text-xs font-black uppercase tracking-tighter ${skin.hubText}`}>
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
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${skin.winBanner}`}>
                <Sparkles className="w-5 h-5" />
                <span className="font-black text-sm">YOU WON +{lastResult.amount.toLocaleString()} COINS!</span>
              </div>
            ) : (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${skin.loseBanner}`}>
                <span className="font-black text-sm">BALL LANDED ON {lastResult.num}. TRY AGAIN!</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Betting Panel — themed per skin */}
      <div className={`border rounded-xl p-5 space-y-4 ${skin.panelBg} ${skin.panelBorder}`}>
        <h2 className={`text-xs font-bold uppercase tracking-wider ${skin.heading}`}>Select Bet Type</h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            onClick={() => setBetType('red')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'red' ? skin.redBtn.active : skin.redBtn.idle
            }`}
          >
            Red (2x)
          </button>
          <button
            onClick={() => setBetType('black')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'black' ? skin.blackBtn.active : skin.blackBtn.idle
            }`}
          >
            Black (2x)
          </button>
          <button
            onClick={() => setBetType('even')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'even' ? skin.amberBtn.active : skin.amberBtn.idle
            }`}
          >
            Even (2x)
          </button>
          <button
            onClick={() => setBetType('odd')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'odd' ? skin.amberBtn.active : skin.amberBtn.idle
            }`}
          >
            Odd (2x)
          </button>
          <button
            onClick={() => setBetType('number')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betType === 'number' ? skin.cyanBtn.active : skin.cyanBtn.idle
            }`}
          >
            Single Number (36x)
          </button>
        </div>

        {/* Single Number Selector */}
        {betType === 'number' && (
          <div className="pt-2">
            <p className={`text-xs mb-2 ${skin.heading}`}>Pick Single Number (0 - 36):</p>
            <div
              className={
                skin.numberLayout === 'row-scroll'
                  ? 'flex gap-1.5 overflow-x-auto pb-1'
                  : 'flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1'
              }
            >
              {ROULETTE_NUMBERS.map((n) => {
                const isZero = n === 0;
                const isRed = RED_NUMBERS.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => setSelectedNumber(n)}
                    className={`w-8 h-8 shrink-0 rounded text-xs font-bold transition border ${
                      selectedNumber === n
                        ? skin.cyanBtn.active
                        : isZero
                        ? skin.chipZeroIdle
                        : isRed
                        ? skin.chipRedIdle
                        : skin.chipBlackIdle
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
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
          className={`w-full py-3.5 rounded-xl font-black uppercase tracking-wider text-sm shadow-lg hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${skin.actionBtn}`}
        >
          {isSpinning ? (
            <>
              <RotateCcw className="w-5 h-5 animate-spin" />
              Spinning Wheel...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              Place Bet & Spin
            </>
          )}
        </button>
      </div>
    </div>
  );
}
