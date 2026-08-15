import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

type Card = { suit: '♠' | '♥' | '♦' | '♣'; value: string; weight: number };
const SUITS: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function getCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const vIdx = Math.floor(Math.random() * VALUES.length);
  const val = VALUES[vIdx];
  const weight = vIdx < 9 ? vIdx + 1 : 0;
  return { suit, value: val, weight };
}

function calculateBaccaratScore(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + c.weight, 0) % 10;
}

export default function AnimatedLiveBaccarat({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, updateBalance, addHistory } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [betTarget, setBetTarget] = useState<'player' | 'banker' | 'tie'>('player');
  const [isDealing, setIsDealing] = useState(false);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [bankerHand, setBankerHand] = useState<Card[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleDeal = () => {
    if (isDealing || betAmount > balance) return;
    updateBalance(-betAmount);
    setIsDealing(true);
    setResultMessage(null);

    const p1 = getCard();
    const b1 = getCard();
    const p2 = getCard();
    const b2 = getCard();

    setPlayerHand([p1, p2]);
    setBankerHand([b1, b2]);

    setTimeout(() => {
      const pCards = [p1, p2];
      const bCards = [b1, b2];

      let pScore = calculateBaccaratScore(pCards);
      let bScore = calculateBaccaratScore(bCards);

      if (pScore <= 5 && bScore < 8) {
        const extraP = getCard();
        pCards.push(extraP);
        setPlayerHand([...pCards]);
        pScore = calculateBaccaratScore(pCards);
      }

      if (bScore <= 5 && pScore < 8) {
        const extraB = getCard();
        bCards.push(extraB);
        setBankerHand([...bCards]);
        bScore = calculateBaccaratScore(bCards);
      }

      setIsDealing(false);

      let winner: 'player' | 'banker' | 'tie' = 'tie';
      if (pScore > bScore) winner = 'player';
      else if (bScore > pScore) winner = 'banker';

      const isWin = betTarget === winner;
      const multiplier = winner === 'tie' ? 8 : winner === 'banker' ? 1.95 : 2;

      const winAmount = isWin ? betAmount * multiplier : 0;
      if (isWin) updateBalance(winAmount);

      setResultMessage(
        winner === 'tie'
          ? `TIE! (Score: ${pScore} - ${bScore})`
          : `${winner.toUpperCase()} WINS! (Score: ${pScore} vs ${bScore})`
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
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                LIVE DEALER
              </span>
            </div>
            <p className="text-xs text-white/40">{game.provider} • Squeeze & Speed Table</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase font-bold">Balance</p>
          <p className="text-sm font-black text-amber-300">{balance.toLocaleString()} Coins</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border-4 border-amber-900/60 bg-gradient-to-b from-red-950 via-zinc-900 to-black p-6 text-center shadow-2xl min-h-[320px] flex flex-col justify-between">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/30 border border-blue-500/30 rounded-xl p-4">
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">PLAYER HAND</h3>
            <div className="flex justify-center gap-2 min-h-[80px] items-center">
              {playerHand.map((c, i) => (
                <div key={i} className="w-12 h-18 bg-white text-slate-900 rounded font-black text-xs p-1.5 shadow flex flex-col justify-between">
                  <span>{c.value}{c.suit}</span>
                  <span className="text-lg text-center">{c.suit}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs font-bold text-white/70">
              Total Score: <span className="text-blue-300 font-black">{calculateBaccaratScore(playerHand)}</span>
            </p>
          </div>

          <div className="bg-black/30 border border-rose-500/30 rounded-xl p-4">
            <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest mb-2">BANKER HAND</h3>
            <div className="flex justify-center gap-2 min-h-[80px] items-center">
              {bankerHand.map((c, i) => (
                <div key={i} className="w-12 h-18 bg-white text-slate-900 rounded font-black text-xs p-1.5 shadow flex flex-col justify-between">
                  <span>{c.value}{c.suit}</span>
                  <span className="text-lg text-center">{c.suit}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs font-bold text-white/70">
              Total Score: <span className="text-rose-300 font-black">{calculateBaccaratScore(bankerHand)}</span>
            </p>
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
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setBetTarget('player')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betTarget === 'player' ? 'bg-blue-600 text-white border-blue-400' : 'bg-blue-950/30 text-blue-300 border-blue-900/50'
            }`}
          >
            Player (1:1)
          </button>
          <button
            onClick={() => setBetTarget('tie')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betTarget === 'tie' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-emerald-950/30 text-emerald-300 border-emerald-900/50'
            }`}
          >
            Tie (8:1)
          </button>
          <button
            onClick={() => setBetTarget('banker')}
            className={`py-3 rounded-lg text-xs font-black uppercase transition border ${
              betTarget === 'banker' ? 'bg-rose-600 text-white border-rose-400' : 'bg-rose-950/30 text-rose-300 border-rose-900/50'
            }`}
          >
            Banker (0.95:1)
          </button>
        </div>

        <BetControls betAmount={betAmount} onBetChange={setBetAmount} disabled={isDealing} />

        <button
          onClick={handleDeal}
          disabled={isDealing || betAmount > balance}
          className="w-full py-3.5 rounded-xl bg-amber-400 text-black font-black uppercase text-sm shadow-lg hover:bg-amber-300 transition flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-black" /> Deal Cards
        </button>
      </div>
    </div>
  );
}
