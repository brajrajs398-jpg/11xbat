import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type BetControlsProps = {
  onPlay?: (betAmount: number) => Promise<void>;
  disabled?: boolean;
  playLabel?: string;
  playingLabel?: string;
  isPlaying?: boolean;
  children?: ReactNode;
  betAmount: number;
  setBetAmount?: (n: number) => void;
  onBetChange?: (n: number) => void;
  quickAmounts?: number[];
};

export default function BetControls({
  onPlay,
  disabled,
  playLabel,
  playingLabel,
  isPlaying,
  children,
  betAmount,
  setBetAmount,
  onBetChange,
  quickAmounts = [10, 50, 100, 500],
}: BetControlsProps) {
  const handleChange = (n: number) => {
    if (setBetAmount) setBetAmount(n);
    else if (onBetChange) onBetChange(n);
  };
  const [loading, setLoading] = useState(false);

  const handlePlay = async () => {
    if (!onPlay) return;
    setLoading(true);
    await onPlay(betAmount);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Bet Amount</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={betAmount}
            onChange={(e) => handleChange(Math.max(0, parseFloat(e.target.value) || 0))}
            className="flex-1 bg-[#0a0e17] border border-gray-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors tabular-nums"
          />
          <button
            onClick={() => handleChange(Math.floor(betAmount / 2))}
            className="px-3 py-2.5 text-xs font-medium text-gray-400 bg-[#0a0e17] border border-gray-800 rounded-xl hover:text-white hover:border-gray-700 transition-colors"
          >
            ½
          </button>
          <button
            onClick={() => handleChange(betAmount * 2)}
            className="px-3 py-2.5 text-xs font-medium text-gray-400 bg-[#0a0e17] border border-gray-800 rounded-xl hover:text-white hover:border-gray-700 transition-colors"
          >
            2×
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => handleChange(amt)}
              className="flex-1 py-1.5 text-xs font-medium text-gray-400 bg-[#0a0e17] border border-gray-800 rounded-lg hover:text-white hover:border-gray-700 transition-colors"
            >
              {amt}
            </button>
          ))}
        </div>
      </div>

      {children}

      <button
        onClick={handlePlay}
        disabled={disabled || loading || isPlaying || betAmount <= 0 || !onPlay}
        className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium py-3 rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {(loading || isPlaying) && <Loader2 className="w-4 h-4 animate-spin" />}
        {(loading || isPlaying) ? (playingLabel || 'Playing...') : playLabel}
      </button>
    </div>
  );
}
