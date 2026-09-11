import React, { useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  BanknotesIcon,
  BellIcon,
  DocumentCheckIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useDashboardTheme } from '../DashboardTheme';

export interface ActivityLog {
  id: string;
  type: 'revision' | 'lswallet' | 'project';
  title: string;
  description: string;
  timestamp: string;
  user: string;
}

interface Props {
  activities: ActivityLog[];
  isLoading?: boolean;
}

export const DashboardActivityFeed: React.FC<Props> = ({ activities, isLoading = false }) => {
  const { isLight } = useDashboardTheme();
  const [filter, setFilter] = useState<'all' | 'project' | 'revision' | 'lswallet'>('all');

  const shown = useMemo(
    () => activities.filter((item) => filter === 'all' || item.type === filter),
    [activities, filter]
  );

  const getTypeStyle = (type: ActivityLog['type']) => {
    switch (type) {
      case 'revision':
        return {
          icon: ArrowPathIcon,
          bg: isLight ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          label: 'Revision',
        };
      case 'lswallet':
        return {
          icon: BanknotesIcon,
          bg: isLight ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          label: 'LS Wallet',
        };
      case 'project':
      default:
        return {
          icon: DocumentCheckIcon,
          bg: isLight ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/15 text-blue-400 border-blue-500/20',
          label: 'Project',
        };
    }
  };

  return (
    <section
      className={`h-full rounded-2xl border shadow-md p-5 flex flex-col justify-between overflow-hidden transition-all duration-200 ${
        isLight
          ? 'bg-white border-slate-200/90 text-slate-800'
          : 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-slate-100 border-slate-800 shadow-xl'
      }`}
    >
      {/* Top Section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className={`flex items-center justify-between pb-3.5 border-b shrink-0 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
          <div className="flex items-center gap-2">
            <span
              className={`p-1.5 rounded-lg border ${
                isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-amber-400 border-slate-700'
              }`}
            >
              <BellIcon className="w-4 h-4" />
            </span>
            <div>
              <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Live Audit Feed
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Recent portfolio activity</p>
            </div>
          </div>
          <span className={`flex items-center gap-1 text-[11px] font-semibold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1 my-3 text-xs overflow-x-auto pb-1 shrink-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'project', label: 'Projects' },
            { id: 'revision', label: 'Revisions' },
            { id: 'lswallet', label: 'LS Wallet' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filter === tab.id
                  ? isLight
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : isLight
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Activity Stream List */}
        <div className="flex-1 min-h-[280px] overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className={`h-16 rounded-xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
            ))
          ) : shown.length === 0 ? (
            <div className={`h-full flex items-center justify-center text-center text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              No activity logs found for this filter.
            </div>
          ) : (
            shown.map((item) => {
              const style = getTypeStyle(item.type);
              const Icon = style.icon;

              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                    isLight
                      ? 'bg-slate-50/80 hover:bg-slate-100 border-slate-200'
                      : 'bg-slate-800/50 hover:bg-slate-800/80 border-slate-700/60'
                  }`}
                >
                  <span className={`p-1.5 rounded-lg border ${style.bg} shrink-0 mt-0.5 shadow-xs`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {item.title}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                          isLight
                            ? 'bg-white text-slate-600 border-slate-200'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        {style.label}
                      </span>
                    </div>

                    <p className={`text-[11px] line-clamp-2 mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      {item.description}
                    </p>

                    <div className={`flex items-center gap-1.5 text-[10px] mt-1 font-medium ${isLight ? 'text-slate-400' : 'text-slate-400'}`}>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3 text-slate-400" />
                        {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>·</span>
                      <span className={`font-semibold truncate ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>{item.user}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Footer */}
      <div className={`mt-3 pt-3 border-t text-[11px] text-center flex items-center justify-center gap-1.5 shrink-0 ${isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
        <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
        Synced with MYPS database transaction logs
      </div>
    </section>
  );
};

export default DashboardActivityFeed;
