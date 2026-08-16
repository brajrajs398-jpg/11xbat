import React, { useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { useBalance } from '@/lib/useBalance';
import BetControls from '@/components/BetControls';
import type { CatalogGame } from '@/data/gamesCatalog';

type Card = {
  suit: '♠' | '♥' | '♦' | '♣';
  value: string;
  weight: number;
};

const SUITS: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function getRandomCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const valIndex = Math.floor(Math.random() * VALUES.length);
  const val = VALUES[valIndex];
  let weight = valIndex + 2;
  if (['J', 'Q', 'K'].includes(val)) weight = 10;
  if (val === 'A') weight = 11;
  return { suit, value: val, weight };
}

function calculateHandScore(hand: Card[]): number {
  let score = hand.reduce((acc, c) => acc + c.weight, 0);
  let aces = hand.filter((c) => c.value === 'A').length;
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

export default function AnimatedLiveBlackjack({ game, onBack }: { game: CatalogGame; onBack: () => void }) {
  const { balance, updateBalance, addHistory } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [gameState, setGameState] = useState<'betting' | 'playing' | 'dealer_turn' | 'ended'>('betting');
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const startDeal = () => {
    if (betAmount > balance) return;
    updateBalance(-betAmount);

    const p1 = getRandomCard();
    const d1 = getRandomCard();
    const p2 = getRandomCard();
    const d2 = getRandomCard();

    const pHand = [p1, p2];
    const dHand = [d1, d2];

    setPlayerHand(pHand);
    setDealerHand(dHand);
    setResultMessage(null);

    const pScore = calculateHandScore(pHand);
    if (pScore === 21) {
      const winAmount = betAmount * 2.5;
      updateBalance(winAmount);
      setResultMessage('BLACKJACK! YOU WIN 2.5x!');
      setGameState('ended');
      addHistory({ game: game.name, bet: betAmount, profit: winAmount - betAmount, result: 'win', multiplier: 2.5 });
    } else {
      setGameState('playing');
    }
  };

  const handleHit = () => {
    if (gameState !== 'playing') return;
    const newCard = getRandomCard();
    const updated = [...playerHand, newCard];
    setPlayerHand(updated);

    const score = calculateHandScore(updated);
    if (score > 21) {
      setResultMessage('BUST! Dealer Wins.');
      setGameState('ended');
      addHistory({ game: game.name, bet: betAmount, profit: -betAmount, result: 'loss', multiplier: 0 });
    }
  };

  const handleStand = () => {
    if (gameState !== 'playing') return;
    setGameState('dealer_turn');

    let currentDealer = [...dealerHand];
    let dScore = calculateHandScore(currentDealer);

    const interval = setInterval(() => {
      if (dScore < 17) {
        const nextCard = getRandomCard();
        currentDealer = [...currentDealer, nextCard];
        dScore = calculateHandScore(currentDealer);
        setDealerHand(currentDealer);
      } else {
        clearInterval(interval);
        const pScore = calculateHandScore(playerHand);

        let isWin = false;
        let isPush = false;
        let mult = 0;

        if (dScore > 21 || pScore > dScore) {
          isWin = true;
          mult = 2;
        } else if (pScore === dScore) {
          isPush = true;
          mult = 1;
        }

        const winAmount = betAmount * mult;
        if (winAmount > 0) updateBalance(winAmount);

        if (isWin) setResultMessage(`YOU WIN! Dealer Score: ${dScore}`);
        else if (isPush) setResultMessage('PUSH! Bet Returned.');
        else setResultMessage(`DEALER WINS (${dScore} vs ${pScore})`);

        setGameState('ended');
        addHistory({
          game: game.name,
          bet: betAmount,
          profit: winAmount - betAmount,
          result: isWin ? 'win' : isPush ? 'draw' : 'loss',
          multiplier: mult,
        });
      }
    }, 600);
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
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-sky-400/20 text-sky-300 border border-sky-400/30">
                LIVE TABLE
              </span>
            </div>
            <p className="text-xs text-white/40">{game.provider} • Dealer Stands on 17</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase font-bold">Balance</p>
          <p className="text-sm font-black text-amber-300">{balance.toLocaleString()} Coins</p>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-2xl border-4 border-amber-900/60 bg-gradient-to-b ${game.accent} p-6 shadow-2xl min-h-[360px] flex flex-col justify-between`}>
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-white/70 text-xs font-bold">
            <span>DEALER</span>
            {gameState !== 'betting' && (
              <span className="text-amber-300 font-black">
                ({gameState === 'playing' ? dealerHand[0]?.weight || 0 : calculateHandScore(dealerHand)})
              </span>
            )}
          </div>

          <div className="flex justify-center gap-3 min-h-[90px] items-center">
            {dealerHand.map((card, idx) => {
              const hideCard = gameState === 'playing' && idx === 1;
              return (
                <div
                  key={idx}
                  className={`w-16 h-24 rounded-lg border-2 flex flex-col justify-between p-2 shadow-xl transform transition-transform duration-300 hover:scale-105 ${
                    hideCard
                      ? 'bg-gradient-to-br from-amber-700 to-amber-900 border-amber-500'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {hideCard ? (
                    <div className="h-full flex items-center justify-center font-black text-amber-300 text-xs uppercase">
                      VIP
                    </div>
                  ) : (
                    <>
                      <span className={`text-xs font-black ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
                        {card.value}{card.suit}
                      </span>
                      <span className={`text-2xl text-center font-bold ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
                        {card.suit}
                      </span>
                      <span className={`text-xs font-black text-right ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
                        {card.value}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {resultMessage && (
          <div className="text-center my-2 animate-pulse">
            <span className="px-6 py-2 rounded-xl bg-black/80 border border-amber-400 text-amber-300 font-black text-sm tracking-wide shadow-2xl">
              {resultMessage}
            </span>
          </div>
        )}

        <div className="text-center space-y-2">
          <div className="flex justify-center gap-3 min-h-[90px] items-center">
            {playerHand.map((card, idx) => (
              <div
                key={idx}
                className="w-16 h-24 bg-white rounded-lg border-2 border-slate-300 text-slate-900 flex flex-col justify-between p-2 shadow-xl transform transition-all duration-300 animate-fade-in"
              >
                <span className={`text-xs font-black ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
                  {card.value}{card.suit}
                </span>
                <span className={`text-2xl text-center font-bold ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
                  {card.suit}
                </span>
                <span className={`text-xs font-black text-right ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
                  {card.value}
                </span>
              </div>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-white/70 text-xs font-bold">
            <span>YOU</span>
            {playerHand.length > 0 && (
              <span className="text-amber-300 font-black">({calculateHandScore(playerHand)})</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#171717] border border-white/10 rounded-xl p-5 space-y-4">
        {gameState === 'betting' || gameState === 'ended' ? (
          <>
            <BetControls betAmount={betAmount} onBetChange={setBetAmount} />
            <button
              onClick={startDeal}
              disabled={betAmount > balance}
              className="w-full py-3.5 rounded-xl bg-amber-400 text-black font-black uppercase text-sm shadow-lg hover:bg-amber-300 transition flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-black" /> Deal Hand
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleHit}
              disabled={gameState !== 'playing'}
              className="py-3.5 rounded-xl bg-emerald-500 text-white font-black uppercase text-sm hover:bg-emerald-400 transition"
            >
              Hit (+ Card)
            </button>
            <button
              onClick={handleStand}
              disabled={gameState !== 'playing'}
              className="py-3.5 rounded-xl bg-sky-500 text-white font-black uppercase text-sm hover:bg-sky-400 transition"
            >
              Stand
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
