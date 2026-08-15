import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

const FRUIT_SYMBOLS = [
  { char: '7️⃣', value: 100, name: 'Lucky 7' },
  { char: '💎', value: 50, name: 'Diamond' },
  { char: '🔔', value: 25, name: 'Bell' },
  { char: '🍉', value: 15, name: 'Watermelon' },
  { char: '🍇', value: 10, name: 'Grapes' },
  { char: '🍋', value: 5, name: 'Lemon' },
  { char: '🍒', value: 3, name: 'Cherry' },
];

const EGYPT_SYMBOLS = [
  { char: '👑', value: 100, name: 'Pharaoh Crown' },
  { char: '👁️', value: 50, name: 'Eye of Horus' },
  { char: '📜', value: 25, name: 'Sacred Scroll' },
  { char: '🏺', value: 15, name: 'Golden Urn' },
  { char: '🔮', value: 10, name: 'Magic Orb' },
  { char: '⚖️', value: 5, name: 'Scales' },
  { char: '🐍', value: 3, name: 'Cobra' },
];

const WILD_SYMBOLS = [
  { char: '🦬', value: 100, name: 'Golden Buffalo' },
  { char: '🐅', value: 50, name: 'Royal Tiger' },
  { char: '🐺', value: 25, name: 'Alpha Wolf' },
  { char: '🦅', value: 15, name: 'Eagle' },
  { char: '🐻', value: 10, name: 'Grizzly' },
  { char: '🦊', value: 5, name: 'Fox' },
  { char: '🌴', value: 3, name: 'Jungle Tree' },
];

const GOLD_SYMBOLS = [
  { char: '💰', value: 100, name: 'Money Bag' },
  { char: '👑', value: 50, name: 'Crown' },
  { char: '🏆', value: 25, name: 'Gold Trophy' },
  { char: '🪙', value: 15, name: 'Gold Coin' },
  { char: '💎', value: 10, name: 'Gem' },
  { char: '🔑', value: 5, name: 'Golden Key' },
  { char: '🍀', value: 3, name: 'Clover' },
];

function getSymbolSet(subCategory: string) {
  if (subCategory.includes('Fruit')) return FRUIT_SYMBOLS;
  if (subCategory.includes('Egyptian')) return EGYPT_SYMBOLS;
  if (subCategory.includes('Animals')) return WILD_SYMBOLS;
  return GOLD_SYMBOLS;
}

