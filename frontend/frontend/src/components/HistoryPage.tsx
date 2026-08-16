import { useEffect, useState } from 'react';
import { api, type GameHistory } from '@/lib/api';
import { History as HistoryIcon } from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.history()
      .then(({ history }) => setHistory(history))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const gameColors: Record<string, string> = {
    crash: 'text-emerald-400 bg-emerald-500/10', dice: 'text-cyan-400 bg-cyan-500/10',
    plinko: 'text-amber-400 bg-amber-500/10', mines: 'text-red-400 bg-red-500/10',
    wheel: 'text-violet-400 bg-violet-500/10', coinflip: 'text-yellow-400 bg-yellow-500/10',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#131826] border border-gray-800 flex items-center justify-center"><HistoryIcon className="w-5 h-5 text-emerald-400" /></div>
        <div><h1 className="text-xl font-bold">Game History</h1><p className="text-sm text-gray-400">Your last 50 games</p></div>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : history.length === 0 ? <div className="text-center py-12 text-gray-500"><p>No games played yet. Pick a game and start playing!</p></div> : (
        <div className="bg-[#131826] border border-gray-800 rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide"><th className="text-left px-4 py-3 font-medium">Game</th><th className="text-right px-4 py-3 font-medium">Bet</th><th className="text-right px-4 py-3 font-medium">Multiplier</th><th className="text-right px-4 py-3 font-medium">Payout</th><th className="text-right px-4 py-3 font-medium">Result</th><th className="text-right px-4 py-3 font-medium">Time</th></tr></thead><tbody>
          {history.map((h) => { const profit = h.payout - h.bet; return <tr key={h.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"><td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium capitalize ${gameColors[h.game] || 'text-gray-400 bg-gray-500/10'}`}>{h.game}</span></td><td className="px-4 py-3 text-right tabular-nums text-gray-300">{h.bet.toFixed(2)}</td><td className="px-4 py-3 text-right tabular-nums text-gray-300">{h.multiplier.toFixed(2)}×</td><td className="px-4 py-3 text-right tabular-nums text-gray-300">{h.payout.toFixed(2)}</td><td className={`px-4 py-3 text-right tabular-nums font-medium ${profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{profit >= 0 ? '+' : ''}{profit.toFixed(2)}</td><td className="px-4 py-3 text-right text-gray-500 text-xs">{new Date(h.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>; })}
        </tbody></table></div></div>
      )}
    </div>
  );
}
