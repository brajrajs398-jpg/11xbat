import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
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

const OCEAN_SYMBOLS = [
  { char: '🐋', value: 100, name: 'Whale' },
  { char: '🦈', value: 50, name: 'Shark' },
  { char: '🐙', value: 25, name: 'Octopus' },
  { char: '🐠', value: 15, name: 'Tropical Fish' },
  { char: '🦀', value: 10, name: 'Crab' },
  { char: '🐚', value: 5, name: 'Shell' },
  { char: '⚓', value: 3, name: 'Anchor' },
];

const SPACE_SYMBOLS = [
  { char: '🛸', value: 100, name: 'UFO' },
  { char: '🚀', value: 50, name: 'Rocket' },
  { char: '🪐', value: 25, name: 'Saturn' },
  { char: '👽', value: 15, name: 'Alien' },
  { char: '🌌', value: 10, name: 'Galaxy' },
  { char: '⭐', value: 5, name: 'Star' },
  { char: '☄️', value: 3, name: 'Comet' },
];

const DRAGON_SYMBOLS = [
  { char: '🐉', value: 100, name: 'Dragon' },
  { char: '🔥', value: 50, name: 'Dragon Fire' },
  { char: '⚔️', value: 25, name: 'Sword' },
  { char: '🛡️', value: 15, name: 'Shield' },
  { char: '🏯', value: 10, name: 'Castle' },
  { char: '💠', value: 5, name: 'Rune' },
  { char: '🗡️', value: 3, name: 'Dagger' },
];

const PIRATE_SYMBOLS = [
  { char: '🏴‍☠️', value: 100, name: 'Jolly Roger' },
  { char: '☠️', value: 50, name: 'Skull' },
  { char: '🗺️', value: 25, name: 'Treasure Map' },
  { char: '⛵', value: 15, name: 'Ship' },
  { char: '🔱', value: 10, name: 'Trident' },
  { char: '🪙', value: 5, name: 'Doubloon' },
  { char: '🦜', value: 3, name: 'Parrot' },
];

const ICE_SYMBOLS = [
  { char: '❄️', value: 100, name: 'Snowflake' },
  { char: '🧊', value: 50, name: 'Ice Block' },
  { char: '⛄', value: 25, name: 'Snowman' },
  { char: '🐧', value: 15, name: 'Penguin' },
  { char: '🏔️', value: 10, name: 'Glacier' },
  { char: '❅', value: 5, name: 'Frost' },
  { char: '💧', value: 3, name: 'Icicle' },
];

const FIRE_SYMBOLS = [
  { char: '🌋', value: 100, name: 'Volcano' },
  { char: '🔥', value: 50, name: 'Flame' },
  { char: '☄️', value: 25, name: 'Meteor' },
  { char: '⚡', value: 15, name: 'Lightning' },
  { char: '🌡️', value: 10, name: 'Heat' },
  { char: '🧨', value: 5, name: 'Dynamite' },
  { char: '✨', value: 3, name: 'Spark' },
];

const ROYAL_SYMBOLS = [
  { char: '👑', value: 100, name: 'Royal Crown' },
  { char: '🏰', value: 50, name: 'Castle' },
  { char: '💍', value: 25, name: 'Ring' },
  { char: '⚜️', value: 15, name: 'Fleur-de-lis' },
  { char: '🎭', value: 10, name: 'Mask' },
  { char: '🕯️', value: 5, name: 'Candle' },
  { char: '📯', value: 3, name: 'Horn' },
];

const CARNIVAL_SYMBOLS = [
  { char: '🎪', value: 100, name: 'Big Top' },
  { char: '🎡', value: 50, name: 'Ferris Wheel' },
  { char: '🎠', value: 25, name: 'Carousel' },
  { char: '🎭', value: 15, name: 'Mask' },
  { char: '🎈', value: 10, name: 'Balloon' },
  { char: '🍿', value: 5, name: 'Popcorn' },
  { char: '🎫', value: 3, name: 'Ticket' },
];

const STORM_SYMBOLS = [
  { char: '⛈️', value: 100, name: 'Thunderstorm' },
  { char: '🌪️', value: 50, name: 'Tornado' },
  { char: '⚡', value: 25, name: 'Bolt' },
  { char: '🌊', value: 15, name: 'Wave' },
  { char: '☁️', value: 10, name: 'Cloud' },
  { char: '🌩️', value: 5, name: 'Lightning Cloud' },
  { char: '💨', value: 3, name: 'Gust' },
];

const JUNGLE_SYMBOLS = [
  { char: '🦁', value: 100, name: 'Lion' },
  { char: '🐆', value: 50, name: 'Leopard' },
  { char: '🦍', value: 25, name: 'Gorilla' },
  { char: '🐍', value: 15, name: 'Snake' },
  { char: '🌺', value: 10, name: 'Hibiscus' },
  { char: '🥥', value: 5, name: 'Coconut' },
  { char: '🍌', value: 3, name: 'Banana' },
];

const MYSTIC_SYMBOLS = [
  { char: '🔮', value: 100, name: 'Crystal Ball' },
  { char: '🧙', value: 50, name: 'Sorcerer' },
  { char: '📖', value: 25, name: 'Spellbook' },
  { char: '✨', value: 15, name: 'Magic Sparkle' },
  { char: '🪄', value: 10, name: 'Wand' },
  { char: '🕯️', value: 5, name: 'Candle' },
  { char: '⭐', value: 3, name: 'Star' },
];

