import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import AuthScreen from '@/components/AuthScreen';
import Layout, { type Page } from '@/components/Layout';
import Home from '@/components/Home';
import HistoryPage from '@/components/HistoryPage';
import CrashGame from '@/components/games/CrashGame';
import DiceGame from '@/components/games/DiceGame';
import PlinkoGame from '@/components/games/PlinkoGame';
import MinesGame from '@/components/games/MinesGame';
import WheelGame from '@/components/games/WheelGame';
import CoinFlipGame from '@/components/games/CoinFlipGame';

import AnimatedLiveRoulette from '@/components/games/AnimatedLiveRoulette';
import AnimatedLiveBlackjack from '@/components/games/AnimatedLiveBlackjack';
import AnimatedLiveBaccarat from '@/components/games/AnimatedLiveBaccarat';
import AnimatedLiveTeenPatti from '@/components/games/AnimatedLiveTeenPatti';
import AnimatedLiveGameShow from '@/components/games/AnimatedLiveGameShow';
import AnimatedLiveDice from '@/components/games/AnimatedLiveDice';
import AnimatedSlotMachine from '@/components/games/AnimatedSlotMachine';

import { fullGamesCatalog, type CatalogGame } from '@/data/gamesCatalog';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState<Page>('home');
  const [selectedCatalogGame, setSelectedCatalogGame] = useState<CatalogGame | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  const goHome = () => {
    setSelectedCatalogGame(null);
    setPage('home');
  };

  const handleSelectGame = (game: CatalogGame) => {
    setSelectedCatalogGame(game);
    setPage(game.id);
  };

  const renderPage = () => {
    // Check if selected game from catalog
    if (selectedCatalogGame && page === selectedCatalogGame.id) {
      switch (selectedCatalogGame.engineType) {
        case 'roulette':
          return <AnimatedLiveRoulette game={selectedCatalogGame} onBack={goHome} />;
        case 'blackjack':
          return <AnimatedLiveBlackjack game={selectedCatalogGame} onBack={goHome} />;
        case 'baccarat':
          return <AnimatedLiveBaccarat game={selectedCatalogGame} onBack={goHome} />;
        case 'teenpatti':
          return <AnimatedLiveTeenPatti game={selectedCatalogGame} onBack={goHome} />;
        case 'gameshow':
          return <AnimatedLiveGameShow game={selectedCatalogGame} onBack={goHome} />;
        case 'dice':
          return <AnimatedLiveDice game={selectedCatalogGame} onBack={goHome} />;
        case 'slot':
          return <AnimatedSlotMachine game={selectedCatalogGame} onBack={goHome} />;
      }
    }

    // Direct page routing
    switch (page) {
      case 'home':
        return <Home onNavigate={setPage} onSelectGame={handleSelectGame} defaultCategory="all" />;
      case 'live':
        return <Home onNavigate={setPage} onSelectGame={handleSelectGame} defaultCategory="live" />;
      case 'slots':
        return <Home onNavigate={setPage} onSelectGame={handleSelectGame} defaultCategory="slots" />;
      case 'crash':
        return <CrashGame onBack={goHome} onNavigate={setPage} />;
      case 'dice':
        return <DiceGame onBack={goHome} onNavigate={setPage} />;
      case 'plinko':
        return <PlinkoGame onBack={goHome} onNavigate={setPage} />;
      case 'mines':
        return <MinesGame onBack={goHome} onNavigate={setPage} />;
      case 'wheel':
        return <WheelGame onBack={goHome} onNavigate={setPage} />;
      case 'coinflip':
        return <CoinFlipGame onBack={goHome} onNavigate={setPage} />;
      case 'history':
        return <HistoryPage />;
      default: {
        // Fallback for catalog game opened by ID
        const found = fullGamesCatalog.find((g) => g.id === page);
        if (found) {
          if (found.engineType === 'roulette') return <AnimatedLiveRoulette game={found} onBack={goHome} />;
          if (found.engineType === 'blackjack') return <AnimatedLiveBlackjack game={found} onBack={goHome} />;
          if (found.engineType === 'baccarat') return <AnimatedLiveBaccarat game={found} onBack={goHome} />;
          if (found.engineType === 'teenpatti') return <AnimatedLiveTeenPatti game={found} onBack={goHome} />;
          if (found.engineType === 'gameshow') return <AnimatedLiveGameShow game={found} onBack={goHome} />;
          if (found.engineType === 'dice') return <AnimatedLiveDice game={found} onBack={goHome} />;
          if (found.engineType === 'slot') return <AnimatedSlotMachine game={found} onBack={goHome} />;
        }
        return <Home onNavigate={setPage} onSelectGame={handleSelectGame} defaultCategory="all" />;
      }
    }
  };

  return (
    <Layout currentPage={page} onNavigate={(p) => {
      setSelectedCatalogGame(null);
      setPage(p);
    }}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
