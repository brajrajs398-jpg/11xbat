// Visual skin system for Roulette.
// Each skin is a pure presentation theme — none of these affect bet types,
// odds, or the server-authoritative outcome from /api/games/roulette/bet.
// A `skin` id lives on each CatalogGame entry (see gamesCatalog.ts) and is
// resolved to one of these configs by getRouletteSkin().

export type RouletteSkinId =
  | 'neon-cyberpunk'
  | 'vegas-classic'
  | 'gold-vip'
  | 'indian-royal'
  | 'minimalist';

export const DEFAULT_ROULETTE_SKIN: RouletteSkinId = 'vegas-classic';

interface BtnStyle {
  active: string;
  idle: string;
}

export interface RouletteSkinConfig {
  id: RouletteSkinId;
  label: string;
  tagline: string;

  // Stage (wheel area)
  stageBg: string;
  stageOverlay: string;
  wheelRing: string;
  wheelRim: string;
  hubGradient: string;
  hubBorder: string;
  hubText: string;
  pointer: string;

  // Recent-outcome chips + number-picker swatches (same color language)
  chipZero: string;
  chipRed: string;
  chipBlack: string;
  chipZeroIdle: string;
  chipRedIdle: string;
  chipBlackIdle: string;
  historyActive: string;

  // Betting panel
  panelBg: string;
  panelBorder: string;
  heading: string;
  redBtn: BtnStyle;
  blackBtn: BtnStyle;
  amberBtn: BtnStyle;
  cyanBtn: BtnStyle;
  actionBtn: string;
  winBanner: string;
  loseBanner: string;

  // Small interaction-pattern variance (not just a coat of paint)
  numberLayout: 'wrap' | 'row-scroll';
  motif: 'gem' | 'lattice' | 'none';
}

