import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

export default function AnimatedLiveDice({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, updateBalance, addHistory } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [betChoice, setBetChoice] = useState<'small' | 'big' | 'triple'>('small');
  const [isRolling, setIsRolling] = useState(false);
  const [dice, setDice] = useState<[number, number, number]>([3, 4, 5]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleRoll = () => {
    if (isRolling || betAmount > balance) return;
    updateBalance(-betAmount);
    setIsRolling(true);
    setResultMessage(null);

    let count = 0;
    const interval = setInterval(() => {
      setDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
      count++;
      if (count >= 15) {
        clearInterval(interval);
        const finalDice: [number, number, number] = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];
        setDice(finalDice);
        setIsRolling(false);

        const sum = finalDice[0] + finalDice[1] + finalDice[2];
        const isTriple = finalDice[0] === finalDice[1] && finalDice[1] === finalDice[2];
        const isSmall = sum >= 4 && sum <= 10 && !isTriple;
        const isBig = sum >= 11 && sum <= 17 && !isTriple;

        let isWin = false;
        let mult = 2;

        if (betChoice === 'small' && isSmall) isWin = true;
        else if (betChoice === 'big' && isBig) isWin = true;
        else if (betChoice === 'triple' && isTriple) {
          isWin = true;
          mult = 30;
        }

        const winAmount = isWin ? betAmount * mult : 0;
        if (isWin) updateBalance(winAmount);

        setResultMessage(
          isWin ? `SUM IS ${sum}! YOU WIN +${winAmount.toLocaleString()} COINS!` : `SUM IS ${sum}. TRY AGAIN!`
        );

        addHistory({
          game: game.name,
          bet: betAmount,
          profit: isWin ? winAmount - betAmount : -betAmount,
          result: isWin ? 'win' : 'loss',
          multiplier: isWin ? mult : 0,
        });
      }
    }, 100);
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
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <h1 className="text-lg font-black text-white">{game.name}</h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                LIVE SIC BO
              </span>
            </div>
            <p className="text-xs text-white/40">{game.provider} • Glass Dome Shaker</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase font-bold">Balance</p>
          <p className="text-sm font-black text-amber-300">{balance.toLocaleString()} Coins</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border-4 border-cyan-900/60 bg-gradient-to-b from-cyan-950 via-slate-900 to-black p-6 text-center shadow-2xl">
        <div className="flex justify-center gap-4 my-6">
          {dice.map((d, i) => (
            <div
              key={i}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-white to-slate-200 text-slate-900 rounded-2xl border-4 border-slate-300 font-black text-3xl sm:text-4xl flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.5)] transform hover:scale-105 transition"
            >
              {d}
            </div>
          ))}
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
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setBetChoice('small')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betChoice === 'small' ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-cyan-950/30 text-cyan-300 border-cyan-900/50'
            }`}
          >
            Small (4-10) 2x
          </button>
          <button
            onClick={() => setBetChoice('triple')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betChoice === 'triple' ? 'bg-amber-400 text-black border-amber-200' : 'bg-amber-950/30 text-amber-300 border-amber-900/50'
            }`}
          >
            Any Triple 30x
          </button>
          <button
            onClick={() => setBetChoice('big')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betChoice === 'big' ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-cyan-950/30 text-cyan-300 border-cyan-900/50'
            }`}
          >
            Big (11-17) 2x
          </button>
        </div>

        <BetControls betAmount={betAmount} onBetChange={setBetAmount} disabled={isRolling} />

        <button
          onClick={handleRoll}
          disabled={isRolling || betAmount > balance}
          className="w-full py-3.5 rounded-xl bg-amber-400 text-black font-black uppercase text-sm shadow-lg hover:bg-amber-300 transition flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-black" /> Shake Dice Dome
        </button>
      </div>
    </div>
  );
}
