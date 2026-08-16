const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export type User = { id: string; email: string };
export type Session = { access_token: string };
export type Profile = { id: string; username: string; balance: number; created_at: string };
export type GameHistory = {
  id: string;
  user_id: string;
  game: string;
  bet: number;
  payout: number;
  multiplier: number;
  details: Record<string, unknown>;
  created_at: string;
};

export type AuthResponse = { token: string; user: User; profile: Profile | null };

function token() {
  return localStorage.getItem('playvault_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const t = token();
  if (t) headers.set('Authorization', `Bearer ${t}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

export const api = {
  signUp: (email: string, password: string, username: string) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, username }) }),
  signIn: (email: string, password: string) =>
    request<AuthResponse>('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: User; profile: Profile }>('/auth/me'),
  signOut: () => request<{ ok: true }>('/auth/signout', { method: 'POST' }),
  history: () => request<{ history: GameHistory[] }>('/history'),
  changeBalance: (delta: number, reason: string) =>
    request<{ balance: number }>('/wallet/change', { method: 'POST', body: JSON.stringify({ delta, reason }) }),
  addHistory: (entry: { game: string; bet: number; payout: number; multiplier: number; details: Record<string, unknown> }) =>
    request<{ history: GameHistory }>('/history', { method: 'POST', body: JSON.stringify(entry) }),

  // Server-authoritative game endpoints: outcome + payout are computed on
  // the server, not the client. These replace client-side Math.random()
  // plus a self-reported wallet/change call.
  slotSpin: (betAmount: number, game: string) =>
    request<{ reels: number[]; multiplier: number; payout: number; balance: number }>(
      '/games/slot/spin', { method: 'POST', body: JSON.stringify({ betAmount, game }) },
    ),
  diceRoll: (betAmount: number, target: number, isOver: boolean, game: string) =>
    request<{ result: number; won: boolean; multiplier: number; payout: number; balance: number }>(
      '/games/dice/roll', { method: 'POST', body: JSON.stringify({ betAmount, target, isOver, game }) },
    ),
  plinkoDrop: (betAmount: number, game: string) =>
    request<{ slot: number; multiplier: number; payout: number; balance: number }>(
      '/games/plinko/drop', { method: 'POST', body: JSON.stringify({ betAmount, game }) },
    ),
  wheelSpin: (betAmount: number, game: string) =>
    request<{ winningIndex: number; multiplier: number; payout: number; balance: number }>(
      '/games/wheel/spin', { method: 'POST', body: JSON.stringify({ betAmount, game }) },
    ),
  minesStart: (betAmount: number, mineCount: number, game: string) =>
    request<{ roundId: string; balance: number }>(
      '/games/mines/start', { method: 'POST', body: JSON.stringify({ betAmount, mineCount, game }) },
    ),
  minesReveal: (roundId: string, tileIndex: number) =>
    request<{ busted: boolean; multiplier?: number; revealed?: number[]; minePositions?: number[] }>(
      '/games/mines/reveal', { method: 'POST', body: JSON.stringify({ roundId, tileIndex }) },
    ),
  minesCashout: (roundId: string) =>
    request<{ payout: number; multiplier: number; balance: number }>(
      '/games/mines/cashout', { method: 'POST', body: JSON.stringify({ roundId }) },
    ),
  coinFlipFlip: (betAmount: number, choice: 'heads' | 'tails', game: string) =>
    request<{ outcome: 'heads' | 'tails'; won: boolean; multiplier: number; payout: number; balance: number }>(
      '/games/coinflip/flip', { method: 'POST', body: JSON.stringify({ betAmount, choice, game }) },
    ),
  crashStart: (betAmount: number, game: string) =>
    request<{ roundId: string; startedAt: string; balance: number }>(
      '/games/crash/start', { method: 'POST', body: JSON.stringify({ betAmount, game }) },
    ),
  crashCashout: (roundId: string) =>
    request<{ busted: boolean; settled: boolean; multiplier?: number; payout?: number; crashPoint?: number; balance?: number }>(
      '/games/crash/cashout', { method: 'POST', body: JSON.stringify({ roundId }) },
    ),
  crashStatus: (roundId: string) =>
    request<{ busted: boolean; settled: boolean; multiplier?: number; payout?: number; crashPoint?: number; balance?: number }>(
      `/games/crash/status?roundId=${encodeURIComponent(roundId)}`,
    ),
  limboBet: (betAmount: number, target: number, game: string) =>
    request<{ roll: number; won: boolean; multiplier: number; payout: number; balance: number }>(
      '/games/limbo/bet', { method: 'POST', body: JSON.stringify({ betAmount, target, game }) },
    ),
  kenoDraw: (betAmount: number, picks: number[], game: string) =>
    request<{ drawn: number[]; hits: number; multiplier: number; payout: number; balance: number }>(
      '/games/keno/draw', { method: 'POST', body: JSON.stringify({ betAmount, picks, game }) },
    ),
};

export function saveToken(value: string) {
  localStorage.setItem('playvault_token', value);
}

export function clearToken() {
  localStorage.removeItem('playvault_token');
}

export function hasToken() {
  return Boolean(token());
}
