import { type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Page } from '@/components/Layout';

type GameShellProps = {
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
  controls: ReactNode;
  currentPage: Page;
};

export default function GameShell({ title, description, onBack, children, controls }: GameShellProps) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to lobby
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#131826] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-1">{title}</h2>
          <p className="text-sm text-gray-400 mb-4">{description}</p>
          {children}
        </div>
        <div className="bg-[#131826] border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Place a Bet</h3>
          {controls}
        </div>
      </div>
    </div>
  );
}
