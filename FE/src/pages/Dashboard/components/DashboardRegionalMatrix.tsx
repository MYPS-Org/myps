import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MapIcon,
  ChartPieIcon,
  ArrowsPointingOutIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowPathIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useDashboardTheme } from '../DashboardTheme';
import { type WatchlistProject } from './ProjectQuickDetailModal';
import { type IslandAllocation } from './DashboardCharts';

interface Props {
  selectedYear?: number;
  projects?: WatchlistProject[];
  islands?: IslandAllocation[];
  onSelectIsland?: (island: string | null) => void;
  activeIslandFilter?: string | null;
}

interface RegionRow {
  name: string;
  displayName: string;
  island: string;
  subgroup: string;
  amount: number;
  sharePercent: number;
  count: number;
}

interface PieSegment {
  id: string;
  name: string;
  amount: number;
  share: number;
  count: number;
  color: string;
  island?: string;
}

function getDonutPath(cx: number, cy: number, rInner: number, rOuter: number, startAngle: number, endAngle: number): string {
  const diff = endAngle - startAngle;
  if (diff >= 2 * Math.PI - 0.001) {
    return `M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter} M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner} A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner} Z`;
  }
  const x1 = cx + rOuter * Math.cos(startAngle);
  const y1 = cy + rOuter * Math.sin(startAngle);
  const x2 = cx + rOuter * Math.cos(endAngle);
  const y2 = cy + rOuter * Math.sin(endAngle);
  const x3 = cx + rInner * Math.cos(endAngle);
  const y3 = cy + rInner * Math.sin(endAngle);
  const x4 = cx + rInner * Math.cos(startAngle);
  const y4 = cy + rInner * Math.sin(startAngle);
  const largeArc = diff > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

export const DashboardRegionalMatrix: React.FC<Props> = ({
  selectedYear = 2027,
  projects = [],
  islands: _islands = [],
  onSelectIsland,
  activeIslandFilter,
}) => {
  const { isLight } = useDashboardTheme();
  const [viewMode, setViewMode] = useState<'map' | 'pie'>('map');
  const [selectedIslandTab, setSelectedIslandTab] = useState<'All' | 'Luzon' | 'Visayas' | 'Mindanao'>('All');
  
  // Interactive zoom and modal states
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalZoomLevel, setModalZoomLevel] = useState<number>(1);

  // Pie Analytics state
  const [pieSliceType, setPieSliceType] = useState<'island' | 'subgroup' | 'region'>('island');
  const [hoveredPieSegment, setHoveredPieSegment] = useState<PieSegment | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Derive data from projects
  const totalBudget = projects.reduce((sum, p) => sum + p.allocatedBudget, 0);
  const totalBudgetBillion = totalBudget / 1e9;

  // Group projects by Region
  const regionMap = new Map<string, { island: string; amount: number; count: number }>();
  for (const p of projects) {
    const regName = p.region || 'Unassigned';
    const curr = regionMap.get(regName) || { island: p.island || 'Other', amount: 0, count: 0 };
    curr.amount += p.allocatedBudget;
    curr.count += 1;
    curr.island = p.island || curr.island;
    regionMap.set(regName, curr);
  }

  const regionRows: RegionRow[] = Array.from(regionMap.entries()).map(([regName, data]) => {
    const share = totalBudget > 0 ? (data.amount / totalBudget) * 100 : 0;
    let subgroup = data.island;
    if (regName.includes('Ilocos') || regName.includes('Cagayan') || regName.includes('Central Luzon') || regName.includes('CAR')) {
      subgroup = 'Northern Luzon';
    } else if (regName.includes('CALABARZON') || regName.includes('MIMAROPA') || regName.includes('Bicol') || regName.includes('Region IV-B') || regName.includes('Region V')) {
      subgroup = 'Southern Luzon';
    } else if (regName.includes('NCR')) {
      subgroup = 'NCR';
    }

    const shortName = regName.split(' (')[0];

    return {
      name: regName,
      displayName: shortName,
      island: data.island,
      subgroup,
      amount: data.amount,
      sharePercent: share,
      count: data.count,
    };
  });

  const luzonProjects = projects.filter((p) => p.island === 'Luzon');
  const visayasProjects = projects.filter((p) => p.island === 'Visayas');
  const mindanaoProjects = projects.filter((p) => p.island === 'Mindanao');

  const luzonTotal = luzonProjects.reduce((sum, p) => sum + p.allocatedBudget, 0) / 1e9;
  const visayasTotal = visayasProjects.reduce((sum, p) => sum + p.allocatedBudget, 0) / 1e9;
  const mindanaoTotal = mindanaoProjects.reduce((sum, p) => sum + p.allocatedBudget, 0) / 1e9;

  const luzonShare = totalBudgetBillion > 0 ? (luzonTotal / totalBudgetBillion) * 100 : 0;
  const visayasShare = totalBudgetBillion > 0 ? (visayasTotal / totalBudgetBillion) * 100 : 0;
  const mindanaoShare = totalBudgetBillion > 0 ? (mindanaoTotal / totalBudgetBillion) * 100 : 0;

  const northernLuzon = regionRows.filter((r) => r.subgroup === 'Northern Luzon');
  const southernLuzon = regionRows.filter((r) => r.subgroup === 'Southern Luzon');
  const ncr = regionRows.find((r) => r.subgroup === 'NCR');
  const visayasList = regionRows.filter((r) => r.island === 'Visayas');
  const mindanaoList = regionRows.filter((r) => r.island === 'Mindanao');

  const northernLuzonShare = northernLuzon.reduce((s, r) => s + r.sharePercent, 0);
  const southernLuzonShare = southernLuzon.reduce((s, r) => s + r.sharePercent, 0);
  const ncrShare = ncr?.sharePercent ?? 0;

  const handleIslandClick = (islandName: 'Luzon' | 'Visayas' | 'Mindanao') => {
    const next = selectedIslandTab === islandName ? 'All' : islandName;
    setSelectedIslandTab(next);
    onSelectIsland?.(next === 'All' ? null : next);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.8));
  const handleResetZoom = () => setZoomLevel(1);

  const handleModalZoomIn = () => setModalZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleModalZoomOut = () => setModalZoomLevel((prev) => Math.max(prev - 0.25, 0.8));
  const handleModalResetZoom = () => setModalZoomLevel(1);

  const paletteColors = ['#f6cf4e', '#7bc8e9', '#62c5ae', '#7ccf4a', '#ff9d57', '#e7589a', '#9a8fc7', '#ff5b59'];

  const REGION_PALETTE = [
    '#0284c7', '#0ea5e9', '#38bdf8', '#06b6d4', '#14b8a6', '#10b981', '#059669',
    '#f59e0b', '#f97316', '#ef4444', '#f43f5e', '#e11d48', '#ec4899', '#d946ef',
    '#a855f7', '#8b5cf6', '#6366f1', '#4f46e5'
  ];

  let pieSegments: PieSegment[] = [];
  if (pieSliceType === 'island') {
    pieSegments = [
      { id: 'Luzon', name: 'Luzon Island Group', amount: luzonTotal, share: luzonShare, count: luzonProjects.length, color: '#00a3e0', island: 'Luzon' },
      { id: 'Visayas', name: 'Visayas Island Group', amount: visayasTotal, share: visayasShare, count: visayasProjects.length, color: '#2e7d32', island: 'Visayas' },
      { id: 'Mindanao', name: 'Mindanao Island Group', amount: mindanaoTotal, share: mindanaoShare, count: mindanaoProjects.length, color: '#d81b60', island: 'Mindanao' },
    ];
  } else if (pieSliceType === 'subgroup') {
    pieSegments = [
      { id: 'Northern Luzon', name: 'Northern Luzon', amount: northernLuzon.reduce((s, r) => s + r.amount, 0) / 1e9, share: northernLuzonShare, count: northernLuzon.reduce((s, r) => s + r.count, 0), color: '#0284c7', island: 'Luzon' },
      { id: 'Southern Luzon', name: 'Southern Luzon', amount: southernLuzon.reduce((s, r) => s + r.amount, 0) / 1e9, share: southernLuzonShare, count: southernLuzon.reduce((s, r) => s + r.count, 0), color: '#38bdf8', island: 'Luzon' },
      { id: 'NCR', name: 'NCR (Metro Manila)', amount: (ncr?.amount ?? 0) / 1e9, share: ncrShare, count: ncr?.count ?? 0, color: '#0ea5e9', island: 'Luzon' },
      { id: 'Visayas', name: 'Visayas Region', amount: visayasTotal, share: visayasShare, count: visayasProjects.length, color: '#10b981', island: 'Visayas' },
      { id: 'Mindanao', name: 'Mindanao Region', amount: mindanaoTotal, share: mindanaoShare, count: mindanaoProjects.length, color: '#f43f5e', island: 'Mindanao' },
    ];
  } else {
    const sorted = [...regionRows].sort((a, b) => b.amount - a.amount);
    pieSegments = sorted.map((reg, idx) => ({
      id: reg.name,
      name: reg.displayName,
      amount: reg.amount / 1e9,
      share: reg.sharePercent,
      count: reg.count,
      color: REGION_PALETTE[idx % REGION_PALETTE.length],
      island: reg.island,
    }));
  }

  let cumulativeAngle = -Math.PI / 2;
  const renderedSlices = pieSegments.map((seg) => {
    const sliceAngle = seg.share > 0 ? (seg.share / 100) * 2 * Math.PI : 0;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;
    cumulativeAngle = endAngle;

    const isHovered = hoveredPieSegment?.id === seg.id;
    const isSelected = selectedIslandTab === seg.island || activeIslandFilter === seg.island;

    const rInner = 75;
    const rOuter = isHovered ? 138 : 128;
    const pathD = sliceAngle > 0 ? getDonutPath(160, 160, rInner, rOuter, startAngle, endAngle) : '';

    return {
      ...seg,
      pathD,
      isHovered,
      isSelected,
    };
  });

  return (
    <div
      className={`rounded-2xl p-5 sm:p-7 shadow-md border relative overflow-hidden flex flex-col justify-between transition-all duration-200 ${
        isLight
          ? 'bg-white border-slate-200/90 text-slate-800'
          : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-slate-100 border-slate-800 shadow-xl'
      }`}
    >
      <div>
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  isLight ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                }`}
              >
                <MapIcon className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                DISTRIBUTION OF BUDGET BY REGION — CAPITAL OUTLAYS
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}
              >
                FY {selectedYear} National Expenditure Program
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight flex flex-wrap items-baseline gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span className={isLight ? 'text-blue-800 font-black' : 'text-emerald-400 font-black'}>
                ₱{totalBudgetBillion.toFixed(2)} B
              </span>
              <span className={`text-xs sm:text-sm font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Regional Portfolio Sum ({projects.length} Records)
              </span>
            </h2>
          </div>

          {/* View Mode Switcher */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border self-start sm:self-auto shrink-0 ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'map'
                  ? isLight
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-amber-500 text-slate-950 shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Infographic Map</span>
            </button>
            <button
              onClick={() => setViewMode('pie')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'pie'
                  ? isLight
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-amber-500 text-slate-950 shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ChartPieIcon className="w-3.5 h-3.5" />
              <span>Pie Analytics</span>
            </button>
          </div>
        </div>

        {/* 1. Official Infographic Map View with True Philippines Map */}
        {viewMode === 'map' && (
          <div
            className={`mt-5 rounded-2xl p-4 sm:p-6 border shadow-2xl relative overflow-hidden transition-all ${
              isLight
                ? 'bg-gradient-to-b from-[#0b254a] via-[#071b38] to-[#041024] text-white border-blue-950'
                : 'bg-gradient-to-b from-[#061833] via-[#041226] to-[#020b18] text-white border-slate-800'
            }`}
          >
            {/* Top Island Header Banner: LUZON, VISAYAS, MINDANAO quick tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 mb-6">
              <button
                onClick={() => handleIslandClick('Luzon')}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black tracking-wider bg-[#00a3e0] text-white shadow-lg transition-all hover:brightness-110 active:scale-95 border border-white/30 flex items-center gap-2 ${
                  activeIslandFilter === 'Luzon' ? 'ring-3 ring-amber-400 shadow-cyan-500/50 scale-105' : 'opacity-90 hover:opacity-100'
                }`}
              >
                <span>LUZON — {luzonShare.toFixed(2)}%</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                  ₱{luzonTotal.toFixed(2)} B
                </span>
              </button>

              <button
                onClick={() => handleIslandClick('Visayas')}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black tracking-wider bg-[#2e7d32] text-white shadow-lg transition-all hover:brightness-110 active:scale-95 border border-white/30 flex items-center gap-2 ${
                  activeIslandFilter === 'Visayas' ? 'ring-3 ring-amber-400 shadow-emerald-500/50 scale-105' : 'opacity-90 hover:opacity-100'
                }`}
              >
                <span>VISAYAS — {visayasShare.toFixed(2)}%</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                  ₱{visayasTotal.toFixed(2)} B
                </span>
              </button>

              <button
                onClick={() => handleIslandClick('Mindanao')}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black tracking-wider bg-[#d81b60] text-white shadow-lg transition-all hover:brightness-110 active:scale-95 border border-white/30 flex items-center gap-2 ${
                  activeIslandFilter === 'Mindanao' ? 'ring-3 ring-amber-400 shadow-rose-500/50 scale-105' : 'opacity-90 hover:opacity-100'
                }`}
              >
                <span>MINDANAO — {mindanaoShare.toFixed(2)}%</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                  ₱{mindanaoTotal.toFixed(2)} B
                </span>
              </button>
            </div>

            {/* Infographic 3-Column Grid: Left Tables (3 cols) | Center Vector Map (6 cols) | Right Tables (3 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Left Column (3 cols): NCR Badge + Southern Luzon + Visayas */}
              <div className="lg:col-span-3 xl:col-span-3 space-y-4">
                {/* 1. NCR Badge */}
                <div
                  onClick={() => handleIslandClick('Luzon')}
                  className="bg-[#00a3e0] text-white font-black py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-between cursor-pointer hover:brightness-110 transition-all border border-white/20"
                >
                  <span className="text-xs sm:text-sm tracking-wide font-black">NCR - {ncrShare.toFixed(2)}%</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-black/20">
                    ₱{((ncr?.amount ?? 0) / 1e9).toFixed(2)} B
                  </span>
                </div>

                {/* 2. Southern Luzon Table */}
                <div className="rounded-xl overflow-hidden shadow-xl border border-sky-400/40 bg-white">
                  <div className="bg-[#00a3e0] text-white font-black text-xs py-2 px-3.5 uppercase tracking-wider flex items-center justify-between">
                    <span className="font-black text-xs tracking-wide">SOUTHERN LUZON - {southernLuzonShare.toFixed(2)}%</span>
                  </div>
                  <table className="w-full text-left text-xs bg-white text-slate-900 font-medium">
                    <thead className="bg-[#fbb040] text-slate-950 font-black text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-1.5">Region / Group</th>
                        <th className="px-3 py-1.5 text-right">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-semibold">
                      {southernLuzon.length > 0 ? (
                        southernLuzon.map((reg) => (
                          <tr key={reg.name} className="hover:bg-amber-50/80 transition-colors">
                            <td className="px-3 py-1.5 text-slate-800 text-[11px] sm:text-xs">{reg.displayName}</td>
                            <td className="px-3 py-1.5 text-right font-black text-blue-900">{reg.sharePercent.toFixed(2)}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="px-3 py-2 text-center text-slate-400">No records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 3. Visayas Table */}
                <div className="rounded-xl overflow-hidden shadow-xl border border-emerald-500/40 bg-white">
                  <div
                    onClick={() => handleIslandClick('Visayas')}
                    className={`bg-[#2e7d32] text-white font-black text-xs py-2 px-3.5 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:brightness-110 transition-all ${
                      activeIslandFilter === 'Visayas' ? 'ring-2 ring-amber-400' : ''
                    }`}
                  >
                    <span className="font-black text-xs tracking-wide">VISAYAS - {visayasShare.toFixed(2)}%</span>
                    <span className="text-[11px] font-bold opacity-90">₱{visayasTotal.toFixed(2)} B</span>
                  </div>
                  <table className="w-full text-left text-xs bg-white text-slate-900 font-medium">
                    <thead className="bg-[#fbb040] text-slate-950 font-black text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-1.5">Region / Group</th>
                        <th className="px-3 py-1.5 text-right">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-semibold">
                      {visayasList.length > 0 ? (
                        visayasList.map((reg) => (
                          <tr key={reg.name} className="hover:bg-emerald-50/80 transition-colors">
                            <td className="px-3 py-1.5 text-slate-800 text-[11px] sm:text-xs">{reg.displayName}</td>
                            <td className="px-3 py-1.5 text-right font-black text-emerald-900">{reg.sharePercent.toFixed(2)}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="px-3 py-2 text-center text-slate-400">No records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Center Column (6 cols): Enlarged DPWH-palette derivative of the Wikimedia map */}
              <div className="lg:col-span-6 xl:col-span-6 flex flex-col items-center justify-center relative p-1 sm:p-2">
                {/* Map Card Viewport */}
                <div className="relative w-full max-w-[500px] min-h-[500px] sm:min-h-[540px] lg:min-h-[580px] rounded-2xl overflow-hidden shadow-2xl border border-cyan-300/40 bg-gradient-to-b from-[#c3e7f5] to-[#aedef0] flex flex-col items-center justify-center group transition-all duration-300">
                  {/* Action Controls Toolbar (Zoom, Expand) */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-white/30 shadow-lg">
                    <button
                      onClick={handleZoomIn}
                      title="Zoom In"
                      aria-label="Zoom In"
                      className="p-1.5 text-white hover:text-cyan-300 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <MagnifyingGlassPlusIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleZoomOut}
                      title="Zoom Out"
                      aria-label="Zoom Out"
                      className="p-1.5 text-white hover:text-cyan-300 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <MagnifyingGlassMinusIcon className="w-4 h-4" />
                    </button>
                    {zoomLevel !== 1 && (
                      <button
                        onClick={handleResetZoom}
                        title="Reset Zoom"
                        aria-label="Reset Zoom"
                        className="p-1.5 text-amber-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <ArrowPathIcon className="w-4 h-4" />
                      </button>
                    )}
                    <div className="w-[1px] h-4 bg-white/20 mx-0.5" />
                    <button
                      onClick={() => setIsModalOpen(true)}
                      title="Enlarge Map Fullscreen"
                      aria-label="Enlarge Map Fullscreen"
                      className="p-1.5 text-cyan-300 hover:text-white hover:bg-cyan-500/30 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs"
                    >
                      <ArrowsPointingOutIcon className="w-4 h-4" />
                      <span className="hidden sm:inline text-[10px] font-bold">Enlarge</span>
                    </button>
                  </div>

                  {/* Top Left Badge: Island Indicator */}
                  {activeIslandFilter && (
                    <div className="absolute top-3 left-3 z-10">
                      <span className="px-3 py-1 rounded-lg text-xs font-black bg-amber-400 text-slate-950 shadow-md border border-amber-300 flex items-center gap-1.5">
                        <SparklesIcon className="w-3.5 h-3.5" />
                        Filtering: {activeIslandFilter}
                      </span>
                    </div>
                  )}

                  {/* Philippines Vector SVG Image */}
                  <div
                    className="w-full h-full flex items-center justify-center p-3 sm:p-4 overflow-hidden transition-transform duration-300 cursor-pointer"
                    onClick={() => setIsModalOpen(true)}
                    title="Click to view full-size enlarged map"
                  >
                    <img
                      src="/assets/philippines_budget_map.svg"
                      alt="Color-coded map of Philippine provinces for the regional budget allocation dashboard"
                      style={{ transform: `scale(${zoomLevel})` }}
                      className="w-full h-auto max-h-[540px] sm:max-h-[580px] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] transition-transform duration-200"
                    />
                  </div>
                </div>

                {/* Regional Palette Legend (Located OUTSIDE / BELOW the map to ensure Mindanao and Visayas are 100% visible) */}
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/20 bg-slate-900/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
                  <div className="flex items-center gap-1.5">
                    {['#f6cf4e', '#7bc8e9', '#62c5ae', '#7ccf4a', '#ff9d57', '#e7589a', '#9a8fc7', '#ff5b59'].map((color) => (
                      <span
                        key={color}
                        className="h-3 w-3 rounded-sm border border-white/60 shadow-sm"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold tracking-wider text-slate-200 uppercase ml-1">
                    Regional Palette
                  </span>
                  <span className="text-[10px] text-cyan-300 font-semibold">
                    (DPWH Standard)
                  </span>
                </div>

                {/* Attribution Link */}
                <div className="mt-2 text-center text-[10px] font-semibold leading-relaxed text-slate-300">
                  <span>Province boundaries colorized in the DPWH presentation palette</span>
                  <span className="mx-1.5 text-slate-500">·</span>
                  <a
                    href="https://commons.wikimedia.org/wiki/File:Philippines_location_map_(square).svg"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 hover:text-cyan-200"
                  >
                    Map by Hellerick, CC BY-SA 3.0
                  </a>
                </div>
              </div>

              {/* Right Column (3 cols): Northern Luzon Table + Mindanao Table */}
              <div className="lg:col-span-3 xl:col-span-3 space-y-4">
                {/* 1. Northern Luzon Table */}
                <div className="rounded-xl overflow-hidden shadow-xl border border-sky-400/40 bg-white">
                  <div className="bg-[#00a3e0] text-white font-black text-xs py-2 px-3.5 uppercase tracking-wider flex items-center justify-between">
                    <span className="font-black text-xs tracking-wide">NORTHERN LUZON - {northernLuzonShare.toFixed(2)}%</span>
                  </div>
                  <table className="w-full text-left text-xs bg-white text-slate-900 font-medium">
                    <thead className="bg-[#fbb040] text-slate-950 font-black text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-1.5">Region / Group</th>
                        <th className="px-3 py-1.5 text-right">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-semibold">
                      {northernLuzon.length > 0 ? (
                        northernLuzon.map((reg) => (
                          <tr key={reg.name} className="hover:bg-amber-50/80 transition-colors">
                            <td className="px-3 py-1.5 text-slate-800 text-[11px] sm:text-xs">{reg.displayName}</td>
                            <td className="px-3 py-1.5 text-right font-black text-blue-900">{reg.sharePercent.toFixed(2)}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="px-3 py-2 text-center text-slate-400">No records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. Mindanao Table */}
                <div className="rounded-xl overflow-hidden shadow-xl border border-rose-500/40 bg-white">
                  <div
                    onClick={() => handleIslandClick('Mindanao')}
                    className={`bg-[#d81b60] text-white font-black text-xs py-2 px-3.5 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:brightness-110 transition-all ${
                      activeIslandFilter === 'Mindanao' ? 'ring-2 ring-amber-400' : ''
                    }`}
                  >
                    <span className="font-black text-xs tracking-wide">MINDANAO - {mindanaoShare.toFixed(2)}%</span>
                    <span className="text-[11px] font-bold opacity-90">₱{mindanaoTotal.toFixed(2)} B</span>
                  </div>
                  <table className="w-full text-left text-xs bg-white text-slate-900 font-medium">
                    <thead className="bg-[#fbb040] text-slate-950 font-black text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-1.5">Region / Group</th>
                        <th className="px-3 py-1.5 text-right">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-semibold">
                      {mindanaoList.length > 0 ? (
                        mindanaoList.map((reg) => (
                          <tr key={reg.name} className="hover:bg-rose-50/80 transition-colors">
                            <td className="px-3 py-1.5 text-slate-800 text-[11px] sm:text-xs">{reg.displayName}</td>
                            <td className="px-3 py-1.5 text-right font-black text-rose-900">{reg.sharePercent.toFixed(2)}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="px-3 py-2 text-center text-slate-400">No records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Banner */}
            <div className="mt-5 pt-3 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
              <span className="font-black text-amber-400 text-sm">
                PORTFOLIO SUM: ₱{totalBudgetBillion.toFixed(2)} B
              </span>
              <span className="text-slate-300 font-medium text-[11px]">
                {projects.length} Regional Records Accounted
              </span>
            </div>
          </div>
        )}

        {/* 2. Interactive Donut / Pie Analytics View */}
        {viewMode === 'pie' && (
          <div className="mt-5 space-y-6">
            {/* Top Island Filter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: 'Luzon', amount: luzonTotal, share: luzonShare, count: luzonProjects.length, color: '#0284c7' },
                { name: 'Mindanao', amount: mindanaoTotal, share: mindanaoShare, count: mindanaoProjects.length, color: '#e11d48' },
                { name: 'Visayas', amount: visayasTotal, share: visayasShare, count: visayasProjects.length, color: '#059669' },
              ].map((island) => {
                const isSelected = selectedIslandTab === island.name || activeIslandFilter === island.name;

                return (
                  <motion.button
                    key={island.name}
                    whileHover={{ y: -2 }}
                    onClick={() => handleIslandClick(island.name as any)}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-slate-700'
                    } ${
                      isSelected
                        ? isLight
                          ? 'ring-2 ring-blue-600 shadow-md border-blue-400 bg-blue-50/60'
                          : 'ring-2 ring-white/60 shadow-xl border-white/60 bg-slate-800'
                        : 'hover:border-slate-400/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {island.name} Group
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-black"
                        style={{ backgroundColor: `${island.color}20`, color: island.color }}
                      >
                        {island.share.toFixed(2)}%
                      </span>
                    </div>
                    <div className={`text-xl font-black mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      ₱{island.amount.toFixed(2)} B
                    </div>
                    <div className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {island.count} projects
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Granularity Switcher: Island vs Subgroup vs Region */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Segment Breakdown:
                </span>
                <div className={`inline-flex p-1 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  {(['island', 'subgroup', 'region'] as const).map((mode) => {
                    const label = mode === 'island' ? 'Island Groups (3)' : mode === 'subgroup' ? 'Sub-Regions (5)' : `All Regions (${regionRows.length})`;
                    const isActive = pieSliceType === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => {
                          setPieSliceType(mode);
                          setHoveredPieSegment(null);
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                          isActive
                            ? isLight
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-amber-500 text-slate-950 shadow-sm'
                            : isLight
                            ? 'text-slate-600 hover:text-slate-900'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {hoveredPieSegment && (
                <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredPieSegment.color }} />
                  <span>Inspecting: {hoveredPieSegment.name}</span>
                </div>
              )}
            </div>

            {/* Main Donut Chart & Detailed Ranking Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Column (5 cols): Interactive SVG Donut Chart */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl border bg-gradient-to-b from-[#0b254a]/60 via-[#071b38]/60 to-[#041024]/60 border-blue-950/60 shadow-xl relative min-h-[360px]">
                <div className="relative w-[300px] h-[300px] sm:w-[320px] sm:h-[320px] flex items-center justify-center">
                  <svg viewBox="0 0 320 320" className="w-full h-full drop-shadow-2xl overflow-visible">
                    {/* Background glow circle */}
                    <circle cx="160" cy="160" r="130" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="50" />

                    {/* Donut Slices */}
                    {renderedSlices.map((slice) => {
                      if (!slice.pathD) return null;
                      return (
                        <path
                          key={slice.id}
                          d={slice.pathD}
                          fill={slice.color}
                          stroke={isLight ? '#ffffff' : '#071b38'}
                          strokeWidth="2.5"
                          className="transition-all duration-200 cursor-pointer"
                          style={{
                            opacity: hoveredPieSegment ? (hoveredPieSegment.id === slice.id ? 1 : 0.45) : 0.95,
                            filter: slice.isHovered ? 'drop-shadow(0 0 10px rgba(255,255,255,0.4))' : undefined,
                          }}
                          onMouseEnter={() => setHoveredPieSegment(slice)}
                          onMouseLeave={() => setHoveredPieSegment(null)}
                          onClick={() => slice.island && handleIslandClick(slice.island as any)}
                        />
                      );
                    })}
                  </svg>

                  {/* Donut Center Info Box */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-6">
                    {hoveredPieSegment ? (
                      <motion.div
                        key={hoveredPieSegment.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-0.5"
                      >
                        <div
                          className="text-xs font-black uppercase tracking-wider truncate max-w-[140px]"
                          style={{ color: hoveredPieSegment.color }}
                        >
                          {hoveredPieSegment.name}
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-white">
                          ₱{hoveredPieSegment.amount.toFixed(2)} B
                        </div>
                        <div className="text-xs font-bold text-amber-300">
                          {hoveredPieSegment.share.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {hoveredPieSegment.count} projects
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                          Total Portfolio
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-amber-400">
                          ₱{totalBudgetBillion.toFixed(2)} B
                        </div>
                        <div className="text-[11px] font-semibold text-slate-300">
                          100.00% Allocated
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {projects.length} Line Items
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-center text-[10px] text-slate-400">
                  Hover over any slice or list item to inspect allocation
                </div>
              </div>

              {/* Right Column (7 cols): Detailed Segment Ranking List */}
              <div className="lg:col-span-7 space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {renderedSlices.map((item, index) => {
                  const isHovered = hoveredPieSegment?.id === item.id;
                  const isSelected = selectedIslandTab === item.island || activeIslandFilter === item.island;

                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredPieSegment(item)}
                      onMouseLeave={() => setHoveredPieSegment(null)}
                      onClick={() => item.island && handleIslandClick(item.island as any)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isLight
                          ? isHovered
                            ? 'bg-blue-50 border-blue-300 shadow-md ring-1 ring-blue-400'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                          : isHovered
                          ? 'bg-slate-800 border-cyan-400/80 shadow-lg ring-1 ring-cyan-400/50'
                          : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/80'
                      } ${isSelected ? 'border-amber-400/80' : ''}`}
                    >
                      <div className="flex items-center justify-between text-xs gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 w-4">
                            #{index + 1}
                          </span>
                          <span
                            className="w-3 h-3 rounded-sm shadow-xs shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className={`font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-black text-amber-400">
                            ₱{item.amount.toFixed(2)} B
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[11px] font-black"
                            style={{ backgroundColor: `${item.color}25`, color: item.color }}
                          >
                            {item.share.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-slate-400 hidden sm:inline">
                            ({item.count} projects)
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(item.share, 2)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. Fullscreen / High-Resolution Enlarge Map Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
              />

              {/* Modal Content Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full max-w-5xl bg-gradient-to-b from-[#0b254a] via-[#071b38] to-[#041024] text-white border border-cyan-400/40 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-blue-900/60 bg-blue-950/40">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/20 text-cyan-300 border border-blue-400/30">
                      <MapIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                        <span>Philippines Regional Infrastructure Allocation Map</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-amber-400 text-slate-950 font-bold">
                          FY {selectedYear}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300">
                        High-resolution visual breakdown of capital outlays across Philippine islands and administrative regions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Modal Zoom Controls */}
                    <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700">
                      <button
                        onClick={handleModalZoomIn}
                        title="Zoom In"
                        aria-label="Zoom In"
                        className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <MagnifyingGlassPlusIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleModalZoomOut}
                        title="Zoom Out"
                        aria-label="Zoom Out"
                        className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <MagnifyingGlassMinusIcon className="w-4 h-4" />
                      </button>
                      {modalZoomLevel !== 1 && (
                        <button
                          onClick={handleModalResetZoom}
                          title="Reset Zoom"
                          aria-label="Reset Zoom"
                          className="p-1.5 text-amber-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-bold"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setIsModalOpen(false)}
                      aria-label="Close enlarged map"
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Modal Island Badges Toolbar */}
                <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-slate-950/50 border-b border-slate-800">
                  <button
                    onClick={() => handleIslandClick('Luzon')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-wider bg-[#00a3e0] text-white shadow-md border border-white/20 transition-all ${
                      activeIslandFilter === 'Luzon' ? 'ring-2 ring-amber-400' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    LUZON: ₱{luzonTotal.toFixed(2)} B ({luzonShare.toFixed(2)}%)
                  </button>
                  <button
                    onClick={() => handleIslandClick('Visayas')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-wider bg-[#2e7d32] text-white shadow-md border border-white/20 transition-all ${
                      activeIslandFilter === 'Visayas' ? 'ring-2 ring-amber-400' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    VISAYAS: ₱{visayasTotal.toFixed(2)} B ({visayasShare.toFixed(2)}%)
                  </button>
                  <button
                    onClick={() => handleIslandClick('Mindanao')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-wider bg-[#d81b60] text-white shadow-md border border-white/20 transition-all ${
                      activeIslandFilter === 'Mindanao' ? 'ring-2 ring-amber-400' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    MINDANAO: ₱{mindanaoTotal.toFixed(2)} B ({mindanaoShare.toFixed(2)}%)
                  </button>
                </div>

                {/* Modal Map Body */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-gradient-to-b from-[#c3e7f5] via-[#b2e2f3] to-[#a0d9ee] min-h-[500px]">
                  <div className="relative w-full flex items-center justify-center overflow-hidden">
                    <img
                      src="/assets/philippines_budget_map.svg"
                      alt="Color-coded map of Philippine provinces for the regional budget allocation dashboard"
                      style={{ transform: `scale(${modalZoomLevel})` }}
                      className="w-auto h-auto max-h-[70vh] object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.4)] transition-transform duration-200"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {paletteColors.map((c) => (
                        <span key={c} className="w-2.5 h-2.5 rounded-sm border border-white/50" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-300 font-bold uppercase">
                      DPWH Regional Palette
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Total Regional Budget: <span className="font-bold text-amber-400">₱{totalBudgetBillion.toFixed(2)} Billion</span> ({projects.length} Total Line Items)
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DashboardRegionalMatrix;
