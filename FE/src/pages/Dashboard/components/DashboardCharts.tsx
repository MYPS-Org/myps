import React, { useState } from 'react';
import { ChartBarIcon, ChartPieIcon, MapIcon } from '@heroicons/react/24/outline';

export interface MonthlyTrend { month: string; budget: number; actual: number }
export interface StatusSegment { name: string; count: number; color: string; hoverColor: string }
export interface IslandAllocation { name: string; budget: number; projectCount: number }
interface Props { selectedYear: number; monthlyData: MonthlyTrend[]; statusData: StatusSegment[]; islandData: IslandAllocation[]; onStatusSelect?: (name: string | null) => void; activeStatusFilter?: string | null }
const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 2 }).format(value);

const DashboardCharts: React.FC<Props> = ({ selectedYear, monthlyData, statusData, islandData, onStatusSelect, activeStatusFilter }) => {
  const [hovered, setHovered] = useState<MonthlyTrend | null>(null);
  const max = Math.max(1, ...monthlyData.flatMap((item) => [item.budget, item.actual]));
  const totalStatuses = statusData.reduce((sum, item) => sum + item.count, 0);
  const totalIslandBudget = islandData.reduce((sum, item) => sum + item.budget, 0);
  return <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <section className="lg:col-span-2 bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><ChartBarIcon className="w-5 h-5 text-gray-400" />Annual MYPS budget and LS itemization</h3>
      <p className="text-xs text-gray-500 mt-1">Persisted component-cost schedules and itemized LS amounts, in millions of pesos.</p>
      {monthlyData.length === 0 ? <div className="h-56 grid place-items-center text-sm text-gray-400">No annual budget records are available.</div> : <div className="mt-6 h-56 flex items-end gap-4 border-b border-gray-200 px-2">
        {monthlyData.map((item) => <div key={item.month} className="relative flex-1 h-full flex flex-col justify-end" onMouseEnter={() => setHovered(item)} onMouseLeave={() => setHovered(null)}>
          {hovered?.month === item.month && <div className="absolute z-10 top-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs p-2 shadow-lg">Budget: {money(item.budget * 1e6)}<br />LS itemized: {money(item.actual * 1e6)}</div>}
          <div className="flex items-end justify-center gap-1 h-[185px]">
            <div className="w-4 sm:w-6 bg-gray-300 rounded-t" style={{ height: `${Math.max(item.budget > 0 ? 2 : 0, item.budget / max * 100)}%` }} />
            <div className="w-4 sm:w-6 bg-gray-700 rounded-t" style={{ height: `${Math.max(item.actual > 0 ? 2 : 0, item.actual / max * 100)}%` }} />
          </div>
          <div className={`text-center text-xs py-2 ${Number(item.month) === selectedYear ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{item.month}</div>
        </div>)}
      </div>}
      <div className="mt-3 flex gap-5 text-xs text-gray-600"><span className="flex items-center gap-1.5"><i className="w-3 h-3 bg-gray-300 rounded-sm" />Infrastructure budget</span><span className="flex items-center gap-1.5"><i className="w-3 h-3 bg-gray-700 rounded-sm" />LS itemized</span></div>
    </section>

    <section className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><ChartPieIcon className="w-5 h-5 text-gray-400" />Project stages · FY {selectedYear}</h3>
      <div className="mt-5 space-y-2 max-h-64 overflow-auto">
        {statusData.length === 0 && <p className="text-sm text-gray-400">No staged projects for this year.</p>}
        {statusData.map((item) => { const pct = totalStatuses ? Math.round(item.count / totalStatuses * 100) : 0; const selected = activeStatusFilter === item.name; return <button key={item.name} onClick={() => onStatusSelect?.(selected ? null : item.name)} className={`w-full p-2 rounded-lg text-xs text-left ${selected ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
          <div className="flex justify-between"><span className="font-medium text-gray-700">{item.name}</span><span className="font-bold text-gray-900">{item.count} · {pct}%</span></div>
          <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} /></div>
        </button>; })}
      </div>
    </section>

    <section className="lg:col-span-3 bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><MapIcon className="w-5 h-5 text-gray-400" />FY {selectedYear} island-group allocation</h3>
      <p className="text-xs text-gray-500 mt-1">Calculated from the actual region and component-cost records returned for the selected year.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
        {islandData.length === 0 && <p className="text-sm text-gray-400">No geographic allocation data is available.</p>}
        {islandData.map((item) => { const share = totalIslandBudget ? Math.round(item.budget / totalIslandBudget * 100) : 0; return <div key={item.name} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <div className="flex justify-between text-sm"><span className="font-semibold text-gray-900">{item.name}</span><span className="text-gray-500">{share}%</span></div>
          <div className="mt-2 text-xl font-bold text-gray-900">{money(item.budget)}</div><div className="text-xs text-gray-500 mt-1">{item.projectCount} projects</div>
          <div className="mt-3 h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-gray-700 rounded-full" style={{ width: `${share}%` }} /></div>
        </div>; })}
      </div>
    </section>
  </div>;
};

export default DashboardCharts;
