import React, { lazy, Suspense, useState, useEffect } from 'react';
import type { MapArea } from './DashboardIslandMap';
import { regionKey, regionGroup } from './dashboardRegions';
const DashboardIslandMap = lazy(() => import('./DashboardIslandMap'));
import { AnimatePresence, motion } from 'framer-motion';
import {
  MapIcon,
  ChartPieIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useDashboardTheme } from '../DashboardTheme';
import UpdatingBadge from './UpdatingBadge';

/** Server-aggregated region row (WebAPI Dashboard/RegionalBreakdown) — replaces client-side
 *  aggregation over a full project array so this component only needs per-region totals. */
export interface RegionalBreakdownRow {
  region: string;
  island: string;
  /** tOptionAdminAreaRegion.Hierarchy: the order the region tables list regions in. */
  hierarchy?: string | null;
  budget: number;
  projectCount: number;
}

interface Props {
  selectedYear?: number;
  /** Badge wording after the year: the header stage's full name, or "Current program stages". */
  stageLabel?: string;
  regions?: RegionalBreakdownRow[];
  isLoading?: boolean;
  onSelectIsland?: (island: string | null) => void;
  activeIslandFilter?: string | null;
}

interface RegionRow {
  name: string;
  displayName: string;
  island: string;
  hierarchy: string | null;
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
  stageLabel = 'National Expenditure Program',
  regions: regionsProp = [],
  isLoading = false,
  onSelectIsland,
  activeIslandFilter,
}) => {
  const { isLight } = useDashboardTheme();
  // Reloading for a new year or filter with the previous regions still on screen.
  const isUpdating = isLoading && regionsProp.length > 0;
  const [viewMode, setViewMode] = useState<'map' | 'pie'>('map');
  const [selectedIslandTab, setSelectedIslandTab] = useState<'All' | 'Luzon' | 'Visayas' | 'Mindanao'>('All');
  
  // Interactive zoom and modal states
  const [mapArea, setMapArea] = useState<MapArea>('All');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isModalOpen]);

  // Derive data from the server-aggregated region rows (Dashboard/RegionalBreakdown) —
  // the group-by that used to happen client-side over the full project array now happens
  // server-side; this only needs to bucket those aggregates into subgroups (Northern/Southern
  // Luzon, NCR) via the existing regionGroup() lookup.
  const totalBudget = regionsProp.reduce((sum, r) => sum + r.budget, 0);
  const totalBudgetBillion = totalBudget / 1e9;
  const totalProjectCount = regionsProp.reduce((sum, r) => sum + r.projectCount, 0);

  const regionRows: RegionRow[] = regionsProp.map((row) => {
    const regName = row.region || 'Unassigned';
    const share = totalBudget > 0 ? (row.budget / totalBudget) * 100 : 0;
    const subgroup = regionGroup(regName) ?? row.island;
    const shortName = regName.split(' (')[0];

    return {
      name: regName,
      displayName: shortName,
      island: row.island || 'Other',
      hierarchy: row.hierarchy ?? null,
      subgroup,
      amount: row.budget,
      sharePercent: share,
      count: row.projectCount,
    };
  });

  const luzonRegions = regionsProp.filter((r) => r.island === 'Luzon');
  const visayasRegions = regionsProp.filter((r) => r.island === 'Visayas');
  const mindanaoRegions = regionsProp.filter((r) => r.island === 'Mindanao');

  const luzonTotal = luzonRegions.reduce((sum, r) => sum + r.budget, 0) / 1e9;
  const visayasTotal = visayasRegions.reduce((sum, r) => sum + r.budget, 0) / 1e9;
  const mindanaoTotal = mindanaoRegions.reduce((sum, r) => sum + r.budget, 0) / 1e9;

  const luzonProjectCount = luzonRegions.reduce((sum, r) => sum + r.projectCount, 0);
  const visayasProjectCount = visayasRegions.reduce((sum, r) => sum + r.projectCount, 0);
  const mindanaoProjectCount = mindanaoRegions.reduce((sum, r) => sum + r.projectCount, 0);

  const luzonShare = totalBudgetBillion > 0 ? (luzonTotal / totalBudgetBillion) * 100 : 0;
  const visayasShare = totalBudgetBillion > 0 ? (visayasTotal / totalBudgetBillion) * 100 : 0;
  const mindanaoShare = totalBudgetBillion > 0 ? (mindanaoTotal / totalBudgetBillion) * 100 : 0;

  // The region tables list regions in DPWH's order (tOptionAdminAreaRegion.Hierarchy: CAR, I, II,
  // III; IV-A, MIMAROPA, V; NIR, VI, VII, VIII; IX … XIII, BARMM), not by budget. A region with no
  // hierarchy (an unrecognized code) goes last. Northern and Southern Luzon are not in the
  // database: regionGroup() splits Luzon's regions into them, NCR apart.
  const byHierarchy = (a: RegionRow, b: RegionRow) =>
    (a.hierarchy ?? '￿').localeCompare(b.hierarchy ?? '￿') || a.displayName.localeCompare(b.displayName);
  const regionsInOrder = [...regionRows].sort(byHierarchy);
  const northernLuzon = regionsInOrder.filter((r) => r.subgroup === 'Northern Luzon');
  const southernLuzon = regionsInOrder.filter((r) => r.subgroup === 'Southern Luzon');
  const northernLuzonBillion = northernLuzon.reduce((sum, r) => sum + r.amount, 0) / 1e9;
  const southernLuzonBillion = southernLuzon.reduce((sum, r) => sum + r.amount, 0) / 1e9;
  const ncr = regionRows.filter((r) => r.subgroup === 'NCR').reduce((sum, row) => ({
    amount: sum.amount + row.amount,
    sharePercent: sum.sharePercent + row.sharePercent,
    count: sum.count + row.count,
  }), { amount: 0, sharePercent: 0, count: 0 });
  const visayasList = regionsInOrder.filter((r) => r.island === 'Visayas');
  const mindanaoList = regionsInOrder.filter((r) => r.island === 'Mindanao');

  const northernLuzonShare = northernLuzon.reduce((s, r) => s + r.sharePercent, 0);
  const southernLuzonShare = southernLuzon.reduce((s, r) => s + r.sharePercent, 0);
  const ncrShare = ncr?.sharePercent ?? 0;

  const handleIslandClick = (islandName: string) => {
    if (islandName !== 'Luzon' && islandName !== 'Visayas' && islandName !== 'Mindanao') return;
    const next = selectedIslandTab === islandName ? 'All' : islandName;
    setSelectedIslandTab(next);
    setMapArea(next);
    setSelectedRegion(null);
    onSelectIsland?.(next === 'All' ? null : next);
  };

  const handleMapSelect = (area: MapArea) => {
    setMapArea(area);
    setSelectedRegion(area === 'NCR' ? 'NCR' : null);
    setSelectionVersion(value => value + 1);
    const island = area === 'NCR' || area === 'Northern Luzon' || area === 'Southern Luzon' ? 'Luzon' : area;
    setSelectedIslandTab(island);
    onSelectIsland?.(island === 'All' ? null : island);
  };

  const handleRegionSelect = (name: string) => {
    const group = regionGroup(name);
    if (!group) return;
    handleMapSelect(group);
    setSelectedRegion(regionKey(name));
  };

  const REGION_PALETTE = [
    '#0284c7', '#0ea5e9', '#38bdf8', '#06b6d4', '#14b8a6', '#10b981', '#059669',
    '#f59e0b', '#f97316', '#ef4444', '#f43f5e', '#e11d48', '#ec4899', '#d946ef',
    '#a855f7', '#8b5cf6', '#6366f1', '#4f46e5'
  ];

  let pieSegments: PieSegment[] = [];
  if (pieSliceType === 'island') {
    pieSegments = [
      { id: 'Luzon', name: 'Luzon', amount: luzonTotal, share: luzonShare, count: luzonProjectCount, color: '#00a3e0', island: 'Luzon' },
      { id: 'Visayas', name: 'Visayas', amount: visayasTotal, share: visayasShare, count: visayasProjectCount, color: '#2e7d32', island: 'Visayas' },
      { id: 'Mindanao', name: 'Mindanao', amount: mindanaoTotal, share: mindanaoShare, count: mindanaoProjectCount, color: '#d81b60', island: 'Mindanao' },
    ];
  } else if (pieSliceType === 'subgroup') {
    pieSegments = [
      { id: 'Northern Luzon', name: 'Northern Luzon', amount: northernLuzon.reduce((s, r) => s + r.amount, 0) / 1e9, share: northernLuzonShare, count: northernLuzon.reduce((s, r) => s + r.count, 0), color: '#0284c7', island: 'Luzon' },
      { id: 'Southern Luzon', name: 'Southern Luzon', amount: southernLuzon.reduce((s, r) => s + r.amount, 0) / 1e9, share: southernLuzonShare, count: southernLuzon.reduce((s, r) => s + r.count, 0), color: '#38bdf8', island: 'Luzon' },
      { id: 'NCR', name: 'NCR (Metro Manila)', amount: (ncr?.amount ?? 0) / 1e9, share: ncrShare, count: ncr?.count ?? 0, color: '#0ea5e9', island: 'Luzon' },
      { id: 'Visayas', name: 'Visayas Region', amount: visayasTotal, share: visayasShare, count: visayasProjectCount, color: '#10b981', island: 'Visayas' },
      { id: 'Mindanao', name: 'Mindanao Region', amount: mindanaoTotal, share: mindanaoShare, count: mindanaoProjectCount, color: '#f43f5e', island: 'Mindanao' },
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
                FY {selectedYear} {stageLabel}
              </span>
              {isUpdating && <UpdatingBadge isLight={isLight} />}
            </div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight flex flex-wrap items-baseline gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span className={isLight ? 'text-blue-800 font-black' : 'text-emerald-400 font-black'}>
                ₱{totalBudgetBillion.toFixed(2)} B
              </span>
              <span className={`text-xs sm:text-sm font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Regional Portfolio Sum ({totalProjectCount} Records)
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
              <span>Interactive Map</span>
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

        {/* The skeleton is only for a first load: a reload keeps the previous map and tables on
            screen, dimmed, so the sections below do not move up while it loads. */}
        {isLoading && regionsProp.length === 0 ? (
          <div className="mt-5 rounded-2xl p-6 border border-slate-800/60 bg-slate-900/40 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-3 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-slate-800/60 animate-pulse" />
              ))}
            </div>
            <div className="lg:col-span-6 flex items-center justify-center">
              <div className="w-64 h-64 rounded-full bg-slate-800/60 animate-pulse" />
            </div>
            <div className="lg:col-span-3 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
        <div className={`transition-opacity ${isUpdating ? 'opacity-60' : ''}`}>
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
                <button type="button" onClick={() => handleMapSelect('NCR')} aria-pressed={mapArea === 'NCR'}
                  className="w-full text-left hover:brightness-110 focus-visible:outline-2 focus-visible:outline-amber-400 bg-[#00a3e0] text-white font-black py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-between cursor-pointer hover:brightness-110 transition-all border border-white/20"
                >
                  <span className="text-xs sm:text-sm tracking-wide font-black">NCR - {ncrShare.toFixed(2)}%</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-black/20">
                    ₱{((ncr?.amount ?? 0) / 1e9).toFixed(2)} B
                  </span>
                </button>

                {/* 2. Southern Luzon Table */}
                <div className="rounded-xl overflow-hidden shadow-xl border border-sky-400/40 bg-white">
                  <button type="button" onClick={() => handleMapSelect('Southern Luzon')} aria-pressed={mapArea === 'Southern Luzon'} className="w-full text-left hover:brightness-110 focus-visible:outline-2 focus-visible:outline-amber-400 bg-[#00a3e0] text-white font-black text-xs py-2 px-3.5 uppercase tracking-wider flex items-center justify-between">
                    <span className="font-black text-xs tracking-wide">SOUTHERN LUZON - {southernLuzonShare.toFixed(2)}%</span>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-bold opacity-90">₱{southernLuzonBillion.toFixed(2)} B</span>
                  </button>
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
                            <td className="px-3 py-1.5 text-slate-800 text-[11px] sm:text-xs"><button type="button" className="w-full text-left hover:underline focus-visible:outline-2 focus-visible:outline-sky-500" aria-pressed={selectedRegion === regionKey(reg.name)} onClick={() => handleRegionSelect(reg.name)}>{reg.displayName}</button></td>
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
                  <button type="button" onClick={() => handleMapSelect('Visayas')} aria-pressed={mapArea === 'Visayas'}
                    className={`w-full text-left focus-visible:outline-2 focus-visible:outline-amber-400 bg-[#2e7d32] text-white font-black text-xs py-2 px-3.5 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:brightness-110 transition-all ${
                      activeIslandFilter === 'Visayas' ? 'ring-2 ring-amber-400' : ''
                    }`}
                  >
                    <span className="w-full text-left hover:brightness-110 focus-visible:outline-2 focus-visible:outline-amber-400 font-black text-xs tracking-wide">VISAYAS - {visayasShare.toFixed(2)}%</span>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-bold opacity-90">₱{visayasTotal.toFixed(2)} B</span>
                  </button>
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
                            <td className="px-3 py-1.5 text-slate-800 text-[11px] sm:text-xs"><button type="button" className="w-full text-left hover:underline focus-visible:outline-2 focus-visible:outline-sky-500" aria-pressed={selectedRegion === regionKey(reg.name)} onClick={() => handleRegionSelect(reg.name)}>{reg.displayName}</button></td>
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

              {/* Interactive map shares its selected area with the enlarged view. */}
              <div className="lg:col-span-6 xl:col-span-6 min-w-0">
                <Suspense fallback={<div className="h-[640px] flex items-center justify-center text-slate-300">Loading map?</div>}>
                  <DashboardIslandMap regions={regionRows} selectedRegion={selectedRegion} selectionVersion={selectionVersion} onRegionSelect={handleRegionSelect} area={mapArea} onSelect={handleMapSelect} onEnlarge={() => setIsModalOpen(true)} />
                </Suspense>
              </div>

              {/* Right Column (3 cols): Northern Luzon Table + Mindanao Table */}
              <div className="lg:col-span-3 xl:col-span-3 space-y-4">
                {/* 1. Northern Luzon Table */}
                <div className="rounded-xl overflow-hidden shadow-xl border border-sky-400/40 bg-white">
                  <button type="button" onClick={() => handleMapSelect('Northern Luzon')} aria-pressed={mapArea === 'Northern Luzon'} className="w-full text-left hover:brightness-110 focus-visible:outline-2 focus-visible:outline-amber-400 bg-[#00a3e0] text-white font-black text-xs py-2 px-3.5 uppercase tracking-wider flex items-center justify-between">
                    <span className="font-black text-xs tracking-wide">NORTHERN LUZON - {northernLuzonShare.toFixed(2)}%</span>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-bold opacity-90">₱{northernLuzonBillion.toFixed(2)} B</span>
                  </button>
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
                            <td className="px-3 py-1.5 text-slate-800 text-[11px] sm:text-xs"><button type="button" className="w-full text-left hover:underline focus-visible:outline-2 focus-visible:outline-sky-500" aria-pressed={selectedRegion === regionKey(reg.name)} onClick={() => handleRegionSelect(reg.name)}>{reg.displayName}</button></td>
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
                  <button type="button" onClick={() => handleMapSelect('Mindanao')} aria-pressed={mapArea === 'Mindanao'}
                    className={`w-full text-left focus-visible:outline-2 focus-visible:outline-amber-400 bg-[#d81b60] text-white font-black text-xs py-2 px-3.5 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:brightness-110 transition-all ${
                      activeIslandFilter === 'Mindanao' ? 'ring-2 ring-amber-400' : ''
                    }`}
                  >
                    <span className="w-full text-left hover:brightness-110 focus-visible:outline-2 focus-visible:outline-amber-400 font-black text-xs tracking-wide">MINDANAO - {mindanaoShare.toFixed(2)}%</span>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-bold opacity-90">₱{mindanaoTotal.toFixed(2)} B</span>
                  </button>
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
                            <td className="px-3 py-1.5 text-slate-800 text-[11px] sm:text-xs"><button type="button" className="w-full text-left hover:underline focus-visible:outline-2 focus-visible:outline-sky-500" aria-pressed={selectedRegion === regionKey(reg.name)} onClick={() => handleRegionSelect(reg.name)}>{reg.displayName}</button></td>
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
                {totalProjectCount} Regional Records Accounted
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
                { name: 'Luzon', amount: luzonTotal, share: luzonShare, count: luzonProjectCount, color: '#0284c7' },
                { name: 'Mindanao', amount: mindanaoTotal, share: mindanaoShare, count: mindanaoProjectCount, color: '#e11d48' },
                { name: 'Visayas', amount: visayasTotal, share: visayasShare, count: visayasProjectCount, color: '#059669' },
              ].map((island) => {
                const isSelected = selectedIslandTab === island.name || activeIslandFilter === island.name;

                return (
                  <motion.button
                    key={island.name}
                    whileHover={{ y: -2 }}
                    onClick={() => handleIslandClick(island.name)}
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
                          onClick={() => slice.island && handleIslandClick(slice.island)}
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
                          {totalProjectCount} Line Items
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
                      onClick={() => item.island && handleIslandClick(item.island)}
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
                        Explore island groups and zoom into their locations
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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

                <div className="overflow-auto p-3">
                  <Suspense fallback={<div className="h-[60vh] flex items-center justify-center">Loading map?</div>}>
                    <DashboardIslandMap regions={regionRows} selectedRegion={selectedRegion} selectionVersion={selectionVersion} onRegionSelect={handleRegionSelect} area={mapArea} onSelect={handleMapSelect} enlarged />
                  </Suspense>
                </div>

                {/* Modal Footer */}
                <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                  <div className="text-[11px] text-slate-400">
                    Total Regional Budget: <span className="font-bold text-amber-400">₱{totalBudgetBillion.toFixed(2)} Billion</span> ({totalProjectCount} Total Line Items)
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
