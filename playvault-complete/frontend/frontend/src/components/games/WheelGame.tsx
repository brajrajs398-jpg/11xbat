import { useState, useRef } from 'react';
import GameShell from '@/components/GameShell';
import BetControls from '@/components/BetControls';
import { useBalance } from '@/lib/useBalance';
import { api } from '@/lib/api';
import type { Page } from '@/components/Layout';
import type { CatalogGame } from '@/data/gamesCatalog';

type Props = { onBack: () => void; onNavigate?: (p: Page) => void; game?: CatalogGame };

const SEGMENTS = [
  { multiplier: 1.5, color: '#3b82f6' },
  { multiplier: 2, color: '#10b981' },
  { multiplier: 0, color: '#ef4444' },
  { multiplier: 3, color: '#f59e0b' },
  { multiplier: 1.5, color: '#3b82f6' },
  { multiplier: 0, color: '#ef4444' },
  { multiplier: 5, color: '#8b5cf6' },
  { multiplier: 2, color: '#10b981' },
  { multiplier: 0, color: '#ef4444' },
  { multiplier: 1.5, color: '#3b82f6' },
  { multiplier: 10, color: '#ec4899' },
  { multiplier: 0, color: '#ef4444' },
];

export default function WheelGame({ onBack, game }: Props) {
  const { balance, refreshBalance } = useBalance();
  const [betAmount, setBetAmount] = useState(10);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ multiplier: number } | null>(null);
  const wheelRef = useRef<SVGSVGElement>(null);

  const spin = async () => {
    if (balance < betAmount) return;

    let serverResult: { winningIndex: number; multiplier: number } | null = null;
    try {
      serverResult = await api.wheelSpin(betAmount, game?.name ?? 'Wheel');
    } catch {
      return; // insufficient balance or network issue — nothing was deducted
    }

    setSpinning(true);
    setResult(null);

    const segmentAngle = 360 / SEGMENTS.length;
    const winningIndex = serverResult.winningIndex;

    const fullSpins = 5;
    const targetAngle = fullSpins * 360 + (360 - (winningIndex * segmentAngle + segmentAngle / 2));

    const startRotation = rotation;
    const endRotation = startRotation + targetAngle;
    setRotation(endRotation);

    setTimeout(async () => {
      setResult({ multiplier: serverResult!.multiplier });
      await refreshBalance();
      setSpinning(false);
    }, 4000);
  };

  const radius = 140;
  const center = 150;
  const segmentAngle = 360 / SEGMENTS.length;

  const createPath = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <GameShell
      title={game?.name ?? "Wheel"}
      description="Spin the wheel and test your luck for big multipliers!"
      onBack={onBack}
      currentPage="wheel"
      controls={
        <BetControls
          onPlay={spin}
          disabled={balance < betAmount || spinning}
          playLabel="Spin Wheel"
          playingLabel="Spinning..."
          isPlaying={spinning}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
        >
          {result && (
            <div className="text-center py-2 px-3 bg-[#0a0e17] rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400">Last result</p>
              <p className={`text-lg font-bold ${result.multiplier > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.multiplier}× — {(betAmount * result.multiplier).toFixed(2)} coins
              </p>
            </div>
          )}
        </BetControls>
      }
    >
      <div className="flex flex-col items-center justify-center h-80 lg:h-96 relative">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
          <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-white drop-shadow-lg" />
        </div>

        <svg
          ref={wheelRef}
          width="300"
          height="300"
          viewBox="0 0 300 300"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          {SEGMENTS.map((seg, i) => {
            const start = i * segmentAngle;
            const end = (i + 1) * segmentAngle;
            return (
              <g key={i}>
                <path d={createPath(start, end)} fill={seg.color} stroke="#0a0e17" strokeWidth={1} />
                <text
                  x={center + (radius * 0.65) * Math.cos(((start + segmentAngle / 2 - 90) * Math.PI) / 180)}
                  y={center + (radius * 0.65) * Math.sin(((start + segmentAngle / 2 - 90) * Math.PI) / 180)}
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${start + segmentAngle / 2} ${center + (radius * 0.65) * Math.cos(((start + segmentAngle / 2 - 90) * Math.PI) / 180)} ${center + (radius * 0.65) * Math.sin(((start + segmentAngle / 2 - 90) * Math.PI) / 180)})`}
                >
                  {seg.multiplier}×
                </text>
              </g>
            );
          })}
          <circle cx={center} cy={center} r="20" fill="#131826" stroke="#1f2937" strokeWidth="2" />
        </svg>

        {result && !spinning && (
          <p className={`mt-4 text-lg font-bold ${result.multiplier > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {result.multiplier > 0 ? `You won ${(betAmount * result.multiplier).toFixed(2)} coins!` : 'You lost — better luck next time!'}
          </p>
        )}
      </div>
    </GameShell>
  );
}
