import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

type Card = { suit: '♠' | '♥' | '♦' | '♣'; value: string };
type ServerCard = { suit: string; rank: string };
const SUIT_MAP: Record<string, Card['suit']> = { H: '♥', D: '♦', C: '♣', S: '♠' };

function toCard(c: ServerCard): Card {
  return { suit: SUIT_MAP[c.suit], value: c.rank };
}

export default function AnimatedLiveTeenPatti({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [isDealing, setIsDealing] = useState(false);
  const [handA, setHandA] = useState<Card[]>([]);
  const [handB, setHandB] = useState<Card[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handlePlay = async () => {
    if (isDealing || betAmount > balance) return;
    setIsDealing(true);
    setResultMessage(null);

    try {
      // Server deals both hands, evaluates them, and settles at 1:1
      // (push on a tie) — you're always betting on your own hand.
      const data = await api.teenPattiPlay(betAmount);

      setTimeout(async () => {
        setHandA(data.playerHand.map(toCard));
        setHandB(data.dealerHand.map(toCard));
        setIsDealing(false);

        if (data.outcome === 'player_won') setResultMessage('YOU WIN THE SHOWDOWN!');
        else if (data.outcome === 'push') setResultMessage('PUSH! Bet Returned.');
        else setResultMessage('DEALER WINS THE SHOWDOWN.');

        await refreshBalance();
      }, 1200);
    } catch {
      setIsDealing(false);
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
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">YOUR HAND</h3>
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
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">DEALER</h3>
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
        <p className="text-xs text-white/50 text-center">You vs Dealer — 1:1 payout, push on a tie.</p>

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
