import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

type Card = { suit: '♠' | '♥' | '♦' | '♣'; value: string; rank: number };
const SUITS: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function getCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const rIdx = Math.floor(Math.random() * VALUES.length);
  return { suit, value: VALUES[rIdx], rank: rIdx + 2 };
}

function evaluate3CardHand(cards: Card[]): number {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const isStraight = (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) || (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2);
  const isTrio = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2];

  if (isTrio) return 600 + ranks[0];
  if (isStraight && isFlush) return 500 + ranks[0];
  if (isStraight) return 400 + ranks[0];
  if (isFlush) return 300 + ranks[0];
  if (isPair) {
    const pairRank = ranks[0] === ranks[1] ? ranks[0] : ranks[1];
    return 200 + pairRank;
  }
  return ranks[0];
}

export default function AnimatedLiveTeenPatti({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, updateBalance, addHistory } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [betTarget, setBetTarget] = useState<'playerA' | 'playerB'>('playerA');
  const [isDealing, setIsDealing] = useState(false);
  const [handA, setHandA] = useState<Card[]>([]);
  const [handB, setHandB] = useState<Card[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handlePlay = () => {
    if (isDealing || betAmount > balance) return;
    updateBalance(-betAmount);
    setIsDealing(true);
    setResultMessage(null);

    const a = [getCard(), getCard(), getCard()];
    const b = [getCard(), getCard(), getCard()];

    setHandA(a);
    setHandB(b);

    setTimeout(() => {
      setIsDealing(false);
      const scoreA = evaluate3CardHand(a);
      const scoreB = evaluate3CardHand(b);

      const winner: 'playerA' | 'playerB' = scoreA >= scoreB ? 'playerA' : 'playerB';
      const isWin = betTarget === winner;
      const multiplier = 1.95;

      const winAmount = isWin ? betAmount * multiplier : 0;
      if (isWin) updateBalance(winAmount);

      setResultMessage(
        winner === 'playerA' ? 'PLAYER A WINS THE SHOWDOWN!' : 'PLAYER B WINS THE SHOWDOWN!'
      );

      addHistory({
        game: game.name,
        bet: betAmount,
        profit: isWin ? winAmount - betAmount : -betAmount,
        result: isWin ? 'win' : 'loss',
        multiplier: isWin ? multiplier : 0,
      });
    }, 1200);
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
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <h1 className="text-lg font-black text-white">{game.name}</h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                INDIAN CLASSIC
              </span>
            </div>
            <p className="text-xs text-white/40">{game.provider} • 3-Card Showdown</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase font-bold">Balance</p>
          <p className="text-sm font-black text-amber-300">{balance.toLocaleString()} Coins</p>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-2xl border-4 border-amber-900/60 bg-gradient-to-b ${game.accent} p-6 text-center shadow-2xl min-h-[320px] flex flex-col justify-between`}>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/30 border border-amber-500/30 rounded-xl p-4">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">PLAYER A</h3>
            <div className="flex justify-center gap-2 min-h-[80px] items-center">
              {handA.map((c, i) => (
                <div key={i} className="w-12 h-18 bg-white text-slate-900 rounded font-black text-xs p-1.5 shadow flex flex-col justify-between">
                  <span>{c.value}{c.suit}</span>
                  <span className="text-lg text-center">{c.suit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/30 border border-amber-500/30 rounded-xl p-4">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">PLAYER B</h3>
            <div className="flex justify-center gap-2 min-h-[80px] items-center">
              {handB.map((c, i) => (
                <div key={i} className="w-12 h-18 bg-white text-slate-900 rounded font-black text-xs p-1.5 shadow flex flex-col justify-between">
                  <span>{c.value}{c.suit}</span>
                  <span className="text-lg text-center">{c.suit}</span>
                </div>
              ))}
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
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setBetTarget('playerA')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betTarget === 'playerA' ? 'bg-amber-500 text-black border-amber-300' : 'bg-amber-950/30 text-amber-300 border-amber-900/50'
            }`}
          >
            Bet Player A (1.95x)
          </button>
          <button
            onClick={() => setBetTarget('playerB')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betTarget === 'playerB' ? 'bg-amber-500 text-black border-amber-300' : 'bg-amber-950/30 text-amber-300 border-amber-900/50'
            }`}
          >
            Bet Player B (1.95x)
          </button>
        </div>

        <BetControls betAmount={betAmount} onBetChange={setBetAmount} disabled={isDealing} />

        <button
          onClick={handlePlay}
          disabled={isDealing || betAmount > balance}
          className="w-full py-3.5 rounded-xl bg-amber-400 text-black font-black uppercase text-sm shadow-lg hover:bg-amber-300 transition flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-black" /> Play Teen Patti Hand
        </button>
      </div>
    </div>
  );
}
