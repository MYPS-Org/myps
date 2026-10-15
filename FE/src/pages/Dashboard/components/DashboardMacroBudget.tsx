import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BanknotesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { useDashboardTheme } from '../DashboardTheme';
import UpdatingBadge from './UpdatingBadge';

export interface BudgetSegment {
  id: string;
  name: string;
  amount: number; // in Billions
  color: string;
  hoverColor: string;
  percentage: number;
  description: string;
  subItems?: Array<{ name: string; amount: number; description?: string }>;
}

const MACRO_BUDGET_BY_YEAR: Record<number, { total: number; segments: BudgetSegment[] }> = {
  2027: {
    total: 643.95,
    segments: [
      {
        id: 'national-roads',
        name: 'National Road System',
        amount: 199.58,
        color: '#0284c7',
        hoverColor: '#38bdf8',
        percentage: 31.0,
        description: 'Primary, secondary, and tertiary arterial highway networks & bypasses nationwide.',
      },
      {
        id: 'special-support-bip',
        name: 'Special Support Program (BIP)',
        amount: 156.57,
        color: '#10b981',
        hoverColor: '#34d399',
        percentage: 24.31,
        description: 'Basic Infrastructure Program (BIP) focusing on social services, access roads, and community facilities.',
        subItems: [
          { name: 'Access Roads / Bridges to Strategic Public Facilities', amount: 105.0 },
          { name: 'Multi-Purpose Buildings / Social Facilities', amount: 40.97 },
          { name: 'Water Supply / Septage / Rainwater Collectors', amount: 7.29 },
          { name: 'Coastal Roads for Coastal Community Resiliency', amount: 1.38 },
          { name: 'Rehabilitation of Disaster-Related Infrastructure', amount: 1.0 },
          { name: 'PWD, Elderly & Gender-Responsive Facilities', amount: 0.51 },
          { name: 'Local Ports and Boat Landings', amount: 0.419 },
        ],
      },
      {
        id: 'foreign-assisted',
        name: 'Foreign-Assisted Projects',
        amount: 117.74,
        color: '#f59e0b',
        hoverColor: '#fbbf24',
        percentage: 18.28,
        description: 'Bilateral & multilateral funded flagship mega-bridges, expressways, and urban transit corridors.',
      },
      {
        id: 'flood-management',
        name: 'Flood Management Program',
        amount: 83.84,
        color: '#6366f1',
        hoverColor: '#818cf8',
        percentage: 13.02,
        description: 'Major river basin dikes, dredging, pumping stations, and urban drainage networks.',
      },
      {
        id: 'support-operations',
        name: 'Support to Operations (FS / ROW)',
        amount: 27.3,
        color: '#8b5cf6',
        hoverColor: '#a78bfa',
        percentage: 4.24,
        description: 'Feasibility studies, Right-of-Way (ROW) acquisitions, and environmental compliance.',
      },
      {
        id: 'mooe',
        name: 'Maintenance & Operating Expenses (MOOE)',
        amount: 24.68,
        color: '#ec4899',
        hoverColor: '#f472b6',
        percentage: 3.83,
        description: 'Routine maintenance, pothole patching, bridge repairs, and regional office operations.',
      },
      {
        id: 'personal-services',
        name: 'Personal Services',
        amount: 14.92,
        color: '#14b8a6',
        hoverColor: '#2dd4bf',
        percentage: 2.32,
        description: 'Salaries, health benefits, and personnel compensation across central & regional offices.',
      },
      {
        id: 'ppp-national-buildings',
        name: 'PPP & National Building Program',
        amount: 14.43,
        color: '#06b6d4',
        hoverColor: '#22d3ee',
        percentage: 2.24,
        description: 'Public-Private Partnership tollways and national government center buildings.',
      },
      {
        id: 'gen-admin',
        name: 'General Administration & Support',
        amount: 2.77,
        color: '#64748b',
        hoverColor: '#94a3b8',
        percentage: 0.43,
        description: 'Executive leadership, ICT systems, auditing, and corporate services.',
      },
      {
        id: 'automatic-approp',
        name: 'Automatic Appropriations',
        amount: 1.34,
        color: '#94a3b8',
        hoverColor: '#cbd5e1',
        percentage: 0.21,
        description: 'Retirement and life insurance premiums mandated by law.',
      },
    ],
  },
  2026: {
    total: 712.4,
    segments: [
      { id: 'national-roads', name: 'National Road System', amount: 228.6, color: '#0284c7', hoverColor: '#38bdf8', percentage: 32.1, description: 'Primary and secondary highway networks.' },
      { id: 'special-support-bip', name: 'Special Support Program (BIP)', amount: 168.2, color: '#10b981', hoverColor: '#34d399', percentage: 23.6, description: 'Local public buildings and road access.' },
      { id: 'foreign-assisted', name: 'Foreign-Assisted Projects', amount: 132.5, color: '#f59e0b', hoverColor: '#fbbf24', percentage: 18.6, description: 'Bilateral & multilateral flagship projects.' },
      { id: 'flood-management', name: 'Flood Management Program', amount: 96.4, color: '#6366f1', hoverColor: '#818cf8', percentage: 13.5, description: 'River basin flood controls and seawalls.' },
      { id: 'support-operations', name: 'Support to Operations (FS / ROW)', amount: 31.8, color: '#8b5cf6', hoverColor: '#a78bfa', percentage: 4.5, description: 'ROW acquisitions and studies.' },
      { id: 'mooe', name: 'Maintenance & Operating Expenses', amount: 27.5, color: '#ec4899', hoverColor: '#f472b6', percentage: 3.9, description: 'Routine maintenance and repairs.' },
      { id: 'personal-services', name: 'Personal Services', amount: 15.8, color: '#14b8a6', hoverColor: '#2dd4bf', percentage: 2.2, description: 'Personnel compensation.' },
      { id: 'gen-admin', name: 'General Administration & Others', amount: 11.6, color: '#64748b', hoverColor: '#cbd5e1', percentage: 1.6, description: 'Corporate services and appropriations.' },
    ],
  },
  2025: {
    total: 821.5,
    segments: [
      { id: 'national-roads', name: 'National Road System', amount: 271.1, color: '#0284c7', hoverColor: '#38bdf8', percentage: 33.0, description: 'Highway construction & widening.' },
      { id: 'special-support-bip', name: 'Special Support Program (BIP)', amount: 198.8, color: '#10b981', hoverColor: '#34d399', percentage: 24.2, description: 'Local community infrastructure.' },
      { id: 'foreign-assisted', name: 'Foreign-Assisted Projects', amount: 152.0, color: '#f59e0b', hoverColor: '#fbbf24', percentage: 18.5, description: 'ODA flagship infrastructure.' },
      { id: 'flood-management', name: 'Flood Management Program', amount: 108.4, color: '#6366f1', hoverColor: '#818cf8', percentage: 13.2, description: 'Flood protection infrastructure.' },
      { id: 'support-operations', name: 'Support to Operations (FS / ROW)', amount: 37.0, color: '#8b5cf6', hoverColor: '#a78bfa', percentage: 4.5, description: 'ROW and project planning.' },
      { id: 'mooe', name: 'Maintenance & Operating Expenses', amount: 29.8, color: '#ec4899', hoverColor: '#f472b6', percentage: 3.6, description: 'Maintenance programs.' },
      { id: 'personal-services', name: 'Personal Services', amount: 16.2, color: '#14b8a6', hoverColor: '#2dd4bf', percentage: 2.0, description: 'Personnel and staff costs.' },
      { id: 'gen-admin', name: 'General Administration & Others', amount: 8.2, color: '#64748b', hoverColor: '#cbd5e1', percentage: 1.0, description: 'Support services.' },
    ],
  },
  2024: {
    total: 884.2,
    segments: [
      { id: 'national-roads', name: 'National Road System', amount: 295.3, color: '#0284c7', hoverColor: '#38bdf8', percentage: 33.4, description: 'Major road arteries.' },
      { id: 'special-support-bip', name: 'Special Support Program (BIP)', amount: 219.3, color: '#10b981', hoverColor: '#34d399', percentage: 24.8, description: 'Community facilities.' },
      { id: 'foreign-assisted', name: 'Foreign-Assisted Projects', amount: 161.8, color: '#f59e0b', hoverColor: '#fbbf24', percentage: 18.3, description: 'Major bridge links.' },
      { id: 'flood-management', name: 'Flood Management Program', amount: 114.9, color: '#6366f1', hoverColor: '#818cf8', percentage: 13.0, description: 'River basin projects.' },
      { id: 'support-operations', name: 'Support to Operations (FS / ROW)', amount: 39.8, color: '#8b5cf6', hoverColor: '#a78bfa', percentage: 4.5, description: 'ROW and Feasibility.' },
      { id: 'mooe', name: 'Maintenance & Operating Expenses', amount: 31.8, color: '#ec4899', hoverColor: '#f472b6', percentage: 3.6, description: 'Road preservation.' },
      { id: 'personal-services', name: 'Personal Services', amount: 15.1, color: '#14b8a6', hoverColor: '#2dd4bf', percentage: 1.7, description: 'Salaries and wages.' },
      { id: 'gen-admin', name: 'General Administration & Others', amount: 6.2, color: '#64748b', hoverColor: '#cbd5e1', percentage: 0.7, description: 'Admin operations.' },
    ],
  },
  2023: {
    total: 798.1,
    segments: [
      { id: 'national-roads', name: 'National Road System', amount: 265.8, color: '#0284c7', hoverColor: '#38bdf8', percentage: 33.3, description: 'Road network development.' },
      { id: 'special-support-bip', name: 'Special Support Program (BIP)', amount: 198.7, color: '#10b981', hoverColor: '#34d399', percentage: 24.9, description: 'Basic infrastructure projects.' },
      { id: 'foreign-assisted', name: 'Foreign-Assisted Projects', amount: 145.2, color: '#f59e0b', hoverColor: '#fbbf24', percentage: 18.2, description: 'ODA projects.' },
      { id: 'flood-management', name: 'Flood Management Program', amount: 104.5, color: '#6366f1', hoverColor: '#818cf8', percentage: 13.1, description: 'Flood control structures.' },
      { id: 'support-operations', name: 'Support to Operations (FS / ROW)', amount: 35.1, color: '#8b5cf6', hoverColor: '#a78bfa', percentage: 4.4, description: 'Right-of-Way.' },
      { id: 'mooe', name: 'Maintenance & Operating Expenses', amount: 28.7, color: '#ec4899', hoverColor: '#f472b6', percentage: 3.6, description: 'Routine maintenance.' },
      { id: 'personal-services', name: 'Personal Services', amount: 14.7, color: '#14b8a6', hoverColor: '#2dd4bf', percentage: 1.8, description: 'Personnel services.' },
      { id: 'gen-admin', name: 'General Administration & Others', amount: 5.4, color: '#64748b', hoverColor: '#cbd5e1', percentage: 0.7, description: 'General administration.' },
    ],
  },
};

