import React from 'react';
import { History, Home as HomeIcon, Trophy, Sparkles, Flame } from 'lucide-react';

export type Page =
  | 'home'
  | 'live'
  | 'slots'
  | 'crash'
  | 'dice'
  | 'plinko'
  | 'mines'
  | 'wheel'
  | 'coinflip'
  | 'history'
  | string; // catalog game ids e.g. live_1, slot_42

type LayoutProps = {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
};

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      {/* Header Bar */}
      <header className="sticky top-0 z-50 bg-[#121624]/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => onNavigate('home')} className="flex items-center gap-2 group text-left">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.4)] group-hover:scale-105 transition">
              <Sparkles className="w-5 h-5 text-black fill-black" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white italic">
                SPIN<span className="text-amber-400">JEET</span>365
              </span>
              <p className="text-[9px] font-bold text-amber-300/80 uppercase tracking-widest -mt-1">
                2,892 LIVE & SLOTS
              </p>
            </div>
          </button>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onNavigate('home')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold uppercase transition ${
                currentPage === 'home' ? 'bg-amber-400 text-black shadow-md' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <HomeIcon className="w-4 h-4" /> <span className="hidden sm:inline">Lobby</span>
            </button>

            <button
              onClick={() => onNavigate('live')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold uppercase transition ${
                currentPage === 'live' ? 'bg-amber-400 text-black shadow-md' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-400" /> <span>Live Casino</span>
            </button>

            <button
              onClick={() => onNavigate('slots')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold uppercase transition ${
                currentPage === 'slots' ? 'bg-amber-400 text-black shadow-md' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Trophy className="w-4 h-4 text-purple-400" /> <span>Slots</span>
            </button>

            <button
              onClick={() => onNavigate('history')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold uppercase transition ${
                currentPage === 'history' ? 'bg-amber-400 text-black shadow-md' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <History className="w-4 h-4" /> <span className="hidden sm:inline">History</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0d111c] py-6 px-4 text-center text-xs text-white/40">
        <p className="font-bold text-white/60">SPINJEET365 — Premium Live Casino & Slots Platform</p>
        <p className="mt-1">All 2,892 Games operational with Virtual Balance & Fair Play Engine.</p>
      </footer>
    </div>
  );
}
