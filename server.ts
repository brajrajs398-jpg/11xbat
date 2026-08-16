import express from 'express';
import { authMiddleware } from './auth.js';
import {
  slotSpin,
  diceRoll,
  plinkoDrop,
  wheelSpin,
  coinFlipFlip,
  crashStart,
  crashCashout,
  crashStatus,
  limboBet,
  kenoDraw,
  minesStart,
  minesReveal,
  minesCashout,
  hiloStart,
  hiloGuess,
  hiloCashout,
  sicBoPlaceBets,
  roulettePlaceBets,
  blackjackStart,
  blackjackHit,
  blackjackStand,
  blackjackDoubleDown,
  baccaratPlaceBets,
  teenPattiPlay,
  diceTablePlay,
  gameShowPlay,
} from './games.js';

const app = express();
app.use(express.json());

// Existing routes
app.post('/api/games/slot/spin', authMiddleware, slotSpin);
app.post('/api/games/dice/roll', authMiddleware, diceRoll);
app.post('/api/games/plinko/drop', authMiddleware, plinkoDrop);
app.post('/api/games/wheel/spin', authMiddleware, wheelSpin);
app.post('/api/games/coinflip/flip', authMiddleware, coinFlipFlip);
app.post('/api/games/crash/start', authMiddleware, crashStart);
app.post('/api/games/crash/cashout', authMiddleware, crashCashout);
app.get('/api/games/crash/status', authMiddleware, crashStatus);
app.post('/api/games/limbo/bet', authMiddleware, limboBet);
app.post('/api/games/keno/draw', authMiddleware, kenoDraw);
app.post('/api/games/mines/start', authMiddleware, minesStart);
app.post('/api/games/mines/reveal', authMiddleware, minesReveal);
app.post('/api/games/mines/cashout', authMiddleware, minesCashout);
app.post('/api/games/hilo/start', authMiddleware, hiloStart);
app.post('/api/games/hilo/guess', authMiddleware, hiloGuess);
app.post('/api/games/hilo/cashout', authMiddleware, hiloCashout);
app.post('/api/games/sicbo/bet', authMiddleware, sicBoPlaceBets);

// 1. Roulette
app.post('/api/games/roulette/bet', authMiddleware, roulettePlaceBets);

// 2. Blackjack
app.post('/api/games/blackjack/start', authMiddleware, blackjackStart);
app.post('/api/games/blackjack/hit', authMiddleware, blackjackHit);
app.post('/api/games/blackjack/stand', authMiddleware, blackjackStand);
app.post('/api/games/blackjack/double', authMiddleware, blackjackDoubleDown);

// 3. Baccarat
app.post('/api/games/baccarat/bet', authMiddleware, baccaratPlaceBets);

// 4. Teen Patti
app.post('/api/games/teenpatti/play', authMiddleware, teenPattiPlay);

// 5. Dice Table
app.post('/api/games/dicetable/play', authMiddleware, diceTablePlay);

// 6. Game Show
app.post('/api/games/gameshow/play', authMiddleware, gameShowPlay);

export default app;