export default function AnimatedSlotMachine({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, updateBalance, addHistory } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [turboMode, setTurboMode] = useState(false);

  const symbols = getSymbolSet(game.subCategory);

  const [reels, setReels] = useState<[number, number, number, number, number]>([0, 1, 2, 3, 4]);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);

  const handleSpin = () => {
    if (isSpinning || betAmount > balance) return;
    updateBalance(-betAmount);
    setIsSpinning(true);
    setLastWin(null);
    setWinMessage(null);

    const spinDuration = turboMode ? 600 : 1800;
    const intervalTime = 60;

    let elapsed = 0;
    const interval = setInterval(() => {
      setReels([
        Math.floor(Math.random() * symbols.length),
        Math.floor(Math.random() * symbols.length),
        Math.floor(Math.random() * symbols.length),
        Math.floor(Math.random() * symbols.length),
        Math.floor(Math.random() * symbols.length),
      ]);
      elapsed += intervalTime;

      if (elapsed >= spinDuration) {
        clearInterval(interval);
        const finalReels: [number, number, number, number, number] = [
          Math.floor(Math.random() * symbols.length),
          Math.floor(Math.random() * symbols.length),
          Math.floor(Math.random() * symbols.length),
          Math.floor(Math.random() * symbols.length),
          Math.floor(Math.random() * symbols.length),
        ];

        setReels(finalReels);
        setIsSpinning(false);

        // Check payouts (matches)
        const counts: { [key: number]: number } = {};
        finalReels.forEach((r) => (counts[r] = (counts[r] || 0) + 1));

        let maxMatch = 1;
        let matchedSymbolIdx = 0;
        Object.entries(counts).forEach(([idx, count]) => {
          if (count > maxMatch) {
            maxMatch = count;
            matchedSymbolIdx = Number(idx);
          }
        });

        let multiplier = 0;
        const sym = symbols[matchedSymbolIdx];

        if (maxMatch === 5) multiplier = sym.value * 5;
        else if (maxMatch === 4) multiplier = sym.value * 2;
        else if (maxMatch === 3) multiplier = Math.max(2, Math.floor(sym.value * 0.5));
        else if (maxMatch === 2 && sym.value >= 25) multiplier = 1.5;

        const winAmount = Math.floor(betAmount * multiplier);
        if (multiplier > 0) {
          updateBalance(winAmount);
          setLastWin(winAmount);
          setWinMessage(`BIG WIN! ${maxMatch}x ${sym.name} MATCHED (+${winAmount.toLocaleString()} COINS)`);
        } else {
          setWinMessage('NO MATCH THIS SPIN. TRY AGAIN!');
        }

        addHistory({
          game: game.name,
          bet: betAmount,
          profit: multiplier > 0 ? winAmount - betAmount : -betAmount,
          result: multiplier > 0 ? 'win' : 'loss',
          multiplier: multiplier,
        });
      }
    }, intervalTime);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[#171717] border border-white/10 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg bg-white/5 text-white/70 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <h1 className="text-lg font-black text-white">{game.name}</h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                5-REEL SLOT
              </span>
            </div>
            <p className="text-xs text-white/40">{game.provider} • {game.subCategory}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTurboMode(!turboMode)}
            className={`p-2 rounded-lg border transition ${
              turboMode ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <div className="text-right ml-2">
            <p className="text-[10px] text-white/40 uppercase font-bold">Balance</p>
            <p className="text-sm font-black text-amber-300">{balance.toLocaleString()} Coins</p>
          </div>
        </div>
      </div>

      {/* Slot Machine Frame */}
      <div className={`relative overflow-hidden rounded-2xl border-4 border-amber-500/30 bg-gradient-to-br ${game.accent} p-6 shadow-2xl text-center`}>
        {/* Glow backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.1),transparent_70%)] pointer-events-none" />

        {/* Payline Header */}
        <div className="mb-4 flex items-center justify-center gap-2 text-xs font-black uppercase text-amber-200/80 tracking-widest">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>MATCH 3 OR MORE SYMBOLS FOR MULTIPLIER PAYOUTS</span>
          <Sparkles className="w-4 h-4 text-amber-300" />
        </div>

        {/* 5 Animated Reels */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3 my-4 bg-black/60 p-3 sm:p-4 rounded-xl border border-white/10 shadow-inner">
          {reels.map((symIdx, reelIdx) => {
            const sym = symbols[symIdx];
            return (
              <div
                key={reelIdx}
                className={`relative aspect-[0.8/1] rounded-xl bg-gradient-to-b from-slate-900 to-zinc-950 border-2 border-amber-400/30 flex flex-col items-center justify-center shadow-lg transition-transform duration-200 ${
                  isSpinning ? 'animate-pulse scale-95 border-amber-400' : 'hover:scale-105'
                }`}
              >
                <span className="text-3xl sm:text-5xl select-none filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                  {sym.char}
                </span>
                <span className="text-[9px] font-bold text-white/50 uppercase mt-2 truncate max-w-[90%]">
                  {sym.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Win Notification Banner */}
        {winMessage && (
          <div className="mt-4 animate-bounce">
            {lastWin ? (
              <span className="px-5 py-2.5 rounded-xl bg-amber-400 text-black font-black text-sm uppercase shadow-2xl inline-flex items-center gap-2 border border-yellow-200">
                <Sparkles className="w-5 h-5 text-black" /> {winMessage}
              </span>
            ) : (
              <span className="px-5 py-2 rounded-xl bg-black/60 text-white/70 font-bold text-xs uppercase border border-white/10">
                {winMessage}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-[#171717] border border-white/10 rounded-xl p-5 space-y-4">
        <BetControls betAmount={betAmount} onBetChange={setBetAmount} disabled={isSpinning} />

        <button
          onClick={handleSpin}
          disabled={isSpinning || betAmount > balance}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-black font-black uppercase text-base shadow-xl hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Play className="w-6 h-6 fill-black" /> Spin Reels
        </button>
      </div>
    </div>
  );
}