export const ROULETTE_SKINS: Record<RouletteSkinId, RouletteSkinConfig> = {
  'neon-cyberpunk': {
    id: 'neon-cyberpunk',
    label: 'Neon Cyberpunk',
    tagline: 'Night City Table',
    stageBg: 'bg-gradient-to-b from-[#0d0221] via-[#1a0b3d] to-[#050110]',
    stageOverlay:
      'bg-[radial-gradient(circle_at_50%_15%,rgba(217,70,239,0.25),transparent_55%),radial-gradient(circle_at_50%_85%,rgba(34,211,238,0.15),transparent_60%)]',
    wheelRing: 'border-[10px] border-fuchsia-500/50 shadow-[0_0_45px_rgba(217,70,239,0.45)]',
    wheelRim: 'border-4 border-cyan-400/40',
    hubGradient: 'bg-gradient-to-tr from-fuchsia-600 via-purple-500 to-cyan-400',
    hubBorder: 'border-4 border-fuchsia-300',
    hubText: 'text-white',
    pointer: 'border-t-cyan-300',
    chipZero: 'bg-cyan-500 text-black border-cyan-300',
    chipRed: 'bg-fuchsia-600 text-white border-fuchsia-300',
    chipBlack: 'bg-[#12071f] text-cyan-200 border-cyan-900',
    chipZeroIdle: 'bg-cyan-950/40 text-cyan-300 border-cyan-900 hover:bg-cyan-900/40',
    chipRedIdle: 'bg-fuchsia-950/40 text-fuchsia-300 border-fuchsia-900 hover:bg-fuchsia-900/40',
    chipBlackIdle: 'bg-[#0d0221] text-purple-300 border-purple-900 hover:bg-[#150836]',
    historyActive: 'ring-2 ring-cyan-300',
    panelBg: 'bg-[#0d0221]',
    panelBorder: 'border-fuchsia-500/20',
    heading: 'text-fuchsia-300/80',
    redBtn: {
      active: 'bg-fuchsia-600 text-white border-fuchsia-300 shadow-[0_0_16px_rgba(217,70,239,0.6)]',
      idle: 'bg-fuchsia-950/40 text-fuchsia-300 border-fuchsia-800/50 hover:bg-fuchsia-900/40',
    },
    blackBtn: {
      active: 'bg-[#1a0b3d] text-cyan-200 border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.4)]',
      idle: 'bg-[#0d0221] text-cyan-300/70 border-cyan-900 hover:bg-[#150836]',
    },
    amberBtn: {
      active: 'bg-cyan-400 text-black border-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.6)]',
      idle: 'bg-cyan-950/30 text-cyan-300 border-cyan-900/40 hover:bg-cyan-900/40',
    },
    cyanBtn: {
      active: 'bg-purple-500 text-white border-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.6)]',
      idle: 'bg-purple-950/30 text-purple-300 border-purple-900/40 hover:bg-purple-900/40',
    },
    actionBtn:
      'bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-400 text-white shadow-[0_0_24px_rgba(217,70,239,0.5)]',
    winBanner: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200',
    loseBanner: 'bg-fuchsia-600/20 border-fuchsia-400/40 text-fuchsia-200',
    numberLayout: 'row-scroll',
    motif: 'none',
  },

  'vegas-classic': {
    id: 'vegas-classic',
    label: 'Vegas Classic',
    tagline: 'Green Felt Table',
    stageBg: 'bg-gradient-to-b from-emerald-950 via-emerald-900 to-[#052014]',
    stageOverlay: 'bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.15),transparent_60%)]',
    wheelRing: 'border-[10px] border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.2)]',
    wheelRim: 'border-4 border-amber-300/30',
    hubGradient: 'bg-gradient-to-tr from-amber-700 via-amber-400 to-yellow-200',
    hubBorder: 'border-4 border-amber-900',
    hubText: 'text-amber-950',
    pointer: 'border-t-amber-300',
    chipZero: 'bg-emerald-600 text-white border-emerald-400',
    chipRed: 'bg-red-600 text-white border-red-400',
    chipBlack: 'bg-zinc-900 text-white border-zinc-700',
    chipZeroIdle: 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900',
    chipRedIdle: 'bg-red-950 text-red-300 border-red-900 hover:bg-red-900',
    chipBlackIdle: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800',
    historyActive: 'ring-2 ring-amber-400',
    panelBg: 'bg-[#171717]',
    panelBorder: 'border-white/10',
    heading: 'text-white/50',
    redBtn: {
      active: 'bg-red-600 text-white border-red-400 shadow-[0_0_12px_rgba(220,38,38,0.5)]',
      idle: 'bg-red-950/40 text-red-300 border-red-900/50 hover:bg-red-900/40',
    },
    blackBtn: {
      active: 'bg-zinc-800 text-white border-zinc-500 shadow-[0_0_12px_rgba(255,255,255,0.2)]',
      idle: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800',
    },
    amberBtn: {
      active: 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]',
      idle: 'bg-amber-950/30 text-amber-300 border-amber-900/40 hover:bg-amber-900/40',
    },
    cyanBtn: {
      active: 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.5)]',
      idle: 'bg-cyan-950/30 text-cyan-300 border-cyan-900/40 hover:bg-cyan-900/40',
    },
    actionBtn: 'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-black',
    winBanner: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
    loseBanner: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
    numberLayout: 'wrap',
    motif: 'none',
  },

  'gold-vip': {
    id: 'gold-vip',
    label: 'Gold VIP',
    tagline: 'High Roller Room',
    stageBg: 'bg-gradient-to-b from-black via-[#1a1409] to-black',
    stageOverlay: 'bg-[radial-gradient(circle_at_50%_15%,rgba(250,204,21,0.18),transparent_55%)]',
    wheelRing: 'border-[10px] border-yellow-400/60 shadow-[0_0_55px_rgba(250,204,21,0.35)]',
    wheelRim: 'border-4 border-yellow-200/40',
    hubGradient: 'bg-gradient-to-tr from-yellow-600 via-yellow-300 to-amber-100',
    hubBorder: 'border-4 border-yellow-900',
    hubText: 'text-yellow-950',
    pointer: 'border-t-yellow-200',
    chipZero: 'bg-yellow-500 text-black border-yellow-200',
    chipRed: 'bg-red-700 text-yellow-100 border-red-400',
    chipBlack: 'bg-black text-yellow-200 border-yellow-900',
    chipZeroIdle: 'bg-yellow-950/40 text-yellow-300 border-yellow-900 hover:bg-yellow-900/40',
    chipRedIdle: 'bg-red-950/50 text-red-300 border-red-900/60 hover:bg-red-900/40',
    chipBlackIdle: 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900',
    historyActive: 'ring-2 ring-yellow-300',
    panelBg: 'bg-black',
    panelBorder: 'border-yellow-500/20',
    heading: 'text-yellow-300/70',
    redBtn: {
      active: 'bg-red-700 text-yellow-100 border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.4)]',
      idle: 'bg-red-950/50 text-red-300 border-red-900/60 hover:bg-red-900/40',
    },
    blackBtn: {
      active: 'bg-black text-yellow-200 border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.4)]',
      idle: 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900',
    },
    amberBtn: {
      active: 'bg-yellow-400 text-black border-yellow-100 shadow-[0_0_16px_rgba(250,204,21,0.6)]',
      idle: 'bg-yellow-950/30 text-yellow-300 border-yellow-900/40 hover:bg-yellow-900/40',
    },
    cyanBtn: {
      active: 'bg-yellow-200 text-black border-white shadow-[0_0_16px_rgba(250,204,21,0.6)]',
      idle: 'bg-yellow-950/20 text-yellow-200 border-yellow-900/40 hover:bg-yellow-900/30',
    },
    actionBtn: 'bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-500 text-black',
    winBanner: 'bg-yellow-500/20 border-yellow-400/40 text-yellow-200',
    loseBanner: 'bg-red-700/20 border-red-500/40 text-red-300',
    numberLayout: 'wrap',
    motif: 'gem',
  },

  'indian-royal': {
    id: 'indian-royal',
    label: 'Indian Royal',
    tagline: 'Rajwada Table',
    stageBg: 'bg-gradient-to-b from-[#3f0d12] via-[#5c1018] to-[#26080b]',
    stageOverlay: 'bg-[radial-gradient(circle_at_50%_15%,rgba(217,119,6,0.2),transparent_55%)]',
    wheelRing: 'border-[10px] border-orange-400/50 shadow-[0_0_45px_rgba(217,119,6,0.3)]',
    wheelRim: 'border-4 border-yellow-500/40',
    hubGradient: 'bg-gradient-to-tr from-emerald-700 via-yellow-400 to-orange-300',
    hubBorder: 'border-4 border-yellow-800',
    hubText: 'text-emerald-950',
    pointer: 'border-t-yellow-300',
    chipZero: 'bg-emerald-600 text-white border-emerald-300',
    chipRed: 'bg-red-800 text-yellow-100 border-red-400',
    chipBlack: 'bg-[#1f0508] text-orange-200 border-orange-900',
    chipZeroIdle: 'bg-emerald-950/50 text-emerald-300 border-emerald-800 hover:bg-emerald-900/40',
    chipRedIdle: 'bg-red-950/50 text-red-300 border-red-900/60 hover:bg-red-900/40',
    chipBlackIdle: 'bg-[#1a0406] text-orange-300/70 border-orange-950 hover:bg-[#2a0709]',
    historyActive: 'ring-2 ring-yellow-400',
    panelBg: 'bg-[#26080b]',
    panelBorder: 'border-orange-500/20',
    heading: 'text-orange-300/80',
    redBtn: {
      active: 'bg-red-800 text-yellow-100 border-yellow-400 shadow-[0_0_14px_rgba(217,119,6,0.4)]',
      idle: 'bg-red-950/50 text-red-300 border-red-900/60 hover:bg-red-900/40',
    },
    blackBtn: {
      active: 'bg-[#1f0508] text-orange-200 border-orange-400 shadow-[0_0_14px_rgba(217,119,6,0.4)]',
      idle: 'bg-[#1a0406] text-orange-300/70 border-orange-950 hover:bg-[#2a0709]',
    },
    amberBtn: {
      active: 'bg-yellow-500 text-black border-yellow-200 shadow-[0_0_14px_rgba(234,179,8,0.5)]',
      idle: 'bg-yellow-950/30 text-yellow-300 border-yellow-900/40 hover:bg-yellow-900/40',
    },
    cyanBtn: {
      active: 'bg-emerald-500 text-black border-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.5)]',
      idle: 'bg-emerald-950/30 text-emerald-300 border-emerald-900/40 hover:bg-emerald-900/40',
    },
    actionBtn: 'bg-gradient-to-r from-orange-500 via-yellow-400 to-emerald-500 text-black',
    winBanner: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200',
    loseBanner: 'bg-red-700/20 border-red-500/40 text-red-200',
    numberLayout: 'wrap',
    motif: 'lattice',
  },

  minimalist: {
    id: 'minimalist',
    label: 'Minimalist',
    tagline: 'Studio Table',
    stageBg: 'bg-gradient-to-b from-zinc-100 via-white to-zinc-50',
    stageOverlay: '',
    wheelRing: 'border-[6px] border-zinc-200',
    wheelRim: 'border-2 border-zinc-300',
    hubGradient: 'bg-indigo-600',
    hubBorder: 'border-4 border-white',
    hubText: 'text-white',
    pointer: 'border-t-indigo-600',
    chipZero: 'bg-indigo-600 text-white border-indigo-400',
    chipRed: 'bg-zinc-800 text-white border-zinc-600',
    chipBlack: 'bg-white text-zinc-700 border-zinc-300',
    chipZeroIdle: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100',
    chipRedIdle: 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50',
    chipBlackIdle: 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100',
    historyActive: 'ring-2 ring-indigo-500',
    panelBg: 'bg-white',
    panelBorder: 'border-zinc-200',
    heading: 'text-zinc-500',
    redBtn: {
      active: 'bg-zinc-900 text-white border-zinc-900',
      idle: 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50',
    },
    blackBtn: {
      active: 'bg-zinc-200 text-zinc-900 border-zinc-300',
      idle: 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50',
    },
    amberBtn: {
      active: 'bg-indigo-600 text-white border-indigo-600',
      idle: 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50',
    },
    cyanBtn: {
      active: 'bg-indigo-100 text-indigo-700 border-indigo-400',
      idle: 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50',
    },
    actionBtn: 'bg-indigo-600 text-white',
    winBanner: 'bg-emerald-50 border-emerald-300 text-emerald-700',
    loseBanner: 'bg-zinc-100 border-zinc-300 text-zinc-600',
    numberLayout: 'wrap',
    motif: 'none',
  },
};

export function getRouletteSkin(skinId?: string | null): RouletteSkinConfig {
  if (skinId && skinId in ROULETTE_SKINS) {
    return ROULETTE_SKINS[skinId as RouletteSkinId];
  }
  return ROULETTE_SKINS[DEFAULT_ROULETTE_SKIN];
}
