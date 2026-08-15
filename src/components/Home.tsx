import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Grid3X3, Play, Search, ShieldCheck, Sparkles, Trophy, Users, WalletCards } from 'lucide-react';
import { fullGamesCatalog, type CatalogGame } from '@/data/gamesCatalog';
import type { Page } from '@/components/Layout';

type Props = {
  onNavigate: (page: Page) => void;
  onSelectGame?: (game: CatalogGame) => void;
  defaultCategory?: 'all' | 'live' | 'slots';
};

const ITEMS_PER_PAGE = 30;

const LIVE_SUBCATEGORIES = [
  'All',
  'Roulette',
  'Blackjack',
  'Baccarat',
  'Teen Patti & Andar Bahar',
  'Game Shows & Wheel',
  'Poker & Card Games',
  'Dice & Sic Bo',
];

const SLOTS_SUBCATEGORIES = [
  'All',
  'Fruit',
  'Egyptian & Magic',
  'Gold & Gems',
  'Animals & Nature',
  'Classic 777',
  'Popular',
];

export default function Home({ onNavigate, onSelectGame, defaultCategory = 'all' }: Props) {
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'slots'>(defaultCategory);

  React.useEffect(() => {
    setActiveTab(defaultCategory);
    setSubFilter('All');
    setCurrentPage(1);
  }, [defaultCategory]);
  const [subFilter, setSubFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const subCategories = useMemo(() => {
    if (activeTab === 'live') return LIVE_SUBCATEGORIES;
    if (activeTab === 'slots') return SLOTS_SUBCATEGORIES;
    return ['All', 'Live Casino', 'Slots'];
  }, [activeTab]);

  const providersList = useMemo(() => {
    const set = new Set<string>();
    fullGamesCatalog.forEach((g) => set.add(g.provider));
    return ['All', ...Array.from(set).sort()];
  }, []);

  const filteredGames = useMemo(() => {
    return fullGamesCatalog.filter((game) => {
      // Tab filter
      if (activeTab === 'live' && game.category !== 'live') return false;
      if (activeTab === 'slots' && game.category !== 'slots') return false;

      // Subfilter
      if (subFilter !== 'All') {
        if (activeTab === 'all') {
          if (subFilter === 'Live Casino' && game.category !== 'live') return false;
          if (subFilter === 'Slots' && game.category !== 'slots') return false;
        } else {
          if (game.subCategory !== subFilter) return false;
        }
      }

      // Provider
      if (providerFilter !== 'All' && game.provider !== providerFilter) return false;

      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchName = game.name.toLowerCase().includes(q);
        const matchProvider = game.provider.toLowerCase().includes(q);
        if (!matchName && !matchProvider) return false;
      }

      return true;
    });
  }, [activeTab, subFilter, providerFilter, searchQuery]);

  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE) || 1;

  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGames.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGames, currentPage]);

  const handleTabChange = (tab: 'all' | 'live' | 'slots') => {
    setActiveTab(tab);
    setSubFilter('All');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Banner / Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-[#1f130b] via-[#140e0b] to-[#2b160e] p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full border-[20px] border-amber-400/10 pointer-events-none" />

        <div className="relative max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> SPINJEET365 OFFICIAL CATALOG
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white italic leading-tight">
            2,892 LIVE CASINO & SLOT GAMES
          </h1>
          <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-xl">
            Play 657 Live Casino tables (Roulette, Blackjack, Baccarat, Teen Patti, Game Shows) and 2,235 Slot machines with instant animated game engines and virtual balance.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => handleTabChange('live')}
              className="px-5 py-3 rounded-xl bg-amber-400 text-black font-black uppercase text-xs tracking-wider shadow-lg hover:bg-amber-300 transition flex items-center gap-2"
            >
              <Flame className="w-4 h-4 fill-black" /> Explore Live Casino (657)
            </button>
            <button
              onClick={() => handleTabChange('slots')}
              className="px-5 py-3 rounded-xl bg-purple-600 text-white font-black uppercase text-xs tracking-wider shadow-lg hover:bg-purple-500 transition flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" /> Explore Slots (2,235)
            </button>
          </div>
        </div>
      </section>

      {/* Highlights Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: WalletCards, title: 'Virtual Balance', text: '1,000 Coins starting balance' },
          { icon: ShieldCheck, title: 'Provably Fair', text: 'Realistic RNG & Physics engines' },
          { icon: Users, title: '2,892 Titles', text: 'Complete Spinjeet365 catalog' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#121624] px-4 py-3 shadow-md">
            <Icon className="h-6 w-6 text-amber-300" />
            <div>
              <p className="text-xs font-bold text-white">{title}</p>
              <p className="text-[11px] text-white/50">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Primary Category Tabs & Search Bar */}
      <section className="space-y-4 border-b border-white/10 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Main Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => handleTabChange('all')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition ${
                activeTab === 'all'
                  ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                  : 'bg-[#121624] text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <Grid3X3 className="w-4 h-4" /> All Games (2,892)
            </button>
            <button
              onClick={() => handleTabChange('live')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition ${
                activeTab === 'live'
                  ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                  : 'bg-[#121624] text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-400" /> Live Casino (657)
            </button>
            <button
              onClick={() => handleTabChange('slots')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition ${
                activeTab === 'slots'
                  ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                  : 'bg-[#121624] text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <Trophy className="w-4 h-4 text-purple-400" /> Slots (2,235)
            </button>
          </div>

          {/* Search & Provider Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#121624] px-3 py-2 text-white/40 focus-within:border-amber-400/60 w-full md:w-64">
              <Search className="h-4 w-4" />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search 2,892 games..."
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/30"
              />
            </div>

            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#121624] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white/80 outline-none focus:border-amber-400"
            >
              <option value="All">All Providers</option>
              {providersList.filter((p) => p !== 'All').map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1">
          <span className="text-[10px] font-extrabold uppercase text-white/40 tracking-wider mr-1">Filter:</span>
          {subCategories.map((sc) => (
            <button
              key={sc}
              onClick={() => {
                setSubFilter(sc);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                subFilter === sc
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                  : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
              }`}
            >
              {sc}
            </button>
          ))}
        </div>
      </section>

      {/* Games Grid Catalog */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Catalog Results</p>
            <h2 className="text-xl font-black text-white">
              Showing {filteredGames.length.toLocaleString()} Games
            </h2>
          </div>
          <span className="text-xs text-white/40 font-bold">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        {paginatedGames.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {paginatedGames.map((game) => (
              <button
                key={game.id}
                onClick={() => {
                  if (onSelectGame) onSelectGame(game);
                  else onNavigate(game.id);
                }}
                className="group overflow-hidden rounded-xl border border-white/10 bg-[#121624] text-left transition duration-200 hover:-translate-y-1 hover:border-amber-400/60 hover:shadow-[0_12px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between"
              >
                {/* Artwork */}
                <div className={`relative aspect-[1.6/1] overflow-hidden rounded-t-xl bg-gradient-to-br ${game.accent} p-3 flex flex-col justify-between`}>
                  <div className="flex items-center justify-between text-[9px] font-black uppercase text-white/90">
                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10">{game.category}</span>
                    {game.label && (
                      <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded font-black">{game.label}</span>
                    )}
                  </div>

                  <div className="my-auto text-center">
                    <span className="text-xl font-black italic tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {game.icon}
                    </span>
                  </div>

                  <div className="text-[9px] text-white/70 font-extrabold truncate">{game.subCategory}</div>
                </div>

                {/* Info & Play Button */}
                <div className="p-3 bg-[#121624] flex items-center justify-between gap-2">
                  <div className="truncate">
                    <p className="truncate text-xs font-bold text-white group-hover:text-amber-300">{game.name}</p>
                    <p className="truncate text-[10px] text-white/40">{game.provider}</p>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-amber-400 text-black flex items-center justify-center shrink-0 shadow opacity-90 group-hover:opacity-100 group-hover:scale-105 transition">
                    <Play className="w-3.5 h-3.5 fill-black" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-sm text-white/40">
            No games found matching your filters.
          </div>
        )}
      </section>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="p-2.5 rounded-xl border border-white/10 bg-[#121624] text-white disabled:opacity-30 hover:bg-white/5 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-black text-white/80">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-2.5 rounded-xl border border-white/10 bg-[#121624] text-white disabled:opacity-30 hover:bg-white/5 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