const MONSTER_SYMBOLS = [
  { char: '👹', value: 100, name: 'Ogre' },
  { char: '👺', value: 50, name: 'Goblin Mask' },
  { char: '🧟', value: 25, name: 'Zombie' },
  { char: '🦇', value: 15, name: 'Bat' },
  { char: '🕷️', value: 10, name: 'Spider' },
  { char: '🌙', value: 5, name: 'Dark Moon' },
  { char: '🩸', value: 3, name: 'Blood Drop' },
];

const CANDY_SYMBOLS = [
  { char: '🍭', value: 100, name: 'Lollipop' },
  { char: '🍬', value: 50, name: 'Candy' },
  { char: '🧁', value: 25, name: 'Cupcake' },
  { char: '🍩', value: 15, name: 'Donut' },
  { char: '🍫', value: 10, name: 'Chocolate' },
  { char: '🍦', value: 5, name: 'Ice Cream' },
  { char: '🍡', value: 3, name: 'Dango' },
];

const SPORT_SYMBOLS = [
  { char: '🏆', value: 100, name: 'Trophy' },
  { char: '⚽', value: 50, name: 'Football' },
  { char: '🏅', value: 25, name: 'Medal' },
  { char: '🎯', value: 15, name: 'Target' },
  { char: '🥇', value: 10, name: 'Gold Medal' },
  { char: '📣', value: 5, name: 'Cheer Horn' },
  { char: '🎽', value: 3, name: 'Jersey' },
];

const COSMIC_TIME_SYMBOLS = [
  { char: '⏳', value: 100, name: 'Hourglass' },
  { char: '🌗', value: 50, name: 'Moon Phase' },
  { char: '🕰️', value: 25, name: 'Clock' },
  { char: '🌀', value: 15, name: 'Vortex' },
  { char: '🧭', value: 10, name: 'Compass' },
  { char: '🔯', value: 5, name: 'Hex Star' },
  { char: '♾️', value: 3, name: 'Infinity' },
];

const KEYWORD_SYMBOL_MAP: [string[], typeof FRUIT_SYMBOLS][] = [
  [['Ocean', 'Deep', 'Wave', 'Tide', 'Coral'], OCEAN_SYMBOLS],
  [['Cosmic', 'Astral', 'Lunar', 'Solar', 'Celestial'], SPACE_SYMBOLS],
  [['Dragon', 'Serpent'], DRAGON_SYMBOLS],
  [['Pirate', 'Voyage', 'Bounty', 'Buccaneer'], PIRATE_SYMBOLS],
  [['Frozen', 'Ice', 'Winter', 'Arctic'], ICE_SYMBOLS],
  [['Blazing', 'Molten', 'Fire', 'Volcano', 'Inferno'], FIRE_SYMBOLS],
  [['Royal', 'Imperial', 'Majestic', 'Regal', 'Monarch', 'Dynasty', 'Kingdom', 'Empire'], ROYAL_SYMBOLS],
  [['Carnival', 'Fest', 'Mania', 'Fever'], CARNIVAL_SYMBOLS],
  [['Storm', 'Thunder', 'Roaring', 'Whirlwind'], STORM_SYMBOLS],
  [['Wild', 'Jungle', 'Savage', 'Untamed', 'Feral'], JUNGLE_SYMBOLS],
  [['Mystic', 'Enchanted', 'Sacred', 'Legendary'], MYSTIC_SYMBOLS],
  [['Shadow', 'Eternal', 'Rebellion'], MONSTER_SYMBOLS],
  [['Rush', 'Blast', 'Escape', 'Drift', 'Horizon', 'Strike'], SPORT_SYMBOLS],
  [['Vivid', 'Vault', 'Reels', 'Saga', 'Odyssey', 'Quest', 'Adventure'], COSMIC_TIME_SYMBOLS],
];

function getSymbolSet(subCategory: string, name: string) {
  for (const [keywords, set] of KEYWORD_SYMBOL_MAP) {
    if (keywords.some((kw) => name.includes(kw))) return set;
  }
  if (subCategory.includes('Fruit')) return FRUIT_SYMBOLS;
  if (subCategory.includes('Egyptian')) return EGYPT_SYMBOLS;
  if (subCategory.includes('Animals')) return WILD_SYMBOLS;
  if (subCategory.includes('Gold') || subCategory.includes('Classic')) return CANDY_SYMBOLS;
  return GOLD_SYMBOLS;
}

export default function AnimatedSlotMachine({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [turboMode, setTurboMode] = useState(false);

  const symbols = getSymbolSet(game.subCategory, game.name);

  const [reels, setReels] = useState<[number, number, number, number, number]>([0, 1, 2, 3, 4]);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);

  const handleSpin = async () => {
    if (isSpinning || betAmount > balance) return;
    setIsSpinning(true);
    setLastWin(null);
    setWinMessage(null);

    let serverResult: { reels: number[]; multiplier: number; payout: number } | null = null;
    try {
      serverResult = await api.slotSpin(betAmount, game.name);
    } catch {
      setIsSpinning(false);
      return; // insufficient balance or network issue — nothing was deducted
    }

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
        const finalReels = serverResult!.reels as [number, number, number, number, number];
        setReels(finalReels);
        setIsSpinning(false);

        const multiplier = serverResult!.multiplier;
        const winAmount = serverResult!.payout;

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
        const sym = symbols[matchedSymbolIdx];

        if (multiplier > 0) {
          setLastWin(winAmount);
          setWinMessage(`BIG WIN! ${maxMatch}x ${sym.name} MATCHED (+${winAmount.toLocaleString()} COINS)`);
        } else {
          setWinMessage('NO MATCH THIS SPIN. TRY AGAIN!');
        }

        refreshBalance();
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