interface Props {
  selectedYear?: number;
  isBenchmark?: boolean;
  liveBreakdown?: Array<{ name: string; budget: number; projectCount: number }>;
  /** Only meaningful in Live DB mode — Demo Data renders from the static table above instantly. */
  isLoading?: boolean;
}

const LIVE_SEGMENT_COLORS = [
  '#0284c7', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6',
  '#ec4899', '#14b8a6', '#06b6d4', '#64748b', '#94a3b8',
];

export const DashboardMacroBudget: React.FC<Props> = ({
  selectedYear = 2027,
  isBenchmark = false,
  liveBreakdown = [],
  isLoading = false,
}) => {
  const { isLight } = useDashboardTheme();
  const benchmarkData = MACRO_BUDGET_BY_YEAR[selectedYear] ?? MACRO_BUDGET_BY_YEAR[2027];
  const liveTotal = liveBreakdown.reduce((sum, item) => sum + item.budget, 0);
  const liveSegments: BudgetSegment[] = React.useMemo(() => liveBreakdown.map((item, index) => ({
    id: `live-program-${index}`,
    name: item.name,
    amount: item.budget / 1e9,
    color: LIVE_SEGMENT_COLORS[index % LIVE_SEGMENT_COLORS.length],
    hoverColor: LIVE_SEGMENT_COLORS[index % LIVE_SEGMENT_COLORS.length],
    percentage: liveTotal > 0 ? (item.budget / liveTotal) * 100 : 0,
    description: `${item.projectCount.toLocaleString()} persisted project${item.projectCount === 1 ? '' : 's'} in this program for FY ${selectedYear}.`,
  })), [liveBreakdown, liveTotal, selectedYear]);
  const segments = isBenchmark ? benchmarkData.segments : liveSegments;
  const totalAmount = isBenchmark ? benchmarkData.total : liveTotal / 1e9;
  // Reloading for a new year or filter with the previous breakdown still on screen.
  const isUpdating = isLoading && !isBenchmark && liveBreakdown.length > 0;

  const [activeSegment, setActiveSegment] = useState<BudgetSegment | null>(segments[0] ?? null);
  const [showSubItems, setShowSubItems] = useState(false);

  React.useEffect(() => {
    setActiveSegment(segments[0] ?? null);
    setShowSubItems(false);
  }, [segments]);

  // Calculate SVG Pie/Donut Slices
  let cumulativeAngle = 0;
  const radius = 76;
  const strokeWidth = 26;
  const center = 100;
  const circumference = 2 * Math.PI * radius;

  const slices = segments.map((segment) => {
    const fraction = totalAmount > 0 ? segment.amount / totalAmount : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeAngle * circumference;
    cumulativeAngle += fraction;
    return {
      segment,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div
      className={`relative rounded-2xl p-6 sm:p-7 shadow-md transition-all duration-200 border overflow-hidden ${
        isLight
          ? 'bg-white border-slate-200/90 text-slate-800'
          : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-slate-100 border-slate-800'
      }`}
    >
      {/* Background Ambient Glow */}
      {!isLight && (
        <>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Header */}
      <div className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                isLight
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              <BanknotesIcon className={`w-3.5 h-3.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
              FY {selectedYear} {isBenchmark ? 'DPWH Proposed Budget' : 'Live Program Budget'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                isLight ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
              }`}
            >
              {isBenchmark ? 'Demo Data Breakdown' : 'Persisted Program Breakdown'}
            </span>
            {isUpdating && <UpdatingBadge isLight={isLight} />}
          </div>
          <h2 className={`text-xl sm:text-2xl font-black tracking-tight flex items-baseline gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <span className={isLight ? 'text-blue-700 font-black' : 'text-amber-400 font-black'}>
              ₱{totalAmount.toFixed(2)} B
            </span>
            <span className={`text-sm sm:text-base font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Total Program Outlays
            </span>
          </h2>
          <p className={`text-xs mt-0.5 max-w-xl ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {isBenchmark
              ? 'Macro allocation across national arterial highways, flood mitigations, foreign-assisted projects, and community basic infrastructure.'
              : `Allocations of FY ${selectedYear} programs from their FY ${selectedYear} component-cost schedules, each program at the chosen Program Stage or else its current stage, under its name at that stage. Budget stages only (BP to GAA-R, and Trust Fund); planning proposals (RBP, RDIP, PIP) are not counted.`}
          </p>
        </div>
      </div>

      {/* Main Grid: Interactive Donut on Left (4 cols), 2-Column Pillars Grid on Right (8 cols) */}
      {/* The skeleton is only for a first load: a reload keeps the previous breakdown on screen,
          dimmed, so the sections below do not move up while it loads. */}
      {isLoading && !isBenchmark && liveBreakdown.length === 0 ? (
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
          <div className="lg:col-span-4 flex items-center justify-center">
            <div className={`w-52 h-52 rounded-full animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`} />
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={`h-16 rounded-xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
            ))}
          </div>
        </div>
      ) : (
      <div className={`relative grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start transition-opacity ${isUpdating ? 'opacity-60' : ''}`}>
        {/* Donut Chart & Active Pillar Card (4 cols) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center">
          {segments.length === 0 ? (
            <div className={`w-full py-20 text-center text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              No program allocations are recorded for FY {selectedYear}.
            </div>
          ) : <div className="relative w-52 h-52 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90 transform">
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={isLight ? '#e2e8f0' : '#1e293b'}
                strokeWidth={strokeWidth}
              />
              {slices.map(({ segment, strokeDasharray, strokeDashoffset }) => {
                const isSelected = activeSegment?.id === segment.id;
                return (
                  <motion.circle
                    key={segment.id}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={isSelected ? strokeWidth + 5 : strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="cursor-pointer transition-all duration-200"
                    style={{
                      filter: isSelected ? `drop-shadow(0 0 8px ${segment.color}88)` : undefined,
                    }}
                    onMouseEnter={() => setActiveSegment(segment)}
                    onClick={() => setActiveSegment(segment)}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                );
              })}
            </svg>

            {/* Donut Center Summary */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 pointer-events-none">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {activeSegment ? activeSegment.name.slice(0, 20) : 'Grand Total'}
              </span>
              <span className={`text-lg sm:text-xl font-black mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                ₱{activeSegment ? activeSegment.amount.toFixed(2) : totalAmount.toFixed(2)} B
              </span>
              <span className={`text-xs font-semibold mt-0.5 ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
                {activeSegment ? `${activeSegment.percentage.toFixed(1)}% of total` : '100%'}
              </span>
            </div>
          </div>}

          {/* Active Segment Detail Card */}
          {activeSegment && (
            <motion.div
              key={activeSegment.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-3 w-full p-3.5 rounded-xl border shadow-sm ${
                isLight
                  ? 'bg-slate-50/90 border-slate-200 text-slate-800'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: activeSegment.color }}
                  />
                  <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {activeSegment.name}
                  </span>
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ml-1 ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
                  ₱{activeSegment.amount.toFixed(2)} B
                </span>
              </div>
              <p className={`text-[11px] mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {activeSegment.description}
              </p>

              {activeSegment.subItems && (
                <div className={`mt-2.5 pt-2.5 border-t ${isLight ? 'border-slate-200' : 'border-slate-700/60'}`}>
                  <button
                    onClick={() => setShowSubItems(!showSubItems)}
                    className={`w-full flex items-center justify-between text-[11px] font-bold ${
                      isLight ? 'text-blue-700 hover:text-blue-800' : 'text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    <span>Sub-program Details ({activeSegment.subItems.length})</span>
                    {showSubItems ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                  </button>

                  {showSubItems && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-1.5 mt-2 pt-1"
                    >
                      {activeSegment.subItems.map((sub, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between p-1.5 rounded text-[10px] border ${
                            isLight
                              ? 'bg-white border-slate-200 text-slate-700'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="font-medium truncate">{sub.name}</span>
                          <span className={`font-bold whitespace-nowrap ml-1.5 ${isLight ? 'text-blue-700' : 'text-emerald-400'}`}>
                            {sub.amount >= 1 ? `₱${sub.amount.toFixed(2)} B` : `₱${Math.round(sub.amount * 1000)} M`}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Side: Symmetrical 2-Column Grid (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {segments.map((segment) => {
            const isSelected = activeSegment?.id === segment.id;
            return (
              <button
                key={segment.id}
                onClick={() => setActiveSegment(segment)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isLight
                    ? isSelected
                      ? 'bg-blue-50/80 border-blue-500/60 shadow-sm ring-1 ring-blue-500/30'
                      : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/90'
                    : isSelected
                    ? 'bg-slate-800 border-amber-500/60 shadow-md ring-1 ring-amber-500/40'
                    : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className={`font-semibold truncate text-[11px] ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      {segment.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      ₱{segment.amount.toFixed(2)} B
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold text-[10px] border ${
                        isLight
                          ? 'bg-white text-slate-700 border-slate-200'
                          : 'bg-slate-900 text-amber-400 border-slate-700'
                      }`}
                    >
                      {segment.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Animated Progress Meter */}
                <div className={`mt-2 w-full h-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-900'}`}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: segment.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${segment.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
};

export default DashboardMacroBudget;
