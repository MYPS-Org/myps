import React, { useMemo, useState } from 'react';
import { ArrowPathIcon, BanknotesIcon, BellIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';

export interface ActivityLog { id: string; type: 'revision' | 'lswallet' | 'project'; title: string; description: string; timestamp: string; user: string }
interface Props { activities: ActivityLog[] }
const DashboardActivityFeed: React.FC<Props> = ({ activities }) => {
  const [filter, setFilter] = useState('all');
  const shown = useMemo(() => activities.filter((item) => filter === 'all' || item.type === filter), [activities, filter]);
  return <section className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl p-6">
    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><BellIcon className="w-5 h-5 text-gray-400" />Recent record activity</h3>
    <div className="flex gap-2 my-4 text-xs">{['all', 'project', 'revision', 'lswallet'].map((type) => <button key={type} onClick={() => setFilter(type)} className={`capitalize px-2.5 py-1 rounded-lg ${filter === type ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}>{type === 'lswallet' ? 'LS project' : type}</button>)}</div>
    <div className="space-y-3 max-h-[380px] overflow-y-auto">
      {shown.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No recent activity for this filter.</p>}
      {shown.slice(0, 8).map((item) => { const Icon = item.type === 'revision' ? ArrowPathIcon : item.type === 'lswallet' ? BanknotesIcon : DocumentCheckIcon; return <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
        <Icon className="w-4 h-4 text-gray-400 shrink-0 mt-1" /><div className="min-w-0"><div className="text-xs font-bold text-gray-900 truncate">{item.title}</div><p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{item.description}</p><div className="text-[10px] text-gray-400 mt-1">{item.timestamp} · {item.user}</div></div>
      </div>; })}
    </div>
    <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 text-center">Latest persisted project and LS project changes</div>
  </section>;
};
export default DashboardActivityFeed;
